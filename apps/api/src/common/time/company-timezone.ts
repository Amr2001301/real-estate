/**
 * The company's time zone — a company setting, Africa/Cairo by default.
 *
 * Due dates are calendar days (stored as UTC midnight of that day). Whether a
 * day has passed depends on where the company is: the server runs in UTC, so
 * comparing a due date with "now" turned an installment overdue at 01:00 on
 * its own due day in Cairo (02:00–03:00 local), before the customer could pay
 * and before the 09:00 "due today" reminder. "Overdue" now means the whole due
 * day has ended in the company's own time zone.
 */
import { BadRequestException } from '@nestjs/common';

export const COMPANY_TIMEZONE_KEY = 'company.timezone';
export const COMPANY_TIMEZONE_DEFAULT = 'Africa/Cairo';

export function isValidTimeZone(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

export const COMPANY_TIMEZONE_VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  [COMPANY_TIMEZONE_KEY]: (k, v) => {
    if (!isValidTimeZone(v)) throw new BadRequestException(`${k}: must be an IANA time zone, e.g. Africa/Cairo`);
  },
};

/**
 * UTC midnight of today's calendar date in `timeZone`. A due date (UTC
 * midnight of its day) before this is a day that has fully passed there.
 */
export function startOfLocalToday(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: isValidTimeZone(timeZone) ? timeZone : COMPANY_TIMEZONE_DEFAULT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

/**
 * A due date `days` after today in `timeZone`: a day (UTC midnight of it),
 * like every schedule row. A due date carrying the time it was written fell
 * out of "due by today" and was chased a day late.
 */
export function localDayAfter(timeZone: string, days: number, now = new Date()): Date {
  return new Date(startOfLocalToday(timeZone, now).getTime() + days * 24 * 60 * 60 * 1000);
}

/** Each listed company's time zone (default when missing or malformed). */
export async function companyTimeZones(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { setting: { findMany: (...args: any[]) => Promise<Array<{ companyId: string | null; value: unknown }>> } },
  companyIds: string[],
): Promise<Map<string, string>> {
  const rows = companyIds.length
    ? await db.setting.findMany({
        where: { key: COMPANY_TIMEZONE_KEY, companyId: { in: companyIds } },
        select: { companyId: true, value: true },
      })
    : [];
  const zones = new Map<string, string>(companyIds.map((id) => [id, COMPANY_TIMEZONE_DEFAULT]));
  for (const r of rows) if (r.companyId && isValidTimeZone(r.value)) zones.set(r.companyId, r.value);
  return zones;
}

/** One company's time zone. */
export async function companyTimeZone(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { setting: { findMany: (...args: any[]) => Promise<Array<{ companyId: string | null; value: unknown }>> } },
  companyId: string,
): Promise<string> {
  return (await companyTimeZones(db, [companyId])).get(companyId)!;
}

/** Idempotent: a new company gets the setting with its default. */
export async function seedTimeZoneSettingForCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { setting: { createMany: (...args: any[]) => Promise<{ count: number }> } },
  companyId: string,
): Promise<void> {
  await prisma.setting.createMany({
    data: [{ companyId, key: COMPANY_TIMEZONE_KEY, value: COMPANY_TIMEZONE_DEFAULT }],
    skipDuplicates: true,
  });
}

/**
 * The current tenant's time zone; the default outside a tenant context (a
 * platform-wide job, a unit test) rather than throwing.
 */
export async function currentCompanyTimeZone(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { setting: { findMany: (...args: any[]) => Promise<Array<{ companyId: string | null; value: unknown }>> } },
  companyId: string | null | undefined,
): Promise<string> {
  return companyId ? companyTimeZone(db, companyId) : COMPANY_TIMEZONE_DEFAULT;
}

/** How far `timeZone` is ahead of UTC at `at`, in milliseconds. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant the next calendar day begins in `timeZone` — the end of
 * "today" for times of day (a follow-up at 16:00), unlike the day-granular
 * due dates above.
 */
export function endOfLocalTodayInstant(timeZone: string, now = new Date()): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : COMPANY_TIMEZONE_DEFAULT;
  const tomorrow = localDayAfter(zone, 1, now);
  return new Date(tomorrow.getTime() - zoneOffsetMs(zone, tomorrow));
}

/** The instant a calendar day (`YYYY-MM-DD`) begins in `timeZone`. */
export function localDayStartInstant(timeZone: string, day: string): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : COMPANY_TIMEZONE_DEFAULT;
  const utcMidnight = new Date(`${day}T00:00:00.000Z`);
  return new Date(utcMidnight.getTime() - zoneOffsetMs(zone, utcMidnight));
}
