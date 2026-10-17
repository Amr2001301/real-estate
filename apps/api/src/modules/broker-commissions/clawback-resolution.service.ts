import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClawbackStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { rebalancePayout } from '../broker-payouts/payout-totals';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CollectClawbackDto,
  WaiveClawbackDto,
} from './dto/broker-commission.dto';

// Resolvable states — OUTSTANDING means nothing collected yet; PARTIALLY_COLLECTED
// means partial repayment has been received and more is still owed.
const RESOLVABLE: ClawbackStatus[] = [
  ClawbackStatus.OUTSTANDING,
  ClawbackStatus.PARTIALLY_COLLECTED,
];

/** A collection may not take more than is still owed. */
function assertWithinOutstanding(
  fullAmount: Prisma.Decimal,
  collectedSoFar: Prisma.Decimal | null,
  amount: number,
) {
  const outstanding = fullAmount.sub(collectedSoFar ?? 0);
  if (new Prisma.Decimal(amount).gt(outstanding)) {
    throw new BadRequestException(
      `المبلغ أكبر من المتبقي على الاسترداد (${outstanding.toFixed(2)})`,
    );
  }
}

/**
 * Lock the row and check it is still in the clawback state that was read:
 * the same status and the same amount collected so far. A concurrent collect
 * or waive that got there first leaves this one with nothing to change → 409.
 */
async function claimClawback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: { updateMany: (args: any) => Promise<{ count: number }> },
  id: string,
  seen: { clawbackStatus: ClawbackStatus | null; clawbackCollectedAmount: Prisma.Decimal | null },
) {
  const claimed = await delegate.updateMany({
    where: {
      id,
      clawbackStatus: seen.clawbackStatus,
      clawbackCollectedAmount: seen.clawbackCollectedAmount,
    },
    data: { clawbackStatus: seen.clawbackStatus },
  });
  if (claimed.count === 0) {
    throw new ConflictException('تغيّر الاسترداد أثناء التنفيذ — حدّث الصفحة وأعد المحاولة');
  }
}

/**
 * A cancellation clawback is also queued for the broker's next payout
 * (settlesClawback adjustments). Collecting or waiving it by hand takes it
 * off that queue: `amount` (or everything, for a waive) comes out of the open
 * rows and those netted into draft payouts, which are then rebalanced. What a
 * payout already approved or being sent deducts cannot be touched: a waive,
 * or a collection reaching into it, is refused (409).
 */
async function takeOffPayoutQueue(
  tx: Prisma.TransactionClient,
  commissionId: string,
  amount: Prisma.Decimal | 'all',
) {
  const rows = await tx.brokerCommissionAdjustment.findMany({
    where: { commissionId, kind: 'CLAWBACK', settlesClawback: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, amount: true, brokerId: true, payoutId: true, payout: { select: { status: true } } },
  });
  const free = rows.filter((r) => !r.payout || r.payout.status === 'DRAFT');
  const locked = rows.filter((r) => r.payout && (r.payout.status === 'APPROVED' || r.payout.status === 'PROCESSING'));
  const available = free.reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));
  // Collecting more than the queue still holds would count what a payout
  // is deducting right now twice. (A clawback never queued — from before
  // netting existed — has no rows at all and is collected as before.)
  if (locked.length > 0 && (amount === 'all' || amount.gt(available))) {
    throw new ConflictException('جزء من الاسترداد يُخصم الآن من دفعة معتمدة أو قيد الصرف — انتظر صرفها أو ألغِها أولاً');
  }
  // Open rows first, then those on draft payouts.
  free.sort((a, b) => Number(!!a.payoutId) - Number(!!b.payoutId));
  let left = amount === 'all' || amount.gt(available) ? available : amount;
  const drafts = new Map<string, string>();
  for (const r of free) {
    if (!left.isPositive()) break;
    if (r.amount.lte(left)) {
      await tx.brokerCommissionAdjustment.delete({ where: { id: r.id } });
      left = left.sub(r.amount);
    } else {
      await tx.brokerCommissionAdjustment.update({ where: { id: r.id }, data: { amount: r.amount.sub(left) } });
      left = new Prisma.Decimal(0);
    }
    if (r.payoutId) drafts.set(r.payoutId, r.brokerId);
  }
  for (const [payoutId, brokerId] of drafts) await rebalancePayout(tx, payoutId, brokerId);
}

@Injectable()
export class ClawbackResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── BrokerCommission clawback resolve ─────────────────────────────────────

  async collectCommission(
    id: string,
    dto: CollectClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const commission = await this.prisma.brokerCommission.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
        netAmount: true,
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (!commission.clawbackStatus) {
      throw new ConflictException(
        'This commission has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be resolved',
      );
    }
    if (!RESOLVABLE.includes(commission.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${commission.clawbackStatus}; cannot resolve again`,
      );
    }

    const collected = dto.amount;
    const previouslyCollected = commission.clawbackCollectedAmount
      ? Number(commission.clawbackCollectedAmount)
      : 0;
    const newTotal = new Prisma.Decimal(previouslyCollected).add(new Prisma.Decimal(collected));
    const fullAmount = commission.netAmount;
    assertWithinOutstanding(fullAmount, commission.clawbackCollectedAmount, collected);
    const newStatus: ClawbackStatus = newTotal.gte(fullAmount)
      ? ClawbackStatus.COLLECTED
      : ClawbackStatus.PARTIALLY_COLLECTED;

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Only from the state read above: two collections at the same moment
      // both added to the same old total, and one was lost.
      await claimClawback(tx.brokerCommission, id, commission);
      await takeOffPayoutQueue(tx, id, new Prisma.Decimal(collected));
      const updated = await tx.brokerCommission.update({
        where: { id },
        data: {
          // Hard Rule 2: commission.status is NEVER changed
          clawbackStatus: newStatus,
          clawbackCollectedAt: now,
          clawbackCollectedById: actor.sub,
          clawbackCollectedAmount: newTotal,
          clawbackCollectedReference: dto.reference ?? null,
          clawbackCollectedPaymentMethod: dto.paymentMethod,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'commission.clawback.collected',
          entityType: 'BrokerCommission',
          entityId: id,
          before: {
            clawbackStatus: commission.clawbackStatus,
            clawbackCollectedAmount: commission.clawbackCollectedAmount?.toString() ?? null,
            commissionStatus: commission.status,
          },
          after: {
            clawbackStatus: newStatus,
            collectedThisCall: collected,
            clawbackCollectedAmount: newTotal.toString(),
            clawbackCollectedReference: dto.reference ?? null,
            clawbackCollectedPaymentMethod: dto.paymentMethod,
            fullAmount: fullAmount.toString(),
            commissionStatusUnchanged: commission.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }

  async waiveCommission(
    id: string,
    dto: WaiveClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const commission = await this.prisma.brokerCommission.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
      },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (!commission.clawbackStatus) {
      throw new ConflictException(
        'This commission has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be waived',
      );
    }
    if (!RESOLVABLE.includes(commission.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${commission.clawbackStatus}; cannot waive again`,
      );
    }

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await claimClawback(tx.brokerCommission, id, commission);
      await takeOffPayoutQueue(tx, id, 'all');
      const updated = await tx.brokerCommission.update({
        where: { id },
        data: {
          // Hard Rule 2: commission.status is NEVER changed
          clawbackStatus: ClawbackStatus.WAIVED,
          clawbackWaivedAt: now,
          clawbackWaivedById: actor.sub,
          clawbackWaiveReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'commission.clawback.waived',
          entityType: 'BrokerCommission',
          entityId: id,
          before: {
            clawbackStatus: commission.clawbackStatus,
            clawbackCollectedAmount: commission.clawbackCollectedAmount?.toString() ?? null,
            commissionStatus: commission.status,
          },
          after: {
            clawbackStatus: ClawbackStatus.WAIVED,
            clawbackWaiveReason: reason,
            commissionStatusUnchanged: commission.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }

  // ── BonusEntry clawback resolve ──────────────────────────────────────────
  // Simpler path: BonusEntryStatus has a real PAID value; no payout batching.

  async collectBonus(
    id: string,
    dto: CollectClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const bonus = await this.prisma.bonusEntry.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
        amount: true,
      },
    });
    if (!bonus) throw new NotFoundException('BonusEntry not found');
    if (!bonus.clawbackStatus) {
      throw new ConflictException(
        'This bonus entry has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be resolved',
      );
    }
    if (!RESOLVABLE.includes(bonus.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${bonus.clawbackStatus}; cannot resolve again`,
      );
    }

    const collected = dto.amount;
    const previouslyCollected = bonus.clawbackCollectedAmount
      ? Number(bonus.clawbackCollectedAmount)
      : 0;
    const newTotal = new Prisma.Decimal(previouslyCollected).add(new Prisma.Decimal(collected));
    const fullAmount = bonus.amount;
    assertWithinOutstanding(fullAmount, bonus.clawbackCollectedAmount, collected);
    const newStatus: ClawbackStatus = newTotal.gte(fullAmount)
      ? ClawbackStatus.COLLECTED
      : ClawbackStatus.PARTIALLY_COLLECTED;

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Only from the state read above: two collections at the same moment
      // both added to the same old total, and one was lost.
      await claimClawback(tx.bonusEntry, id, bonus);
      const updated = await tx.bonusEntry.update({
        where: { id },
        data: {
          // Hard Rule 2: bonusEntry.status is NEVER changed
          clawbackStatus: newStatus,
          clawbackCollectedAt: now,
          clawbackCollectedById: actor.sub,
          clawbackCollectedAmount: newTotal,
          clawbackCollectedReference: dto.reference ?? null,
          clawbackCollectedPaymentMethod: dto.paymentMethod,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'bonus.clawback.collected',
          entityType: 'BonusEntry',
          entityId: id,
          before: {
            clawbackStatus: bonus.clawbackStatus,
            clawbackCollectedAmount: bonus.clawbackCollectedAmount?.toString() ?? null,
            bonusStatus: bonus.status,
          },
          after: {
            clawbackStatus: newStatus,
            collectedThisCall: collected,
            clawbackCollectedAmount: newTotal.toString(),
            clawbackCollectedReference: dto.reference ?? null,
            clawbackCollectedPaymentMethod: dto.paymentMethod,
            fullAmount: fullAmount.toString(),
            bonusStatusUnchanged: bonus.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }

  async waiveBonus(
    id: string,
    dto: WaiveClawbackDto,
    actor: AuthUser,
  ) {
    const companyId = getRequiredCompanyId();

    const bonus = await this.prisma.bonusEntry.findFirst({
      where: { id },
      select: {
        id: true,
        status: true,
        clawbackStatus: true,
        clawbackCollectedAmount: true,
      },
    });
    if (!bonus) throw new NotFoundException('BonusEntry not found');
    if (!bonus.clawbackStatus) {
      throw new ConflictException(
        'This bonus entry has no active clawback; only OUTSTANDING or PARTIALLY_COLLECTED clawbacks can be waived',
      );
    }
    if (!RESOLVABLE.includes(bonus.clawbackStatus)) {
      throw new ConflictException(
        `Clawback is already ${bonus.clawbackStatus}; cannot waive again`,
      );
    }

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await claimClawback(tx.bonusEntry, id, bonus);
      const updated = await tx.bonusEntry.update({
        where: { id },
        data: {
          // Hard Rule 2: bonusEntry.status is NEVER changed
          clawbackStatus: ClawbackStatus.WAIVED,
          clawbackWaivedAt: now,
          clawbackWaivedById: actor.sub,
          clawbackWaiveReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'bonus.clawback.waived',
          entityType: 'BonusEntry',
          entityId: id,
          before: {
            clawbackStatus: bonus.clawbackStatus,
            clawbackCollectedAmount: bonus.clawbackCollectedAmount?.toString() ?? null,
            bonusStatus: bonus.status,
          },
          after: {
            clawbackStatus: ClawbackStatus.WAIVED,
            clawbackWaiveReason: reason,
            bonusStatusUnchanged: bonus.status,
          },
          companyId,
        },
      });

      return updated;
    });
  }
}
