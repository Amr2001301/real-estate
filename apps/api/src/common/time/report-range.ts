import { COMPANY_TIMEZONE_DEFAULT, isValidTimeZone } from './company-timezone';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The instant `timeZone`'s clock reads midnight at the start of `day` (YYYY-MM-DD). */
export function localMidnight(day: string, timeZone: string): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : COMPANY_TIMEZONE_DEFAULT;
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  // How far the zone's wall clock is from UTC at that moment.
  const offset = (at: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(at));
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at;
  };
  const first = guess - offset(guess);
  // A DST change between the guess and the result moves the offset once more.
  return new Date(guess - offset(first));
}

/**
 * A report's "from / to" filter. A date-only `to` covers that whole day in
 * the company's time zone: `lt` the start of the next day. It used to be
 * `lte` midnight at the start of the day, which dropped everything on the
 * last day of the range. A date-only `from` starts at that day's local
 * midnight; full timestamps are taken as given.
 */
export function reportRange(
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = DATE_ONLY.test(from) ? localMidnight(from, timeZone) : new Date(from);
  if (to) {
    if (DATE_ONLY.test(to)) {
      const next = new Date(`${to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      range.lt = localMidnight(next.toISOString().slice(0, 10), timeZone);
    } else {
      range.lt = new Date(new Date(to).getTime() + 1);
    }
  }
  return range;
}
