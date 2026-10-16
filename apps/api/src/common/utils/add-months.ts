/**
 * `d` plus `n` calendar months, keeping the day of the month where it exists
 * and clamping it to the month's last day where it doesn't (Jan 31 → Feb 28 →
 * Mar 31). Date#setMonth overflows instead (Jan 31 + 1 month → Mar 3), which
 * skipped February on a plan starting the 31st and billed March twice.
 *
 * Steps are always taken from `d` itself, so the day never drifts down after
 * a short month (month 3 of a Jan 31 plan is Apr 30, not Apr 28).
 */
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}
