/**
 * BRK-4 — the arithmetic of the brokerage's financial report and its agents'
 * monthly targets, kept pure so the service and the tests read the same rules.
 * A deal counts in the month of its close day; only closed deals count.
 */
import { ListingKind } from '@prisma/client';
import { round2 } from './deal-math';

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" of a day. */
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** The first day of a "YYYY-MM" month and the first day of the next. */
export function monthBounds(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number) as [number, number];
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** Every month from `from` to `to`, both included ("YYYY-MM"). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let { start } = monthBounds(from);
  const last = monthBounds(to).start;
  while (start.getTime() <= last.getTime() && out.length < 240) {
    out.push(monthKey(start));
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  }
  return out;
}

/** The month `n` months before `period`. */
export function shiftMonth(period: string, n: number): string {
  const { start } = monthBounds(period);
  return monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - n, 1)));
}

export interface ReportDeal {
  kind: ListingKind;
  closedOn: Date;
  agentId: string | null;
  dealValue: number;
  commissionTotal: number;
  commissionReceived: number;
}

export interface ReportSplit {
  userId: string;
  closedOn: Date;
  amount: number;
  paid: boolean;
}

export interface Figures {
  deals: number;
  dealValue: number;
  commission: number;
  received: number;
}

const zero = (): Figures => ({ deals: 0, dealValue: 0, commission: 0, received: 0 });
function add(f: Figures, d: ReportDeal) {
  f.deals += 1;
  f.dealValue = round2(f.dealValue + d.dealValue);
  f.commission = round2(f.commission + d.commissionTotal);
  f.received = round2(f.received + d.commissionReceived);
}

/**
 * The report over the months `from`..`to`: the totals (with what the staff
 * earn and what the company keeps), by kind, by agent, and a month-by-month
 * trend. `deals` and `splits` may hold months outside the range (for the
 * trend); the totals keep to the range.
 */
export function buildReport(
  deals: ReportDeal[],
  splits: ReportSplit[],
  from: string,
  to: string,
  trendMonths: string[],
) {
  const inRange = (d: Date) => {
    const k = monthKey(d);
    return k >= from && k <= to;
  };
  const totals = zero();
  const byKind = new Map<ListingKind, Figures>();
  const byAgent = new Map<string, Figures & { shares: number; sharesPaid: number }>();
  const trend = new Map(trendMonths.map((m) => [m, zero()]));

  for (const d of deals) {
    const month = trend.get(monthKey(d.closedOn));
    if (month) add(month, d);
    if (!inRange(d.closedOn)) continue;
    add(totals, d);
    if (!byKind.has(d.kind)) byKind.set(d.kind, zero());
    add(byKind.get(d.kind)!, d);
    if (d.agentId) {
      if (!byAgent.has(d.agentId)) byAgent.set(d.agentId, { ...zero(), shares: 0, sharesPaid: 0 });
      add(byAgent.get(d.agentId)!, d);
    }
  }
  let shares = 0;
  let sharesPaid = 0;
  for (const s of splits) {
    if (!inRange(s.closedOn)) continue;
    shares = round2(shares + s.amount);
    if (s.paid) sharesPaid = round2(sharesPaid + s.amount);
    if (!byAgent.has(s.userId)) byAgent.set(s.userId, { ...zero(), shares: 0, sharesPaid: 0 });
    const a = byAgent.get(s.userId)!;
    a.shares = round2(a.shares + s.amount);
    if (s.paid) a.sharesPaid = round2(a.sharesPaid + s.amount);
  }
  return {
    totals: {
      ...totals,
      outstanding: round2(totals.commission - totals.received),
      staffShares: shares,
      staffSharesPaid: sharesPaid,
      companyNet: round2(totals.commission - shares),
    },
    byKind: [ListingKind.PRIMARY, ListingKind.RESALE, ListingKind.RENT].map((kind) => ({
      kind,
      ...(byKind.get(kind) ?? zero()),
    })),
    byAgent: [...byAgent.entries()]
      .map(([userId, f]) => ({ userId, ...f }))
      .sort((a, b) => b.commission - a.commission || b.shares - a.shares),
    trend: trendMonths.map((month) => ({ month, ...trend.get(month)! })),
  };
}

/** How far an agent is towards a month's target; both goals must be met. */
export function targetProgress(
  t: { commissionTarget: number; dealsTarget: number },
  actual: { commission: number; deals: number },
) {
  const commissionPct =
    t.commissionTarget > 0 ? Math.round((actual.commission / t.commissionTarget) * 100) : 100;
  const dealsPct = t.dealsTarget > 0 ? Math.round((actual.deals / t.dealsTarget) * 100) : 100;
  return {
    commissionPct,
    dealsPct,
    achieved: actual.commission >= t.commissionTarget && actual.deals >= t.dealsTarget,
  };
}
