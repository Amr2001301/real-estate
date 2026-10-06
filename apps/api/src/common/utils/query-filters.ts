import { BadRequestException } from '@nestjs/common';

/**
 * Parse a `?status=PENDING,APPROVED` style query param into a validated list of
 * enum members. Returns `undefined` when the param is absent or empty so the
 * caller can leave the filter out of its `where` entirely.
 *
 * Unknown members are a 400, not silently dropped: dropping them would widen
 * the filter to "everything" when a caller misspells the only value it sent,
 * and passing them through would surface as a Prisma 500.
 */
export function parseEnumList<T extends string>(
  raw: string | undefined,
  members: Record<string, T>,
  param: string,
): T[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const allowed = new Set<string>(Object.values(members));
  const bad = parts.filter((p) => !allowed.has(p));
  if (bad.length > 0) {
    throw new BadRequestException(`Invalid ${param}: ${bad.join(', ')}`);
  }
  return [...new Set(parts)] as T[];
}

/** One member stays an equality filter; several become `{ in: [...] }`. */
export function enumFilter<T extends string>(list: T[] | undefined): T | { in: T[] } | undefined {
  if (!list) return undefined;
  return list.length === 1 ? list[0] : { in: list };
}

/**
 * Parse an ISO-8601 instant from a query param. Exact to the millisecond — unlike
 * the `dateFrom`/`dateTo` filters, which are day-granular, so a dashboard can ask
 * for "created more than 72 hours ago" without being off by up to a day.
 */
export function parseIsoInstant(raw: string | undefined, param: string): Date | undefined {
  if (raw === undefined || raw === '') return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${param}: expected an ISO-8601 date-time`);
  }
  return d;
}
