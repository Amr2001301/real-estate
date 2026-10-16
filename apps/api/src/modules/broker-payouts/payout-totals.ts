import { BrokerCommissionAdjustmentKind, Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

/**
 * A draft payout's contents and totals. It pays its approved commissions,
 * plus the broker's open top-ups, less the broker's open clawbacks (decided
 * 2026-10-16: a paid commission whose contract price changed is settled in
 * the next payout). A clawback is netted only while the payout stays
 * positive; one that does not fit waits for the following payout.
 *
 * Gross, tax and withholding are the commissions'; the net is what the broker
 * receives, adjustments included. Run on a DRAFT payout whenever its
 * commissions change.
 */
export async function rebalancePayout(tx: Prisma.TransactionClient, payoutId: string, brokerId: string) {
  // Give back what was netted here and net the broker's open ones afresh.
  await tx.brokerCommissionAdjustment.updateMany({ where: { payoutId }, data: { payoutId: null } });
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
    if (a.kind === BrokerCommissionAdjustmentKind.CLAWBACK && a.amount.lte(net)) {
      net = net.sub(a.amount);
      taken.push(a.id);
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
