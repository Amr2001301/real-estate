import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BrokerActivityType,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ApprovePayoutDto,
  BrokerPayoutsQueryDto,
  CancelPayoutDto,
  CommissionIdsDto,
  CreateBrokerPayoutDto,
  EligibleCommissionsQueryDto,
  MarkPayoutPaidDto,
  ProcessPayoutDto,
} from './dto/broker-payout.dto';

const PAYOUT_INCLUDE = {
  broker: {
    select: {
      id: true,
      companyName: true,
      commercialName: true,
      code: true,
      status: true,
    },
  },
  approvedBy: { select: { id: true, fullName: true } },
  processedBy: { select: { id: true, fullName: true } },
  cancelledBy: { select: { id: true, fullName: true } },
  commissions: {
    orderBy: { earnedAt: 'asc' as const },
    select: {
      id: true,
      commissionNumber: true,
      status: true,
      basisAmount: true,
      commissionPct: true,
      grossAmount: true,
      taxAmount: true,
      withholdingAmount: true,
      netAmount: true,
      earnedAt: true,
      brokerAgent: { select: { id: true, fullName: true } },
      contract: {
        select: {
          id: true,
          contractNumber: true,
          totalAmount: true,
          customer: { select: { id: true, fullName: true } },
        },
      },
      unit: {
        select: {
          id: true,
          code: true,
          type: true,
          building: {
            select: {
              phase: {
                select: { project: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      project: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class BrokerPayoutsService {
  private readonly logger = new Logger(BrokerPayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── List + Detail ──────────────────────────────────────────────────────

  async list(query: BrokerPayoutsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.BrokerPayoutWhereInput = {
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.period ? { period: query.period } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brokerPayout.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        ...takeSkip({ page, pageSize }),
        include: PAYOUT_INCLUDE,
      }),
      this.prisma.brokerPayout.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string) {
    const payout = await this.prisma.brokerPayout.findUnique({
      where: { id },
      include: PAYOUT_INCLUDE,
    });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  // ── Eligible commissions (for the "create payout" UI) ──────────────────

  async listEligibleCommissions(query: EligibleCommissionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;

    const where: Prisma.BrokerCommissionWhereInput = {
      brokerId: query.brokerId,
      status: BrokerCommissionStatus.APPROVED,
      payoutId: null,
      ...(query.projectId ? { projectId: query.projectId } : {}),
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
        orderBy: { earnedAt: 'asc' },
        ...takeSkip({ page, pageSize }),
        select: {
          id: true,
          commissionNumber: true,
          basisAmount: true,
          commissionPct: true,
          grossAmount: true,
          taxAmount: true,
          withholdingAmount: true,
          netAmount: true,
          earnedAt: true,
          brokerAgent: { select: { id: true, fullName: true } },
          contract: {
            select: {
              id: true,
              contractNumber: true,
              totalAmount: true,
              customer: { select: { id: true, fullName: true } },
            },
          },
          unit: {
            select: {
              id: true,
              code: true,
              type: true,
              building: {
                select: {
                  phase: {
                    select: {
                      project: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          project: { select: { id: true, name: true, city: true } },
        },
      }),
      this.prisma.brokerCommission.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  // ── Create ─────────────────────────────────────────────────────────────

  async create(dto: CreateBrokerPayoutDto, actor: AuthUser) {
    const broker = await this.prisma.broker.findUnique({
      where: { id: dto.brokerId },
      select: { id: true, status: true },
    });
    if (!broker) throw new NotFoundException('Broker not found');

    // Validate any provided commissions before doing anything else.
    if (dto.commissionIds && dto.commissionIds.length > 0) {
      await this.assertCommissionsEligible(dto.brokerId, dto.commissionIds);
    }

    const payoutNumber = await this.nextPayoutNumber();

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.brokerPayout.create({
        data: {
          payoutNumber,
          brokerId: dto.brokerId,
          period: dto.period ?? null,
          notes: dto.notes ?? null,
          status: BrokerPayoutStatus.DRAFT,
        },
      });

      if (dto.commissionIds && dto.commissionIds.length > 0) {
        await tx.brokerCommission.updateMany({
          where: {
            id: { in: dto.commissionIds },
            brokerId: dto.brokerId,
            status: BrokerCommissionStatus.APPROVED,
            payoutId: null,
          },
          data: { payoutId: created.id },
        });
        await this.recomputeTotals(tx, created.id);
      }

      return created.id;
    });

    await this.writeActivity(dto.brokerId, BrokerActivityType.PAYOUT_CREATED, result, {
      payoutNumber,
      commissionIds: dto.commissionIds ?? [],
      by: actor.sub,
    });
    await this.notify(dto.brokerId, 'broker_payout_created', {
      payoutId: result,
      reference: payoutNumber,
    });

    return this.findOne(result);
  }

  // ── Add / remove commissions ───────────────────────────────────────────

  async addCommissions(id: string, dto: CommissionIdsDto) {
    const payout = await this.assertPayoutInStatus(id, BrokerPayoutStatus.DRAFT);
    await this.assertCommissionsEligible(payout.brokerId, dto.commissionIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.brokerCommission.updateMany({
        where: {
          id: { in: dto.commissionIds },
          brokerId: payout.brokerId,
          status: BrokerCommissionStatus.APPROVED,
          payoutId: null,
        },
        data: { payoutId: id },
      });
      await this.recomputeTotals(tx, id);
    });

    return this.findOne(id);
  }

  async removeCommissions(id: string, dto: CommissionIdsDto) {
    // Status guard (throws unless DRAFT); the row itself isn't needed here.
    await this.assertPayoutInStatus(id, BrokerPayoutStatus.DRAFT);

    await this.prisma.$transaction(async (tx) => {
      // Only unlink commissions that are actually attached to THIS payout —
      // we never modify rows that belong to a different payout.
      await tx.brokerCommission.updateMany({
        where: {
          id: { in: dto.commissionIds },
          payoutId: id,
        },
        data: { payoutId: null },
      });
      await this.recomputeTotals(tx, id);
    });

    return this.findOne(id);
  }

  // ── Status transitions ─────────────────────────────────────────────────

  async approve(id: string, dto: ApprovePayoutDto, actor: AuthUser) {
    const payout = await this.assertPayoutInStatus(id, BrokerPayoutStatus.DRAFT);
    const count = await this.prisma.brokerCommission.count({
      where: { payoutId: id },
    });
    if (count === 0) {
      throw new BadRequestException(
        'Cannot approve a payout that has no commissions',
      );
    }
    const updated = await this.prisma.brokerPayout.update({
      where: { id },
      data: {
        status: BrokerPayoutStatus.APPROVED,
        approvedById: actor.sub,
        approvedAt: new Date(),
        notes: dto.notes ? appendNote(payout.notes, `[approve] ${dto.notes.trim()}`) : payout.notes,
      },
      include: PAYOUT_INCLUDE,
    });

    await this.writeActivity(payout.brokerId, BrokerActivityType.PAYOUT_APPROVED, id, {
      reference: updated.payoutNumber,
      by: actor.sub,
    });
    await this.notify(payout.brokerId, 'broker_payout_approved', {
      payoutId: id,
      reference: updated.payoutNumber,
    });
    return updated;
  }

  async process(id: string, dto: ProcessPayoutDto, actor: AuthUser) {
    const payout = await this.assertPayoutInStatus(id, BrokerPayoutStatus.APPROVED);
    const updated = await this.prisma.brokerPayout.update({
      where: { id },
      data: {
        status: BrokerPayoutStatus.PROCESSING,
        processedById: actor.sub,
        processedAt: new Date(),
        ...(dto.paymentMethod ? { paymentMethod: dto.paymentMethod } : {}),
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        notes: dto.notes ? appendNote(payout.notes, `[process] ${dto.notes.trim()}`) : payout.notes,
      },
      include: PAYOUT_INCLUDE,
    });

    await this.writeActivity(payout.brokerId, BrokerActivityType.PAYOUT_PROCESSING, id, {
      reference: updated.payoutNumber,
      by: actor.sub,
    });
    await this.notify(payout.brokerId, 'broker_payout_processing', {
      payoutId: id,
      reference: updated.payoutNumber,
    });
    return updated;
  }

  async markPaid(id: string, dto: MarkPayoutPaidDto, actor: AuthUser) {
    const payout = await this.assertPayoutInStatus(id, BrokerPayoutStatus.PROCESSING);
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const updated = await this.prisma.brokerPayout.update({
      where: { id },
      data: {
        status: BrokerPayoutStatus.PAID,
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference ?? null,
        receiptUrl: dto.receiptUrl ?? null,
        paidAt,
        notes: dto.notes ? appendNote(payout.notes, `[paid] ${dto.notes.trim()}`) : payout.notes,
      },
      include: PAYOUT_INCLUDE,
    });

    await this.writeActivity(payout.brokerId, BrokerActivityType.PAYOUT_PAID, id, {
      reference: updated.payoutNumber,
      paymentMethod: dto.paymentMethod,
      paidAt: paidAt.toISOString(),
      by: actor.sub,
    });
    await this.notify(payout.brokerId, 'broker_payout_paid', {
      payoutId: id,
      reference: updated.payoutNumber,
      paidAt: paidAt.toISOString(),
    });
    return updated;
  }

  async cancel(id: string, dto: CancelPayoutDto, actor: AuthUser) {
    const payout = await this.assertExists(id);
    if (
      payout.status !== BrokerPayoutStatus.DRAFT &&
      payout.status !== BrokerPayoutStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only DRAFT or APPROVED payouts can be cancelled',
      );
    }
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const updated = await this.prisma.$transaction(async (tx) => {
      // Unlink commissions so they can be paid via a different payout later.
      await tx.brokerCommission.updateMany({
        where: { payoutId: id },
        data: { payoutId: null },
      });
      return tx.brokerPayout.update({
        where: { id },
        data: {
          status: BrokerPayoutStatus.CANCELLED,
          cancelledById: actor.sub,
          cancelledAt: new Date(),
          cancelReason: reason,
          // Totals zero-out: the payout no longer owns any commissions.
          totalGross: new Prisma.Decimal(0),
          totalTax: new Prisma.Decimal(0),
          totalWithholding: new Prisma.Decimal(0),
          totalNet: new Prisma.Decimal(0),
        },
        include: PAYOUT_INCLUDE,
      });
    });

    await this.writeActivity(payout.brokerId, BrokerActivityType.PAYOUT_CANCELLED, id, {
      reference: updated.payoutNumber,
      reason,
      by: actor.sub,
    });
    await this.notify(payout.brokerId, 'broker_payout_cancelled', {
      payoutId: id,
      reference: updated.payoutNumber,
      reason,
    });

    return updated;
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  /**
   * Year-prefixed, max-based generator so deletions don't cause duplicates.
   * Format: PAY-YYYY-NNNN.
   */
  private async nextPayoutNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const rows = await this.prisma.brokerPayout.findMany({
      where: { payoutNumber: { startsWith: prefix } },
      select: { payoutNumber: true },
    });
    let maxSeq = 0;
    for (const { payoutNumber } of rows) {
      const seq = parseInt(payoutNumber.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  private async assertExists(id: string) {
    const p = await this.prisma.brokerPayout.findUnique({
      where: { id },
      select: {
        id: true,
        brokerId: true,
        status: true,
        notes: true,
        payoutNumber: true,
      },
    });
    if (!p) throw new NotFoundException('Payout not found');
    return p;
  }

  private async assertPayoutInStatus(
    id: string,
    expected: BrokerPayoutStatus,
  ) {
    const p = await this.assertExists(id);
    if (p.status !== expected) {
      throw new ConflictException(
        `Payout must be in status ${expected}; current status is ${p.status}`,
      );
    }
    return p;
  }

  /**
   * Every commission in the list must:
   *   - belong to the broker,
   *   - be APPROVED,
   *   - not already linked to another payout (payoutId IS NULL).
   * Throws BadRequest with the first violation encountered.
   */
  private async assertCommissionsEligible(
    brokerId: string,
    commissionIds: string[],
  ): Promise<void> {
    const rows = await this.prisma.brokerCommission.findMany({
      where: { id: { in: commissionIds } },
      select: {
        id: true,
        brokerId: true,
        status: true,
        payoutId: true,
        commissionNumber: true,
      },
    });
    const found = new Map(rows.map((r) => [r.id, r]));
    for (const id of commissionIds) {
      const c = found.get(id);
      if (!c) throw new NotFoundException(`Commission ${id} not found`);
      if (c.brokerId !== brokerId) {
        throw new BadRequestException(
          `Commission ${c.commissionNumber} belongs to another broker`,
        );
      }
      if (c.status !== BrokerCommissionStatus.APPROVED) {
        throw new BadRequestException(
          `Commission ${c.commissionNumber} is ${c.status}; only APPROVED can be added`,
        );
      }
      if (c.payoutId) {
        throw new ConflictException(
          `Commission ${c.commissionNumber} is already linked to another payout`,
        );
      }
    }
  }

  /**
   * Recompute payout totals from the currently-linked commissions. Called
   * inside any tx that adds, removes, or otherwise mutates the membership.
   */
  private async recomputeTotals(
    tx: Prisma.TransactionClient,
    payoutId: string,
  ): Promise<void> {
    const agg = await tx.brokerCommission.aggregate({
      where: { payoutId },
      _sum: {
        grossAmount: true,
        taxAmount: true,
        withholdingAmount: true,
        netAmount: true,
      },
    });
    await tx.brokerPayout.update({
      where: { id: payoutId },
      data: {
        totalGross: agg._sum.grossAmount ?? new Prisma.Decimal(0),
        totalTax: agg._sum.taxAmount ?? new Prisma.Decimal(0),
        totalWithholding: agg._sum.withholdingAmount ?? new Prisma.Decimal(0),
        totalNet: agg._sum.netAmount ?? new Prisma.Decimal(0),
      },
    });
  }

  private async writeActivity(
    brokerId: string,
    type: BrokerActivityType,
    payoutId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.brokerActivityLog.create({
        data: {
          brokerId,
          type,
          entityType: 'Payout',
          entityId: payoutId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.warn(
        `writeActivity(${type}) for payout ${payoutId} failed: ${(e as Error).message}`,
      );
    }
  }

  /**
   * P4 — Broker payout events. Like commissions, payouts are financial data
   * so we only deliver to broker users with `canViewCommissions = true`.
   * Routed through NotificationsService for push + template resolution.
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
