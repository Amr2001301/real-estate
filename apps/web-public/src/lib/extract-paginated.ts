/**
 * Defence-in-depth normaliser for endpoints whose response shape might be
 * either a `Paginated<T>` (`{ data, meta }`) or a flat array.
 *
 * Backstory (P5): `/me/notifications` is a `Paginated<MeNotification>`, but
 * some pages were originally written for an array contract and crashed with
 * `items.filter is not a function` after the backend was paginated. This
 * helper accepts either shape and returns `[]` for anything else — pages
 * never throw at render even if the API changes again.
 */
export function extractPaginatedData<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }
  return [];
}
