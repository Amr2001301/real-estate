/**
 * Wall-clock times typed in a datetime-local field ("2026-10-18T13:00") are
 * the company's local time. Parsing them with `new Date()` in a server
 * action used the server's zone — UTC on Vercel — so a visit booked at 1:00
 * pm Cairo was stored as 1:00 pm UTC (4:00 pm Cairo), and the customer app
 * and reminders said 4 pm.
 */

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Milliseconds `timeZone` is ahead of UTC at `at`. */
function offsetAt(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - at;
}

/**
 * The instant (ISO) of a wall-clock time in `timeZone`. Anything that is not a
 * bare wall-clock time (already ISO with a zone, a date alone, empty) is
 * returned as is.
 */
export function wallTimeToIso(value: string, timeZone: string): string {
  const m = WALL_TIME.exec(value.trim());
  if (!m) return value;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0));
  try {
    let at = asUtc - offsetAt(timeZone, asUtc);
    // Across a DST change the offset at the result can differ: settle on it.
    at = asUtc - offsetAt(timeZone, at);
    return new Date(at).toISOString();
  } catch {
    return new Date(asUtc).toISOString();
  }
}

/** Now as a datetime-local value ("YYYY-MM-DDTHH:mm") in the viewer's own zone. */
export function nowWallTime(now: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
}
