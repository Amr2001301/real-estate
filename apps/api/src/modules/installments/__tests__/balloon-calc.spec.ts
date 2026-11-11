import { balloonOf, balloonProblem, computeDurationOption, financedRows } from '../duration-calc';

const base = { netPrice: 1_000_000, reservationAmount: 50_000, downPaymentAmount: 150_000, increasePercentage: 0 };

describe('balloon plans (big payment every few months beside the monthly one)', () => {
  it('splits the financed amount: 70% in a big payment every 3 months, the rest monthly', () => {
    const c = computeDurationOption({ ...base, durationMonths: 24, balloon: { sharePct: 70, everyMonths: 3 } });
    expect(c.financedAmount).toBe(800_000);
    expect(c.balloonCount).toBe(8);
    expect(c.balloonAmount).toBe(70_000); // 560,000 / 8
    expect(c.monthlyInstallment).toBe(10_000); // 240,000 / 24
    expect(c.balloonEveryMonths).toBe(3);
    expect(c.totalPayable).toBe(1_000_000);
  });

  it('an ordinary plan is unchanged', () => {
    const c = computeDurationOption({ ...base, durationMonths: 24 });
    expect(c).toMatchObject({ monthlyInstallment: 33_333.33, lastInstallment: 33_333.41, balloonAmount: 0, balloonCount: 0 });
  });

  it('100% in big payments: no monthly part, the cents on the last big payment', () => {
    const c = computeDurationOption({ ...base, netPrice: 1_000_000.01, durationMonths: 12, balloon: { sharePct: 100, everyMonths: 6 } });
    expect(c).toMatchObject({ monthlyInstallment: 0, balloonCount: 2, balloonAmount: 400_000, lastBalloon: 400_000.01 });
  });

  it('the contract rows add up to the financed amount, the big one in the 3rd, 6th … month', () => {
    const c = computeDurationOption({ ...base, netPrice: 1_000_000.07, durationMonths: 12, balloon: { sharePct: 60, everyMonths: 3 } });
    const rows = financedRows(Math.round(c.financedAmount * 100), 12, Math.round(c.monthlyInstallment * 100), {
      amount: Math.round(c.balloonAmount * 100),
      everyMonths: 3,
    });
    expect(rows.reduce((s, r) => s + r.cents, 0)).toBe(Math.round(c.financedAmount * 100));
    expect(rows.filter((r) => r.balloon).map((r) => r.monthIndex)).toEqual([2, 5, 8, 11]);
    expect(rows.filter((r) => !r.balloon)).toHaveLength(12);
  });

  it('an ordinary contract keeps its rows (the last carries the rounding)', () => {
    const rows = financedRows(100_001, 3, 33_333, null);
    expect(rows.map((r) => r.cents)).toEqual([33_333, 33_333, 33_335]);
  });

  it('checks the terms against each duration', () => {
    expect(balloonProblem({ sharePct: 70, everyMonths: 3 }, 24)).toBeNull();
    expect(balloonProblem({ sharePct: 70, everyMonths: 6 }, 27)).toMatch(/لا تنقسم/);
    expect(balloonProblem({ sharePct: 0, everyMonths: 3 }, 24)).toMatch(/نسبة/);
    expect(balloonProblem({ sharePct: 50, everyMonths: 4 }, 24)).toMatch(/3 أو 6 أو 12/);
    expect(balloonOf({ balloonSharePct: null, balloonEveryMonths: null })).toBeNull();
    expect(balloonOf({ balloonSharePct: 70, balloonEveryMonths: 3 })).toEqual({ sharePct: 70, everyMonths: 3 });
  });
});
