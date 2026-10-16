import { computeDurationOption } from '../duration-calc';
import { addMonths } from '../../../common/utils/add-months';
import { startOfLocalToday } from '../../../common/time/company-timezone';

describe('computeDurationOption', () => {
  it('takes the final payment out before the monthly split — billed once, not twice', () => {
    const r = computeDurationOption({
      netPrice: 1_000_000,
      reservationAmount: 0,
      downPaymentAmount: 100_000,
      finalPaymentAmount: 100_000,
      durationMonths: 60,
      increasePercentage: 0,
    });
    expect(r.monthlyInstallment).toBe(13_333.33);
    // 59 equal rows + the last one with the rounding + the final row = the price.
    const schedule = 100_000 + r.monthlyInstallment * 59 + r.lastInstallment + r.finalPaymentAmount;
    expect(Math.round(schedule * 100)).toBe(1_000_000 * 100);
    expect(r.totalPayable).toBe(1_000_000);
  });

  it('the increase applies to the financed part, not the final payment', () => {
    const r = computeDurationOption({
      netPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentAmount: 150_000,
      finalPaymentAmount: 200_000,
      durationMonths: 12,
      increasePercentage: 10,
    });
    expect(r.remainingAmount).toBe(600_000);
    expect(r.financedAmount).toBe(660_000);
    expect(r.totalPayable).toBe(50_000 + 150_000 + 660_000 + 200_000);
  });

  it('rows add up to the cent when the split does not divide evenly', () => {
    const r = computeDurationOption({
      netPrice: 850_000,
      reservationAmount: 0,
      downPaymentAmount: 0,
      durationMonths: 36,
      increasePercentage: 0,
    });
    expect(r.monthlyInstallment).toBe(23_611.11);
    expect(r.lastInstallment).toBe(23_611.15);
    expect(Math.round((r.monthlyInstallment * 35 + r.lastInstallment) * 100)).toBe(85_000_000);
  });
});

describe('addMonths', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);

  it('clamps to the end of a short month instead of spilling into the next', () => {
    expect(addMonths(d('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(d('2026-01-31'), 2).toISOString().slice(0, 10)).toBe('2026-03-31');
    expect(addMonths(d('2026-01-31'), 3).toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  it('gives one due date per month for a plan starting on the 31st', () => {
    const months = Array.from({ length: 12 }, (_, i) => addMonths(d('2026-01-31'), i).getUTCMonth());
    expect(months).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('startOfLocalToday', () => {
  it('is the local calendar day, not the UTC one', () => {
    // 23:30 UTC on Nov 1 is already Nov 2 in Cairo.
    const now = new Date('2026-11-01T23:30:00Z');
    expect(startOfLocalToday('Africa/Cairo', now).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(startOfLocalToday('UTC', now).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('a row due today is not before the cut — it turns overdue the day after', () => {
    const due = new Date('2026-11-01T00:00:00Z');
    expect(due < startOfLocalToday('Africa/Cairo', new Date('2026-10-31T23:00:00Z'))).toBe(false); // 01:00 Nov 1 Cairo
    expect(due < startOfLocalToday('Africa/Cairo', new Date('2026-11-01T22:30:00Z'))).toBe(true); // 00:30 Nov 2 Cairo
  });

  it('falls back to Cairo for an invalid zone', () => {
    const now = new Date('2026-11-01T23:30:00Z');
    expect(startOfLocalToday('Mars/Base', now)).toEqual(startOfLocalToday('Africa/Cairo', now));
  });
});
