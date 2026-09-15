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
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BonusEntryStatus,
  BrokerCommissionStatus,
  ClawbackStatus,
  ContractStatus,
  InstallmentStatus,
  Prisma,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { NotificationsService } from '../notifications/notifications.module';
import { CancellationPolicyService } from './cancellation-policy.service';
import type { CancellationPolicySnapshot } from './cancellation-settings.constants';

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

/** A commission is "effectively paid" when it's attached to a payout that has
 *  left DRAFT state (APPROVED, PROCESSING, or PAID). Hard Rule 2 applies. */
function isCommissionEffectivelyPaid(commission: {
  payoutId: string | null;
  payout?: { status: string } | null;
}): boolean {
  if (!commission.payoutId) return false;
  const s = commission.payout?.status ?? '';
  return s === 'APPROVED' || s === 'PROCESSING' || s === 'PAID';
}

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
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === ContractStatus.CANCELLED) {
      throw new ConflictException('Contract is already cancelled — CANCELLED is terminal');
    }

    // Compute totalCollectedSnapshot (sum of APPROVED deposits)
    const depositsAgg = await this.prisma.deposit.aggregate({
      where: { contractId, reviewStatus: 'APPROVED', deletedAt: null },
      _sum: { amount: true },
    });
    const totalCollected = depositsAgg._sum.amount ?? new Prisma.Decimal(0);

    // Read policy settings for policySnapshot (suggestion layer only)
    const suggestion = await this.cancellationPolicy.getCancellationSuggestion(contractId);
    const policySnapshot: CancellationPolicySnapshot = suggestion.policySnapshot;

    // Resolve effective overrides (operator per-transaction > tenant setting)
    const effectiveUnitRelease = input.unitReleaseOverride ?? suggestion.policySnapshot.unitRelease;
    const effectiveCommissionAction = input.commissionActionOverride ?? suggestion.policySnapshot.commissionAction;
    const effectiveBonusAction = input.bonusActionOverride ?? suggestion.policySnapshot.bonusAction;
    const effectiveDemote = input.demoteCustomerOverride ?? suggestion.policySnapshot.demoteClient;

    // Commission (at most 1 per contract, contractId @unique)
    const commission = await this.prisma.brokerCommission.findUnique({
      where: { contractId },
      include: { payout: { select: { status: true } } },
    });

    // Bonus entry auto-generated for this contract (at most 1, contractId @unique)
    const bonusEntry = await this.prisma.bonusEntry.findUnique({
      where: { contractId },
      select: { id: true, status: true, clawbackStatus: true },
    });

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

    const cancellation = await this.prisma.$transaction(async (tx) => {
      // 1. Contract → CANCELLED
      await tx.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.CANCELLED, cancelledAt: now },
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

      // 4. Commission handling (CLAWBACK action only; RETAIN/MANUAL = no change)
      if (commission && commission.status !== BrokerCommissionStatus.REJECTED && commission.status !== BrokerCommissionStatus.CANCELLED) {
        if (effectiveCommissionAction === 'CLAWBACK') {
          if (isCommissionEffectivelyPaid(commission)) {
            // Hard Rule 2: status stays; clawback overlay added
            await tx.brokerCommission.update({
              where: { id: commission.id },
              data: {
                clawbackStatus: ClawbackStatus.OUTSTANDING,
                clawbackReason: input.clawbackReason ?? input.reason,
                clawbackAt: now,
                clawbackById: actorId,
              },
            });
            commissionClawbackIds.push(commission.id);
          } else {
            // Not paid — cancel it
            await tx.brokerCommission.update({
              where: { id: commission.id },
              data: { status: BrokerCommissionStatus.CANCELLED },
            });
          }
        }
      }

      // 5. Bonus handling (same pattern as commission)
      if (bonusEntry && bonusEntry.status !== BonusEntryStatus.CANCELLED) {
        if (effectiveBonusAction === 'CLAWBACK') {
          if (bonusEntry.status === BonusEntryStatus.PAID) {
            // Hard Rule 2: status stays PAID; clawback overlay added
            await tx.bonusEntry.update({
              where: { id: bonusEntry.id },
              data: {
                clawbackStatus: ClawbackStatus.OUTSTANDING,
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
        unitReleasedAt = now;
      }

      // 7. Customer demotion (inside transaction)
      if (effectiveDemote) {
        await tx.user.update({
          where: { id: contract.customerId },
          data: { role: 'CLIENT' },
        });
        await tx.refreshToken.updateMany({
          where: { userId: contract.customerId, revokedAt: null },
          data: { revokedAt: now },
        });
        customerDemotedAt = now;
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
      this.logger.warn(`contract_cancelled_customer notify failed for ${contractId}: ${(e as Error).message}`);
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
          reason: `Contract ${contractId} cancelled — unit released (REQUIRES_APPROVAL path)`,
        },
      });

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
          after: { unitStatus: UnitStatus.AVAILABLE, unitReleasedAt: now.toISOString() },
          companyId,
        },
      });

      return updated;
    });
  }
}
