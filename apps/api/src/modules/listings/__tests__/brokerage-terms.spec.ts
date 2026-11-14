/**
 * BRK-2 — the rent schedule and mandate states the service, the reminders
 * and the dashboard all read.
 */
import { day, daysUntil, leaseMonths, mandateState, rentSchedule } from '../brokerage-terms';

describe('rentSchedule', () => {
  const t = { startDate: day('2026-03-10'), endDate: day('2027-03-09'), paymentDay: 5, monthlyRent: 20_000 };

  it('owes one month per calendar month of the term, due on the payment day', () => {
    const rows = rentSchedule(t, [], day('2026-01-01'));
    expect(rows).toHaveLength(12);
    // The tenancy starts after the 5th: the first month falls due on the start day.
    expect(rows[0]).toMatchObject({ period: '2026-03', dueDate: '2026-03-10', state: 'UPCOMING' });
    expect(rows[1]).toMatchObject({ period: '2026-04', dueDate: '2026-04-05' });
    // A 12-month lease owes 12 months, the last one in February.
    expect(rows[11]).toMatchObject({ period: '2027-02', dueDate: '2027-02-05' });
  });

  it('owes one payment per lease month, a part month counting whole', () => {
    expect(leaseMonths(day('2026-03-10'), day('2027-03-09'))).toBe(12);
    expect(leaseMonths(day('2026-01-01'), day('2026-12-31'))).toBe(12);
    expect(leaseMonths(day('2026-03-10'), day('2026-06-09'))).toBe(3);
    expect(leaseMonths(day('2026-03-10'), day('2026-06-20'))).toBe(4);
  });

  it('reads paid, overdue, due today and upcoming against today', () => {
    const rows = rentSchedule(t, [{ period: '2026-03', amount: 20_000, paidOn: day('2026-03-10') }], day('2026-05-05'));
    expect(rows.slice(0, 4).map((r) => r.state)).toEqual(['PAID', 'OVERDUE', 'DUE_TODAY', 'UPCOMING']);
    expect(rows[0]!.paid).toEqual({ amount: 20_000, paidOn: '2026-03-10' });
  });

  it('caps the payment day at 28', () => {
    const rows = rentSchedule({ ...t, paymentDay: 31 }, [], day('2026-01-01'));
    expect(rows[1]!.dueDate).toBe('2026-04-28');
  });
});

describe('mandateState', () => {
  const m = { startDate: day('2026-05-01'), endDate: day('2026-05-31'), cancelledAt: null };
  it('is upcoming, in force through its end day, then expired', () => {
    expect(mandateState(m, day('2026-04-30'))).toBe('UPCOMING');
    expect(mandateState(m, day('2026-05-01'))).toBe('ACTIVE');
    expect(mandateState(m, day('2026-05-31'))).toBe('ACTIVE');
    expect(mandateState(m, day('2026-06-01'))).toBe('EXPIRED');
  });
  it('a cancelled mandate is cancelled whatever the day', () => {
    expect(mandateState({ ...m, cancelledAt: new Date() }, day('2026-05-10'))).toBe('CANCELLED');
  });
  it('counts whole days', () => {
    expect(daysUntil(day('2026-05-31'), day('2026-05-17'))).toBe(14);
  });
});
