/**
 * BRK-4 — the brokerage report's figures and a target's progress.
 */
import { ListingKind } from '@prisma/client';
import { buildReport, monthsBetween, shiftMonth, targetProgress } from '../deal-report';

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('months', () => {
  it('runs across a year end, both ends included', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(shiftMonth('2027-02', 11)).toBe('2026-03');
  });
});

describe('buildReport', () => {
  const deals = [
    {
      kind: ListingKind.PRIMARY,
      closedOn: day('2026-11-03'),
      agentId: 'a',
      dealValue: 6_400_000,
      commissionTotal: 192_000,
      commissionReceived: 100_000,
    },
    {
      kind: ListingKind.RESALE,
      closedOn: day('2026-11-20'),
      agentId: 'b',
      dealValue: 2_000_000,
      commissionTotal: 50_000,
      commissionReceived: 50_000,
    },
    // Outside the range: only in the trend.
    {
      kind: ListingKind.RENT,
      closedOn: day('2026-10-15'),
      agentId: 'a',
      dealValue: 456_000,
      commissionTotal: 38_000,
      commissionReceived: 38_000,
    },
  ];
  const splits = [
    { userId: 'a', closedOn: day('2026-11-03'), amount: 57_600, paid: false },
    { userId: 'm', closedOn: day('2026-11-03'), amount: 9_600, paid: false },
    { userId: 'b', closedOn: day('2026-11-20'), amount: 20_000, paid: true },
    { userId: 'a', closedOn: day('2026-10-15'), amount: 19_000, paid: true },
  ];
  const r = buildReport(deals, splits, '2026-11', '2026-11', monthsBetween('2026-09', '2026-11'));

  it('totals the range: commission, collected, the staff shares and what the company keeps', () => {
    expect(r.totals).toEqual({
      deals: 2,
      dealValue: 8_400_000,
      commission: 242_000,
      received: 150_000,
      outstanding: 92_000,
      staffShares: 87_200,
      staffSharesPaid: 20_000,
      companyNet: 154_800,
    });
  });

  it('splits by kind and by agent, the best first; a manager shows by their shares', () => {
    expect(r.byKind.map((k) => [k.kind, k.deals])).toEqual([
      ['PRIMARY', 1],
      ['RESALE', 1],
      ['RENT', 0],
    ]);
    expect(r.byAgent.map((a) => [a.userId, a.commission, a.shares])).toEqual([
      ['a', 192_000, 57_600],
      ['b', 50_000, 20_000],
      ['m', 0, 9_600],
    ]);
  });

  it('the trend runs month by month, including the months before the range', () => {
    expect(r.trend.map((t) => [t.month, t.commission])).toEqual([
      ['2026-09', 0],
      ['2026-10', 38_000],
      ['2026-11', 242_000],
    ]);
  });
});

describe('targetProgress', () => {
  it('needs both goals met', () => {
    expect(
      targetProgress(
        { commissionTarget: 100_000, dealsTarget: 2 },
        { commission: 120_000, deals: 1 },
      ),
    ).toEqual({ commissionPct: 120, dealsPct: 50, achieved: false });
    expect(
      targetProgress(
        { commissionTarget: 100_000, dealsTarget: 2 },
        { commission: 100_000, deals: 2 },
      ).achieved,
    ).toBe(true);
  });
  it('a goal of zero is met already', () => {
    expect(
      targetProgress({ commissionTarget: 0, dealsTarget: 3 }, { commission: 0, deals: 3 }),
    ).toEqual({ commissionPct: 100, dealsPct: 100, achieved: true });
  });
});
