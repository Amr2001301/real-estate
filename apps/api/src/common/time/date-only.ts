/**
 * A calendar date (a @db.Date column) from the client's "YYYY-MM-DD" (or a
 * full ISO string — its date part): midnight UTC, the way Postgres DATE
 * values come back. undefined stays undefined (not sent), null clears.
 */
export function toDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** A @db.Date value as "YYYY-MM-DD" (null when there is none). */
export function dateOnlyString(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
