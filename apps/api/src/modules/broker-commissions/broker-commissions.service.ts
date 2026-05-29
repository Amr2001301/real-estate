import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BrokerCommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ApproveBrokerCommissionDto,
  BrokerCommissionsQueryDto,
  CancelBrokerCommissionDto,
  RejectBrokerCommissionDto,
} from './dto/broker-commission.dto';

const COMMISSION_INCLUDE = {
  broker: {
    select: {
      id: true,
      companyName: true,
      commercialName: true,
      code: true,
      status: true,
    },
  },
  brokerAgent: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  contract: {
    select: {
      id: true,
      contractNumber: true,
      totalAmount: true,
      downPayment: true,
      signedAt: true,
      customer: { select: { id: true, fullName: true, phone: true } },
    },
  },
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      commissionLockedPct: true,
      commissionLockedAmount: true,
      sales: { select: { id: true, fullName: true } },
      lead: { select: { id: true, fullName: true, phone: true } },
    },
  },
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      price: true,
      building: {
        select: {
          id: true,
          name: true,
          phase: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: { id: true, name: true, city: true, status: true },
              },
            },
          },
        },
      },
    },
  },
  project: {
    select: { id: true, name: true, city: true, status: true },
  },
  approvedBy: { select: { id: true, fullName: true } },
  rejectedBy: { select: { id: true, fullName: true } },
} as const;

export interface CommissionMaterializeResult {
  status: 'created' | 'skipped' | 'already_exists';
  commissionId?: string;
  commissionNumber?: string;
  reason?: string;
}

@Injectable()
export class BrokerCommissionsService {
  private readonly logger = new Logger(BrokerCommissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Materialize on signed broker contract ──────────────────────────────

  /**
   * Idempotent: if a commission already exists for the contract, returns
   * `already_exists` without throwing. Skips (no row created) when the
   * contract is not broker-attributed, not signed, or has no usable
   * commission snapshot from the source reservation.
   */
  async materializeFromContract(
    contractId: string,
  ): Promise<CommissionMaterializeResult> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        signedAt: true,
        totalAmount: true,
        brokerId: true,
        brokerAgentId: true,
        reservationId: true,
        unitId: true,
        unit: {
          select: {
            id: true,
            code: true,
            building: { select: { phase: { select: { projectId: true } } } },
          },
        },
        reservation: {
          select: {
            id: true,
            reservationNumber: true,
            brokerId: true,
            commissionLockedPct: true,
            commissionLockedAmount: true,
            lead: { select: { id: true, fullName: true } },
          },
        },
        brokerCommission: { select: { id: true, commissionNumber: true } },
      },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    if (contract.brokerCommission) {
      return {
        status: 'already_exists',
        commissionId: contract.brokerCommission.id,
        commissionNumber: contract.brokerCommission.commissionNumber,
      };
    }
    if (!contract.brokerId) {
      return { status: 'skipped', reason: 'contract is not broker-attributed' };
    }
    if (!contract.signedAt) {
      return { status: 'skipped', reason: 'contract is not signed' };
    }
    if (!contract.reservationId || !contract.reservation) {
      return { status: 'skipped', reason: 'contract has no source reservation' };
    }
    if (contract.reservation.brokerId !== contract.brokerId) {
      return {
        status: 'skipped',
        reason: 'broker attribution mismatch between contract and reservation',
      };
    }

    const lockedPct = contract.reservation.commissionLockedPct;
    const lockedAmount = contract.reservation.commissionLockedAmount;
    const basisAmount = contract.totalAmount;
    const projectId = contract.unit.building.phase.projectId;

    // Compute gross amount, preferring the locked snapshot. If only pct is
    // available we derive amount = basisAmount * pct / 100. Without either
    // we refuse to create an invalid commission.
    let grossAmount: Prisma.Decimal;
    if (lockedAmount !== null && lockedAmount !== undefined) {
      grossAmount = lockedAmount;
    } else if (lockedPct !== null && lockedPct !== undefined) {
      grossAmount = basisAmount.mul(lockedPct).div(100);
    } else {
      return {
        status: 'skipped',
        reason:
          'reservation has neither commissionLockedAmount nor commissionLockedPct; skipping (configure broker commission rates and re-convert)',
      };
    }

    // Tax + withholding default to zero for Phase 8. Admin can adjust later
    // in a follow-up phase if needed.
    const taxPct = new Prisma.Decimal(0);
    const taxAmount = new Prisma.Decimal(0);
    const withholdingPct = new Prisma.Decimal(0);
    const withholdingAmount = new Prisma.Decimal(0);
    const netAmount = grossAmount.sub(taxAmount).sub(withholdingAmount);

    const commissionNumber = await this.nextCommissionNumber();

    try {
      const commission = await this.prisma.$transaction(async (tx) => {
        const created = await tx.brokerCommission.create({
          data: {
            commissionNumber,
            brokerId: contract.brokerId!,
            brokerAgentId: contract.brokerAgentId ?? null,
            contractId: contract.id,
            reservationId: contract.reservationId,
            unitId: contract.unitId,
            projectId,
            basisAmount,
            commissionPct: lockedPct ?? null,
            grossAmount,
            taxPct,
            taxAmount,
            withholdingPct,
            withholdingAmount,
            netAmount,
            status: BrokerCommissionStatus.PENDING,
            earnedAt: contract.signedAt!,
          },
        });

        // Surface as `broker_commission_earned` on the broker portal feed.
        if (contract.reservation?.lead?.id) {
          await tx.leadActivity.create({
            data: {
              leadId: contract.reservation.lead.id,
              type: 'broker_commission_earned',
              payload: {
                brokerId: contract.brokerId,
                brokerAgentId: contract.brokerAgentId,
                commissionId: created.id,
                commissionNumber,
                contractId: contract.id,
                contractNumber: contract.contractNumber,
                grossAmount: grossAmount.toString(),
                netAmount: netAmount.toString(),
              },
            },
          });
        }
        return created;
      });

      // P4 — safe payload: reference + commissionId + contractNumber only.
      // Recipients are filtered to canViewCommissions broker users, so the
      // amounts they're authorised to see are surfaced in the dashboard,
      // not the notification body.
      await this.notify(commission.brokerId, 'broker_commission_earned', {
        commissionId: commission.id,
        reference: commissionNumber,
        contractNumber: contract.contractNumber,
      });

      return {
        status: 'created',
        commissionId: commission.id,
        commissionNumber,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Race: another path materialized the same contract in parallel.
        const existing = await this.prisma.brokerCommission.findUnique({
          where: { contractId },
          select: { id: true, commissionNumber: true },
        });
        if (existing) {
          return {
            status: 'already_exists',
            commissionId: existing.id,
            commissionNumber: existing.commissionNumber,
          };
        }
      }
      throw e;
    }
  }

  // ── List + Detail ──────────────────────────────────────────────────────

  async list(query: BrokerCommissionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.BrokerCommissionWhereInput = {
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
      ...(query.brokerAgentId ? { brokerAgentId: query.brokerAgentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.contractId ? { contractId: query.contractId } : {}),
      ...(query.reservationId ? { reservationId: query.reservationId } : {}),
      ...(query.from || query.to
        ? {
            earnedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brokerCommission.findMany({
        where,
        orderBy: [{ status: 'asc' }, { earnedAt: 'desc' }],
        ...takeSkip({ page, pageSize }),
        include: COMMISSION_INCLUDE,
      }),
      this.prisma.brokerCommission.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string) {
    const commission = await this.prisma.brokerCommission.findUnique({
      where: { id },
      include: COMMISSION_INCLUDE,
    });
    if (!commission) throw new NotFoundException('Commission not found');
    return commission;
  }

  // ── Admin transitions ──────────────────────────────────────────────────

  async approve(
    id: string,
    dto: ApproveBrokerCommissionDto,
    actor: AuthUser,
  ) {
    const existing = await this.assertExists(id);
    if (existing.status === BrokerCommissionStatus.APPROVED) {
      throw new BadRequestException('Commission is already approved');
    }
    if (existing.status === BrokerCommissionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot approve a cancelled commission; create a new contract or re-materialize',
      );
    }
    const updated = await this.prisma.brokerCommission.update({
      where: { id },
      data: {
        status: BrokerCommissionStatus.APPROVED,
        approvedById: actor.sub,
        approvedAt: new Date(),
        // Clear any prior rejection state so the audit history is clean.
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
        notes:
          dto.notes && dto.notes.trim().length > 0
            ? appendNote(existing.notes, `[approve] ${dto.notes.trim()}`)
            : existing.notes,
      },
      include: COMMISSION_INCLUDE,
    });

    await this.writeActivity(id, 'broker_commission_approved', {
      by: actor.sub,
      notes: dto.notes ?? null,
    });
    await this.notify(updated.brokerId, 'broker_commission_approved', {
      commissionId: id,
      reference: updated.commissionNumber,
    });

    return updated;
  }

  async reject(id: string, dto: RejectBrokerCommissionDto, actor: AuthUser) {
    const existing = await this.assertExists(id);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');
    if (existing.status === BrokerCommissionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot reject a cancelled commission',
      );
    }
    const updated = await this.prisma.brokerCommission.update({
      where: { id },
      data: {
        status: BrokerCommissionStatus.REJECTED,
        rejectedById: actor.sub,
        rejectedAt: new Date(),
        rejectionReason: reason,
        approvedById: null,
        approvedAt: null,
      },
      include: COMMISSION_INCLUDE,
    });

    await this.writeActivity(id, 'broker_commission_rejected', {
      by: actor.sub,
      reason,
    });
    await this.notify(updated.brokerId, 'broker_commission_rejected', {
      commissionId: id,
      reference: updated.commissionNumber,
      reason,
    });

    return updated;
  }

  async cancel(id: string, dto: CancelBrokerCommissionDto, actor: AuthUser) {
    const existing = await this.assertExists(id);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');
    if (existing.status === BrokerCommissionStatus.CANCELLED) {
      throw new BadRequestException('Commission is already cancelled');
    }

    // Payout guard: once a commission is linked to a payout, cancellation
    // depends on the payout's status. We *block* in all locked states and
    // refuse to silently unlink — the admin must explicitly remove it from
    // the DRAFT payout first (predictable, auditable, no hidden side-effects).
    if (existing.payoutId) {
      const payout = await this.prisma.brokerPayout.findUnique({
        where: { id: existing.payoutId },
        select: { id: true, payoutNumber: true, status: true },
      });
      if (payout) {
        if (
          payout.status === 'APPROVED' ||
          payout.status === 'PROCESSING' ||
          payout.status === 'PAID'
        ) {
          throw new ConflictException(
            `Cannot cancel this commission; it is linked to payout ${payout.payoutNumber} (status ${payout.status})`,
          );
        }
        if (payout.status === 'DRAFT') {
          throw new ConflictException(
            `Cannot cancel this commission while it is linked to a DRAFT payout (${payout.payoutNumber}). Remove it from the payout first.`,
          );
        }
        // status === 'CANCELLED' would have unlinked payoutId already, so
        // we don't expect to reach this branch; allow the cancellation to
        // proceed for safety.
      }
    }

    const updated = await this.prisma.brokerCommission.update({
      where: { id },
      data: {
        status: BrokerCommissionStatus.CANCELLED,
        notes: appendNote(existing.notes, `[cancel] ${reason}`),
      },
      include: COMMISSION_INCLUDE,
    });

    await this.writeActivity(id, 'broker_commission_cancelled', {
      by: actor.sub,
      reason,
    });
    await this.notify(updated.brokerId, 'broker_commission_cancelled', {
      commissionId: id,
      reference: updated.commissionNumber,
      reason,
    });

    return updated;
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async assertExists(id: string) {
    const c = await this.prisma.brokerCommission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        notes: true,
        brokerId: true,
        payoutId: true,
      },
    });
    if (!c) throw new NotFoundException('Commission not found');
    return c;
  }

  /**
   * Max-based generator so deleted rows don't cause duplicate numbers.
   * Format: COM-YYYY-NNNN.
   */
  private async nextCommissionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `COM-${year}-`;
    const rows = await this.prisma.brokerCommission.findMany({
      where: { commissionNumber: { startsWith: prefix } },
      select: { commissionNumber: true },
    });
    let maxSeq = 0;
    for (const { commissionNumber } of rows) {
      const seq = parseInt(commissionNumber.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  private async writeActivity(
    commissionId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      // We attach to the contract's reservation's lead so the broker portal
      // activity feed (which reads LeadActivity scoped by lead.brokerId)
      // surfaces it correctly. Best-effort: log on failure, never throw.
      const lookup = await this.prisma.brokerCommission.findUnique({
        where: { id: commissionId },
        select: {
          contractId: true,
          contract: {
            select: {
              contractNumber: true,
              reservation: { select: { leadId: true } },
            },
          },
        },
      });
      const leadId = lookup?.contract?.reservation?.leadId;
      if (!leadId) return;
      await this.prisma.leadActivity.create({
        data: {
          leadId,
          type,
          payload: {
            commissionId,
            contractId: lookup?.contractId ?? null,
            contractNumber: lookup?.contract?.contractNumber ?? null,
            ...payload,
          },
        },
      });
    } catch (e) {
      this.logger.warn(
        `writeActivity(${type}) for commission ${commissionId} failed: ${(e as Error).message}`,
      );
    }
  }

  /**
   * P4 — Broker-side commission events. Only delivered to broker users
   * with `canViewCommissions = true`; commissions are financial data and
   * shouldn't fan out to broker reps who don't have visibility on them.
   * Routed through NotificationsService so push fires when FCM is on.
   */
  private async notify(
    brokerId: string,
    templateCode: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const recipients = await this.prisma.brokerUser.findMany({
        where: { brokerId, status: 'ACTIVE', canViewCommissions: true },
        select: { userId: true },
      });
      await this.notifications.sendToUsers(
        recipients.map((r) => r.userId),
        templateCode,
        payload,
      );
    } catch (e) {
      this.logger.warn(
        `notify(${templateCode}) for broker ${brokerId} failed: ${(e as Error).message}`,
      );
    }
  }
}

function appendNote(prev: string | null, line: string): string {
  const stamp = new Date().toISOString();
  const entry = `[${stamp}] ${line}`;
  return prev ? `${prev}\n${entry}` : entry;
}

export class ConflictCommissionExistsException extends ConflictException {
  constructor(existingNumber: string) {
    super(`A commission already exists for this contract: ${existingNumber}`);
  }
}
