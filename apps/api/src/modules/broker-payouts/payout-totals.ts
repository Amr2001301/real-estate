import { BrokerCommissionAdjustmentKind, ClawbackStatus, Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

/**
 * Take the adjustments off whatever payouts `where` selects and leave them
 * open for the next payout. A clawback split across payouts (see
 * rebalancePayout) is joined back to its open remainder, so a commission
 * keeps one open row per kind.
 */
export async function releaseAdjustments(
  tx: Prisma.TransactionClient,
  where: Prisma.BrokerCommissionAdjustmentWhereInput,
) {
  const rows = await tx.brokerCommissionAdjustment.findMany({
    where: { AND: [where, { payoutId: { not: null } }] },
    select: { id: true, commissionId: true, kind: true, settlesClawback: true, amount: true },
  });
  for (const r of rows) {
    const open = await tx.brokerCommissionAdjustment.findFirst({
      where: { commissionId: r.commissionId, kind: r.kind, settlesClawback: r.settlesClawback, payoutId: null },
      select: { id: true },
    });
    if (open) {
      await tx.brokerCommissionAdjustment.update({ where: { id: open.id }, data: { amount: { increment: r.amount } } });
      await tx.brokerCommissionAdjustment.delete({ where: { id: r.id } });
    } else {
      await tx.brokerCommissionAdjustment.update({ where: { id: r.id }, data: { payoutId: null } });
    }
  }
}

/**
 * A draft payout's contents and totals. It pays its approved commissions,
 * plus the broker's open top-ups, less the broker's open clawbacks (decided
 * 2026-10-16/17: a paid commission whose contract price changed, or whose
 * deal was cancelled, is settled in the next payout). Clawbacks are taken
 * oldest first while the payout stays positive; one larger than what is left
 * is split — the payout takes what fits, the rest waits for the next one.
 *
 * Gross, tax and withholding are the commissions'; the net is what the broker
 * receives, adjustments included. Run on a DRAFT payout whenever its
 * commissions change.
 */
export async function rebalancePayout(tx: Prisma.TransactionClient, payoutId: string, brokerId: string) {
  // Give back what was netted here and net the broker's open ones afresh.
  await releaseAdjustments(tx, { payoutId });
  const agg = await tx.brokerCommission.aggregate({
    // Only approved commissions are paid out.
    where: { payoutId, status: 'APPROVED' },
    _sum: { grossAmount: true, taxAmount: true, withholdingAmount: true, netAmount: true },
  });
  const open = await tx.brokerCommissionAdjustment.findMany({
    where: { brokerId, payoutId: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, kind: true, amount: true },
  });
  let net = agg._sum.netAmount ?? ZERO;
  const taken: string[] = [];
  for (const a of open) {
    if (a.kind === BrokerCommissionAdjustmentKind.TOP_UP) {
      net = net.add(a.amount);
      taken.push(a.id);
    }
  }
  for (const a of open) {
    if (a.kind !== BrokerCommissionAdjustmentKind.CLAWBACK || !net.isPositive()) continue;
    if (a.amount.lte(net)) {
      net = net.sub(a.amount);
      taken.push(a.id);
    } else {
      // Split: this payout takes what fits, a new open row keeps the rest.
      const whole = await tx.brokerCommissionAdjustment.findUniqueOrThrow({ where: { id: a.id } });
      await tx.brokerCommissionAdjustment.create({
        data: {
          brokerId: whole.brokerId,
          commissionId: whole.commissionId,
          kind: whole.kind,
          amount: a.amount.sub(net),
          reason: whole.reason,
          createdById: whole.createdById,
          createdAt: whole.createdAt,
          settlesClawback: whole.settlesClawback,
          companyId: whole.companyId,
        },
      });
      await tx.brokerCommissionAdjustment.update({ where: { id: a.id }, data: { amount: net } });
      taken.push(a.id);
      net = ZERO;
    }
  }
  if (taken.length > 0) {
    await tx.brokerCommissionAdjustment.updateMany({ where: { id: { in: taken } }, data: { payoutId } });
  }
  await tx.brokerPayout.update({
    where: { id: payoutId },
    data: {
      totalGross: agg._sum.grossAmount ?? ZERO,
      totalTax: agg._sum.taxAmount ?? ZERO,
      totalWithholding: agg._sum.withholdingAmount ?? ZERO,
      totalNet: net,
    },
  });
}

/**
 * The payout is paid: the cancellation clawbacks it netted are recorded as
 * collected on their commissions (by that amount, through this payout).
 */
export async function settleNettedClawbacks(
  tx: Prisma.TransactionClient,
  payout: { id: string; payoutNumber: string },
  actorId: string,
  at: Date,
) {
  const rows = await tx.brokerCommissionAdjustment.findMany({
    where: { payoutId: payout.id, kind: BrokerCommissionAdjustmentKind.CLAWBACK, settlesClawback: true },
    select: { commissionId: true, amount: true },
  });
  for (const r of rows) {
    const c = await tx.brokerCommission.findUniqueOrThrow({
      where: { id: r.commissionId },
      select: { netAmount: true, clawbackCollectedAmount: true },
    });
    const collected = (c.clawbackCollectedAmount ?? ZERO).add(r.amount);
    await tx.brokerCommission.update({
      where: { id: r.commissionId },
      data: {
        clawbackCollectedAmount: collected,
        clawbackStatus: collected.gte(c.netAmount) ? ClawbackStatus.COLLECTED : ClawbackStatus.PARTIALLY_COLLECTED,
        clawbackCollectedAt: at,
        clawbackCollectedById: actorId,
        clawbackCollectedReference: payout.payoutNumber,
      },
    });
  }
}
