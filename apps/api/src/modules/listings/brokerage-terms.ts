/**
 * BRK-2 — the date arithmetic of mandates and rent tenancies, kept pure so
 * the service, the reminders and the tests read the same rules. Dates are
 * calendar days (UTC midnight of the day), "today" is the company's today.
 */

export type MandateState = 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'CANCELLED';

/** A mandate's state on `today`; in force through its end day. */
export function mandateState(m: { startDate: Date; endDate: Date; cancelledAt: Date | null }, today: Date): MandateState {
  if (m.cancelledAt) return 'CANCELLED';
  if (m.startDate.getTime() > today.getTime()) return 'UPCOMING';
  if (m.endDate.getTime() < today.getTime()) return 'EXPIRED';
  return 'ACTIVE';
}

/** Days from `today` to `day` (0 = today). */
export function daysUntil(day: Date, today: Date): number {
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

/** A mandate ending within this many days is flagged and its agent told. */
export const MANDATE_EXPIRY_NOTICE_DAYS = 14;
/** A tenancy ending within this many days is flagged and its agent told. */
export const TENANCY_ENDING_NOTICE_DAYS = 30;

export type RentRowState = 'PAID' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';

export interface RentRow {
  /** "YYYY-MM". */
  period: string;
  /** "YYYY-MM-DD". */
  dueDate: string;
  amount: number;
  state: RentRowState;
  paid: { amount: number; paidOn: string } | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * How many months of rent a lease owes: one per lease month, a part month
 * counting as a month (10 Mar → 9 Mar next year is 12; 1 Jan → 31 Dec is 12).
 */
export function leaseMonths(startDate: Date, endDate: Date): number {
  const months =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth());
  return Math.max(1, months + (endDate.getUTCDate() >= startDate.getUTCDate() ? 1 : 0));
}

/**
 * The tenancy's rent: one row per lease month, named by the calendar month
 * it falls in and due on `paymentDay` of that month (on the start day for
 * the first month when the tenancy starts after that day).
 */
export function rentSchedule(
  t: { startDate: Date; endDate: Date; paymentDay: number; monthlyRent: number },
  payments: Array<{ period: string; amount: number; paidOn: Date }>,
  today: Date,
): RentRow[] {
  const paid = new Map(payments.map((p) => [p.period, p]));
  const rows: RentRow[] = [];
  const count = Math.min(leaseMonths(t.startDate, t.endDate), 600);
  for (let i = 0; i < count; i++) {
    const y = t.startDate.getUTCFullYear() + Math.floor((t.startDate.getUTCMonth() + i) / 12);
    const m = (t.startDate.getUTCMonth() + i) % 12;
    const due = new Date(Date.UTC(y, m, Math.min(t.paymentDay, 28)));
    const dueDay = i === 0 && due.getTime() < t.startDate.getTime() ? t.startDate : due;
    const period = `${y}-${String(m + 1).padStart(2, '0')}`;
    const p = paid.get(period);
    const state: RentRowState = p
      ? 'PAID'
      : dueDay.getTime() < today.getTime()
        ? 'OVERDUE'
        : dueDay.getTime() === today.getTime()
          ? 'DUE_TODAY'
          : 'UPCOMING';
    rows.push({ period, dueDate: ymd(dueDay), amount: t.monthlyRent, state, paid: p ? { amount: p.amount, paidOn: ymd(p.paidOn) } : null });
  }
  return rows;
}

/** "YYYY-MM-DD" → the day (UTC midnight). */
export function day(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
