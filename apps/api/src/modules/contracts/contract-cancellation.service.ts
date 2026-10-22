/**
 * Step D3 — ContractCancellationService
 *
 * Implements contract cancellation (POST /contracts/:id/cancel) and unit
 * release (POST /contracts/:id/release-unit).
 *
 * Hard Rule 1 — operator-submitted amounts are stored, not the suggestion.
 * Hard Rule 2 — PAID commissions/bonuses keep their status; a clawback
 *   overlay (OUTSTANDING) is added. Nothing settled is deleted.
 *
 * Both endpoints ship together: the default unit.returnToAvailable setting is
 * REQUIRES_APPROVAL, so cancel without release-unit leaves units permanently SOLD.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BonusEntryStatus,
  BrokerCommissionStatus,
  BrokerPayoutStatus,
  ClawbackStatus,
  ContractStatus,
  DepositReviewStatus,
  InstallmentStatus,
  LeadStage,
  PaymentInstrumentStatus,
  Prisma,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { NotificationsService } from '../notifications/notifications.module';
import { CancellationPolicyService } from './cancellation-policy.service';
import type { CancellationPolicySnapshot } from './cancellation-settings.constants';
import { reportFailure } from '../../common/observability/report-failure';
import { LIVE_CONTRACT_WHERE } from '../installments/live-contract';

// ── Request DTO types (validated by class-validator in the controller) ─────────

export interface CancelContractInput {
  reason: string;
  retainedAmount: number;
  refundAmount: number;
  financialNotes?: string;
  unitReleaseOverride?: 'AUTO' | 'REQUIRES_APPROVAL';
  demoteCustomerOverride?: boolean;
  commissionActionOverride?: 'CLAWBACK' | 'RETAIN' | 'MANUAL';
  bonusActionOverride?: 'CLAWBACK' | 'RETAIN' | 'MANUAL';
  clawbackReason?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const UNSENT_PAYOUT = [BrokerPayoutStatus.DRAFT, BrokerPayoutStatus.APPROVED];
const SENT_PAYOUT = [BrokerPayoutStatus.PROCESSING, BrokerPayoutStatus.PAID];

/**
 * What a paid commission actually put in the broker's hands: its net plus the
 * price-change top-ups already sent, less the price-change clawbacks already
 * netted out of a sent payout.
 */
async function paidCommissionAmount(
  tx: Prisma.TransactionClient,
  commissionId: string,
  netAmount: Prisma.Decimal,
): Promise<Prisma.Decimal> {
  const sent = await tx.brokerCommissionAdjustment.findMany({
    where: { commissionId, settlesClawback: false, payout: { status: { in: SENT_PAYOUT } } },
    select: { kind: true, amount: true },
  });
  const paid = sent.reduce(
    (sum, a) => (a.kind === 'TOP_UP' ? sum.add(a.amount) : sum.sub(a.amount)),
    new Prisma.Decimal(netAmount),
  );
  return paid.isNegative() ? new Prisma.Decimal(0) : paid;
}

/**
 * A dead deal's price-change adjustments that were not paid yet — open, or
 * netted into a payout not sent — are dropped, and those payouts rebalanced.
 */
async function dropOpenAdjustments(tx: Prisma.TransactionClient, commissionId: string, brokerId: string) {
  const open = await tx.brokerCommissionAdjustment.findMany({
    where: {
      commissionId,
      settlesClawback: false,
      OR: [{ payoutId: null }, { payout: { status: { in: UNSENT_PAYOUT } } }],
    },
    select: { id: true, payoutId: true },
  });
  if (open.length === 0) return;
  await tx.brokerCommissionAdjustment.deleteMany({ where: { id: { in: open.map((a) => a.id) } } });
  for (const payoutId of new Set(open.map((a) => a.payoutId).filter((id): id is string => !!id))) {
    await tx.brokerPayout.update({ where: { id: payoutId }, data: { status: BrokerPayoutStatus.DRAFT } });
    await rebalancePayout(tx, payoutId, brokerId);
  }
}

/**
 * The commission has left its payout (not sent yet): the payout is cancelled
 * when nothing is left in it, or goes back to DRAFT with its totals
 * recomputed — it was approved for a different amount.
 */
async function leavePayout(
  tx: Prisma.TransactionClient,
  commission: { payoutId: string | null; brokerId: string; payout?: { status: string } | null },
  contractId: string,
  actorId: string,
  now: Date,
) {
  const payoutId = commission.payoutId;
  const status = commission.payout?.status ?? '';
  // CANCELLED payouts are already terminal; PROCESSING / PAID take the overlay path.
  if (!payoutId || (status !== 'DRAFT' && status !== 'APPROVED')) return;
  const remaining = await tx.brokerCommission.count({ where: { payoutId } });
  if (remaining === 0) {
    // Nothing left to disburse — cancel the payout; any top-ups or clawbacks
    // netted into it wait for the next one.
    await tx.brokerPayout.update({
      where: { id: payoutId },
      data: {
        status: BrokerPayoutStatus.CANCELLED,
        cancelledAt: now,
        cancelledById: actorId,
        cancelReason: `Contract ${contractId} cancelled — no remaining commissions`,
      },
    });
    await releaseAdjustments(tx, { payoutId });
  } else {
    await tx.brokerPayout.update({ where: { id: payoutId }, data: { status: BrokerPayoutStatus.DRAFT } });
    await rebalancePayout(tx, payoutId, commission.brokerId);
  }
}

/** A commission is "effectively paid" when it's attached to a payout whose
 *  payment is in-flight (PROCESSING) or confirmed (PAID). Hard Rule 2 applies:
 *  do not cancel; add clawback overlay instead.
 *
 *  APPROVED is NOT effectively paid — authorization given, money not yet sent.
 *  Cancelling an APPROVED-payout commission is safe; the payout must be
 *  recomputed and reverted to DRAFT (or CANCELLED if now empty) atomically. */
function isCommissionEffectivelyPaid(commission: {
  payoutId: string | null;
  payout?: { status: string } | null;
}): boolean {
  if (!commission.payoutId) return false;
  const s = commission.payout?.status ?? '';
  return s === 'PROCESSING' || s === 'PAID';
}

export { resetUnitWarranties } from './unit-warranties';
import { closeOpenMaintenance, resetUnitWarranties } from './unit-warranties';
import { rebalancePayout, releaseAdjustments } from '../broker-payouts/payout-totals';

@Injectable()
export class ContractCancellationService {
  private readonly logger = new Logger(ContractCancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cancellationPolicy: CancellationPolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Cancel a contract. All side effects happen in ONE $transaction.
   * The operator's submitted retainedAmount / refundAmount are stored as-is —
   * never the suggestion (Hard Rule 1).
   */
  async cancel(contractId: string, input: CancelContractInput, actorId: string) {
    const companyId = getRequiredCompanyId();

    // ── Pre-transaction reads ────────────────────────────────────────────────

    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: {
        id: true,
        status: true,
        unitId: true,
        customerId: true,
        signedAt: true,
        totalAmount: true,
        reservation: { select: { id: true, leadId: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === ContractStatus.CANCELLED) {
      throw new ConflictException('Contract is already cancelled — CANCELLED is terminal');
    }

    // A customer's proof still under review (a transfer, not a cheque — those
    // are cancelled with the deal below) is money that may have arrived: left
    // out of what was collected, then never approvable on a dead contract, it
    // dropped out of the refund. It is reviewed first.
    const proofsWaiting = await this.prisma.deposit.count({
      where: {
        deletedAt: null,
        reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        paymentInstrumentId: null,
        OR: [
          { contractId },
          ...(contract.reservation ? [{ reservationId: contract.reservation.id, contractId: null }] : []),
        ],
      },
    });
    if (proofsWaiting > 0) {
      throw new ConflictException('على العقد إثبات دفع قيد المراجعة — راجعه (اعتماد أو رفض) قبل إلغاء العقد');
    }

    // totalCollectedSnapshot — every collected payment of the deal, the
    // booking amount on its reservation included (see collectedForContract).
    const totalCollected = (await this.cancellationPolicy.collectedForContract(contractId)).total;
    // What is kept and what is given back are both out of what was collected:
    // a typo here became a refund the company does not owe.
    const cents = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v).mul(100).toDecimalPlaces(0).toNumber();
    if (cents(input.refundAmount) + cents(input.retainedAmount) > cents(totalCollected)) {
      throw new BadRequestException(
        `المحتجز + المسترد أكبر من المحصّل على العقد (${new Prisma.Decimal(totalCollected).toFixed(2)})`,
      );
    }

    // Read policy settings for policySnapshot (suggestion layer only)
    const suggestion = await this.cancellationPolicy.getCancellationSuggestion(contractId);
    const policySnapshot: CancellationPolicySnapshot = suggestion.policySnapshot;

    // Resolve effective overrides (operator per-transaction > tenant setting)
    const effectiveUnitRelease = input.unitReleaseOverride ?? suggestion.policySnapshot.unitRelease;
    const effectiveCommissionAction = input.commissionActionOverride ?? suggestion.policySnapshot.commissionAction;
    const effectiveBonusAction = input.bonusActionOverride ?? suggestion.policySnapshot.bonusAction;
    const effectiveDemote = input.demoteCustomerOverride ?? suggestion.policySnapshot.demoteClient;

    // Installment plan (may not exist for unsigned contracts with no plan)
    const plan = await this.prisma.installmentPlan.findFirst({
      where: { contractId },
      select: { id: true },
    });

    // Unit current status (needed for UnitStatusHistory.oldStatus)
    const unit = await this.prisma.unit.findUnique({
      where: { id: contract.unitId },
      select: { id: true, status: true },
    });

    // ── Transaction ─────────────────────────────────────────────────────────
    const now = new Date();
    let cancelledInstallmentsCount = 0;
    const commissionClawbackIds: string[] = [];
    const bonusClawbackIds: string[] = [];
    let unitReleasedAt: Date | null = null;
    let customerDemotedAt: Date | null = null;
    let cancelledInstrumentIds: string[] = [];

    const cancellation = await this.prisma.$transaction(async (tx) => {
      // 1. Contract → CANCELLED — once: a second cancel running at the same
      // moment finds it already cancelled.
      const cancelled = await tx.contract.updateMany({
        where: { id: contractId, companyId, status: { not: ContractStatus.CANCELLED } },
        data: { status: ContractStatus.CANCELLED, cancelledAt: now },
      });
      if (cancelled.count === 0) {
        throw new ConflictException('Contract is already cancelled — CANCELLED is terminal');
      }

      // The commission, its payout and the bonus are read here, their rows
      // locked: a payout approved, sent or paid — or a bonus paid — while the
      // cancellation runs either finishes first and is seen as such, or waits
      // and then finds the cancellation done.
      // Payout before commission — the order the payout paths take.
      await tx.$queryRaw`
        SELECT p.id FROM "BrokerPayout" p
        JOIN "BrokerCommission" c ON c."payoutId" = p.id
        WHERE c."contractId" = ${contractId}::uuid FOR UPDATE OF p`;
      await tx.$queryRaw`
        SELECT id FROM "BrokerCommission" WHERE "contractId" = ${contractId}::uuid FOR UPDATE`;
      await tx.$queryRaw`
        SELECT id FROM "BonusEntry" WHERE "contractId" = ${contractId}::uuid FOR UPDATE`;
      // Commission (at most 1 per contract, contractId @unique)
      const commission = await tx.brokerCommission.findUnique({
        where: { contractId },
        include: { payout: { select: { status: true } } },
      });
      // Bonus entry auto-generated for this contract (at most 1, contractId @unique)
      const bonusEntry = await tx.bonusEntry.findUnique({
        where: { contractId },
        select: { id: true, status: true, amount: true, clawbackStatus: true },
      });

      // 2. InstallmentPlan → cancelledAt
      if (plan) {
        await tx.installmentPlan.update({
          where: { id: plan.id },
          data: { cancelledAt: now },
        });
        // 3. Bulk-cancel PENDING/OVERDUE installments; PAID stays PAID
        const result = await tx.installment.updateMany({
          where: {
            planId: plan.id,
            status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
          },
          data: { status: InstallmentStatus.CANCELLED },
        });
        cancelledInstallmentsCount = result.count;
      }

      // 3b. Uncleared cheques of the deal are cancelled with it (decided
      // 2026-10-15): a cancelled contract collects nothing more, so they are
      // not presented or cleared later. Their waiting deposits are rejected;
      // the rows stay as evidence.
      const openInstruments = await tx.paymentInstrument.findMany({
        where: {
          status: { in: [PaymentInstrumentStatus.PENDING_CLEARANCE, PaymentInstrumentStatus.DEPOSITED] },
          deposits: { some: { contractId } },
        },
        select: { id: true },
      });
      cancelledInstrumentIds = openInstruments.map((i) => i.id);
      if (cancelledInstrumentIds.length > 0) {
        await tx.paymentInstrument.updateMany({
          where: { id: { in: cancelledInstrumentIds } },
          data: { status: PaymentInstrumentStatus.CANCELLED },
        });
        await tx.deposit.updateMany({
          where: {
            paymentInstrumentId: { in: cancelledInstrumentIds },
            reviewStatus: DepositReviewStatus.PENDING_REVIEW,
          },
          data: {
            reviewStatus: DepositReviewStatus.REJECTED,
            rejectionReason: 'Cheque cancelled with the contract',
          },
        });
      }

      // 4. Commission handling. CLAWBACK cancels or claws back; RETAIN keeps
      // it payable (decided 2026-10-16); MANUAL leaves it for the admin.
      if (commission && commission.status !== BrokerCommissionStatus.REJECTED && commission.status !== BrokerCommissionStatus.CANCELLED) {
        if (effectiveCommissionAction === 'RETAIN') {
          await tx.brokerCommission.update({
            where: { id: commission.id },
            data: { retainedOnCancellation: true },
          });
        } else if (effectiveCommissionAction === 'CLAWBACK') {
          // Price-change top-ups or clawbacks not paid yet are moot on a dead
          // deal: the one clawback below settles it.
          await dropOpenAdjustments(tx, commission.id, commission.brokerId);
          if (isCommissionEffectivelyPaid(commission)) {
            // What the broker actually received: the commission and the
            // price-change adjustments already paid out.
            const clawbackAmount = await paidCommissionAmount(tx, commission.id, commission.netAmount);
            // Hard Rule 2: status stays; clawback overlay added
            await tx.brokerCommission.update({
              where: { id: commission.id },
              data: {
                clawbackStatus: ClawbackStatus.OUTSTANDING,
                clawbackAmount,
                clawbackReason: input.clawbackReason ?? input.reason,
                clawbackAt: now,
                clawbackById: actorId,
              },
            });
            // What was paid comes back out of the broker's next payout
            // (decided 2026-10-17); collecting or waiving it by hand stays possible.
            if (clawbackAmount.isPositive()) await tx.brokerCommissionAdjustment.create({
              data: {
                brokerId: commission.brokerId,
                commissionId: commission.id,
                kind: 'CLAWBACK',
                amount: clawbackAmount,
                reason: input.clawbackReason ?? input.reason,
                createdById: actorId,
                settlesClawback: true,
                companyId,
              },
            });
            commissionClawbackIds.push(commission.id);
          } else {
            // No effective disbursement (PENDING, APPROVED-no-payout, or APPROVED
            // with a DRAFT/APPROVED payout) — cancel commission and, if it was
            // in a non-disbursed payout, recompute that payout atomically.
            await tx.brokerCommission.update({
              where: { id: commission.id },
              data: { status: BrokerCommissionStatus.CANCELLED, payoutId: null },
            });
            await leavePayout(tx, commission, contractId, actorId, now);
          }
        } else if (!isCommissionEffectivelyPaid(commission) && commission.payoutId) {
          // MANUAL: the admin decides — but a payout not sent yet must not pay
          // it meanwhile. It leaves the payout and stays APPROVED.
          await tx.brokerCommission.update({ where: { id: commission.id }, data: { payoutId: null } });
          await leavePayout(tx, commission, contractId, actorId, now);
        }
      }

      // 5. Bonus handling (same pattern as commission)
      if (bonusEntry && bonusEntry.status !== BonusEntryStatus.CANCELLED) {
        if (effectiveBonusAction === 'RETAIN') {
          await tx.bonusEntry.update({
            where: { id: bonusEntry.id },
            data: { retainedOnCancellation: true },
          });
        } else if (effectiveBonusAction === 'CLAWBACK') {
          // Price-change adjustments of a paid bonus: the open ones are moot,
          // the paid ones are clawed back with it.
          const adjustments = await tx.bonusEntry.findMany({
            where: { adjustsEntryId: bonusEntry.id, status: { not: BonusEntryStatus.CANCELLED } },
            select: { id: true, status: true, amount: true },
          });
          const open = adjustments.filter((a) => a.status !== BonusEntryStatus.PAID).map((a) => a.id);
          if (open.length > 0) {
            await tx.bonusEntry.updateMany({ where: { id: { in: open } }, data: { status: BonusEntryStatus.CANCELLED } });
          }
          if (bonusEntry.status === BonusEntryStatus.PAID) {
            const clawbackAmount = adjustments
              .filter((a) => a.status === BonusEntryStatus.PAID)
              .reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(bonusEntry.amount));
            // Hard Rule 2: status stays PAID; clawback overlay added
            await tx.bonusEntry.update({
              where: { id: bonusEntry.id },
              data: {
                clawbackStatus: ClawbackStatus.OUTSTANDING,
                clawbackAmount,
                clawbackReason: input.clawbackReason ?? input.reason,
                clawbackAt: now,
                clawbackById: actorId,
              },
            });
            bonusClawbackIds.push(bonusEntry.id);
          } else {
            // PENDING or APPROVED — cancel
            await tx.bonusEntry.update({
              where: { id: bonusEntry.id },
              data: { status: BonusEntryStatus.CANCELLED },
            });
          }
        }
      }

      // 6. AUTO unit release (inside transaction)
      if (effectiveUnitRelease === 'AUTO' && unit) {
        await tx.unit.update({
          where: { id: contract.unitId },
          data: { status: UnitStatus.AVAILABLE },
        });
        await tx.unitStatusHistory.create({
          data: {
            unitId: contract.unitId,
            oldStatus: unit.status,
            newStatus: UnitStatus.AVAILABLE,
            changedById: actorId,
            reason: `Contract ${contractId} cancelled (AUTO release)`,
          },
        });
        await resetUnitWarranties(tx, contract.unitId);
        unitReleasedAt = now;
      }

      // 6b. The buyer no longer holds the unit: their open maintenance
      // requests on it close (whether or not the unit is released yet).
      await closeOpenMaintenance(tx, contract.unitId, contract.customerId, companyId);

      // 7. Customer demotion (inside transaction) — only when this was the
      // customer's last live contract, and only a CUSTOMER account: a buyer
      // with another unit keeps the app, and staff are never demoted.
      if (effectiveDemote) {
        const otherLive = await tx.contract.count({
          where: { customerId: contract.customerId, companyId, id: { not: contractId }, ...LIVE_CONTRACT_WHERE },
        });
        const demoted =
          otherLive === 0
            ? await tx.user.updateMany({
                where: { id: contract.customerId, companyId, role: 'CUSTOMER' },
                data: { role: 'CLIENT' },
              })
            : { count: 0 };
        if (demoted.count > 0) {
          await tx.refreshToken.updateMany({
            where: { userId: contract.customerId, revokedAt: null },
            data: { revokedAt: now },
          });
          customerDemotedAt = now;
        }
      }

      // 7b. The lead's sale fell through: WON → LOST, unless the same lead
      // still has another live contract (it bought another unit too).
      let leadLostId: string | null = null;
      const leadId = contract.reservation?.leadId ?? null;
      if (leadId) {
        const lead = await tx.lead.findFirst({ where: { id: leadId, companyId }, select: { stage: true } });
        const otherSale =
          lead?.stage === LeadStage.WON
            ? await tx.reservation.count({
                where: {
                  leadId,
                  companyId,
                  id: { not: contract.reservation!.id },
                  contract: { ...LIVE_CONTRACT_WHERE, id: { not: contractId } },
                },
              })
            : 1;
        if (otherSale === 0) {
          await tx.lead.update({ where: { id: leadId }, data: { stage: LeadStage.LOST } });
          await tx.leadActivity.create({
            data: {
              leadId,
              type: 'status_change',
              payload: { from: LeadStage.WON, to: LeadStage.LOST, reason: 'contract_cancelled', contractId },
            },
          });
          leadLostId = leadId;
        }
      }

      // 8. Create ContractCancellation row (operator amounts stored as-is)
      const cc = await tx.contractCancellation.create({
        data: {
          contractId,
          cancelledById: actorId,
          companyId,
          reason: input.reason,
          cancellationDate: now,
          totalCollectedSnapshot: totalCollected,
          retainedAmount: new Prisma.Decimal(input.retainedAmount),
          refundAmount: new Prisma.Decimal(input.refundAmount),
          financialNotes: input.financialNotes ?? null,
          unitReleaseOverride: input.unitReleaseOverride ?? null,
          demoteCustomerOverride: input.demoteCustomerOverride ?? null,
          commissionActionOverride: input.commissionActionOverride ?? null,
          bonusActionOverride: input.bonusActionOverride ?? null,
          policySnapshot: policySnapshot as unknown as Prisma.InputJsonValue,
          unitReleasedAt,
          customerDemotedAt,
        },
      });

      // 9. AuditLog — section 6.3
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.cancelled',
          entityType: 'Contract',
          entityId: contractId,
          before: {
            status: contract.status,
            signedAt: contract.signedAt?.toISOString() ?? null,
            totalAmount: contract.totalAmount?.toString() ?? null,
          },
          after: {
            status: ContractStatus.CANCELLED,
            cancellationId: cc.id,
            unitId: contract.unitId,
            unitReleaseMode: effectiveUnitRelease,
            customerId: contract.customerId,
            customerDemoted: effectiveDemote,
            totalCollectedSnapshot: Number(totalCollected),
            retainedAmount: input.retainedAmount,
            refundAmount: input.refundAmount,
            cancelledInstallmentsCount,
            cancelledInstrumentIds,
            leadLostId,
            commissionAction: effectiveCommissionAction,
            commissionClawbackIds,
            bonusAction: effectiveBonusAction,
            bonusClawbackIds,
            policySnapshot: policySnapshot as unknown as Prisma.InputJsonValue,
            reason: input.reason,
          },
          companyId,
        },
      });

      return cc;
    });

    // Post-transaction: best-effort customer notification (§4.3)
    try {
      await this.notifications.sendToUser(
        contract.customerId,
        'contract_cancelled_customer',
        { contractId },
      );
    } catch (e) {
      reportFailure(this.logger, 'notification', `contract_cancelled_customer notify failed for ${contractId}`, e);
    }
    // The sales person, the broker who brought the deal (agent + firm
    // managers), admins and sales managers — never whoever cancelled it.
    try {
      const deal = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: {
          contractNumber: true,
          brokerId: true,
          brokerAgentId: true,
          unit: { select: { code: true } },
          customer: { select: { fullName: true } },
          reservation: { select: { salesId: true } },
        },
      });
      const payload = {
        contractNumber: deal?.contractNumber ?? '',
        unitCode: deal?.unit?.code ?? '',
        customerName: deal?.customer?.fullName ?? '',
        contractId,
        entityType: 'contract',
        entityId: contractId,
      };
      const except = { except: actorId };
      const broker = await this.notifications.brokerRecipients(deal?.brokerId, { agentUserId: deal?.brokerAgentId });
      await this.notifications.sendToUsersAndRoles(
        [deal?.reservation?.salesId, ...broker],
        [UserRole.ADMIN, UserRole.SALES_MANAGER],
        'contract_cancelled_staff',
        payload,
        except,
      );
      // What the customer gets back, when anything.
      if (input.refundAmount > 0) {
        await this.notifications.sendToUser(
          contract.customerId,
          'contract_refund_due',
          { ...payload, refundAmount: input.refundAmount, retainedAmount: input.retainedAmount },
          except,
        );
      }
    } catch (e) {
      reportFailure(this.logger, 'notification', `contract_cancelled_staff notify failed for ${contractId}`, e);
    }

    return cancellation;
  }

  /**
   * Release the unit after a REQUIRES_APPROVAL cancellation.
   * The unit is flipped to AVAILABLE in a single $transaction; unitReleasedAt
   * is set on the ContractCancellation record.
   */
  async releaseUnit(contractId: string, actorId: string) {
    const companyId = getRequiredCompanyId();

    // Tenant-scoped — 404 if not found in this company
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId },
      select: { id: true, status: true, unitId: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== ContractStatus.CANCELLED) {
      throw new ConflictException('Contract is not cancelled');
    }

    const cc = await this.prisma.contractCancellation.findUnique({
      where: { contractId },
      select: { id: true, unitReleasedAt: true },
    });
    if (!cc) throw new NotFoundException('ContractCancellation record not found');
    if (cc.unitReleasedAt !== null) {
      throw new ConflictException('Unit has already been released');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: contract.unitId },
      select: { id: true, status: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // The unit may have been sold again since the cancellation (a new
      // contract on it, or a reservation that moved it on). Freeing it then
      // would put the new buyer's unit back on sale and wipe their
      // warranties: the release is recorded and the unit left as it is.
      const otherLive = await tx.contract.count({
        where: { unitId: contract.unitId, companyId, id: { not: contractId }, ...LIVE_CONTRACT_WHERE },
      });
      const freed =
        otherLive === 0
          ? await tx.unit.updateMany({
              where: { id: contract.unitId, companyId, status: UnitStatus.SOLD },
              data: { status: UnitStatus.AVAILABLE },
            })
          : { count: 0 };
      if (freed.count > 0) {
        await tx.unitStatusHistory.create({
          data: {
            unitId: contract.unitId,
            oldStatus: unit.status,
            newStatus: UnitStatus.AVAILABLE,
            changedById: actorId,
            reason: `Contract ${contractId} cancelled — unit released (REQUIRES_APPROVAL path)`,
          },
        });
        await resetUnitWarranties(tx, contract.unitId);
      }

      const updated = await tx.contractCancellation.update({
        where: { id: cc.id },
        data: { unitReleasedAt: now },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'contract.unit-released',
          entityType: 'Contract',
          entityId: contractId,
          before: { unitStatus: unit.status, unitReleasedAt: null },
          after: {
            unitStatus: freed.count > 0 ? UnitStatus.AVAILABLE : unit.status,
            unitReleasedAt: now.toISOString(),
            ...(freed.count > 0 ? {} : { unitLeftAsIs: otherLive > 0 ? 'sold again' : `unit is ${unit.status}` }),
          },
          companyId,
        },
      });

      return updated;
    });
  }
}
