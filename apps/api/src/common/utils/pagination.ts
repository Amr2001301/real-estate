export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Server-computed aggregates returned alongside a page of rows.
 *
 * WHY THIS EXISTS — admin list pages used to render KPI strips by fetching an
 * oversized page (`?pageSize=500`) and counting client-side with
 * `.filter().length`. Above the requested page size those numbers were silently
 * wrong: a company with 600 units saw counts derived from the first 500. Facets
 * are computed in SQL over the *whole* filtered set, so they are correct
 * regardless of page size, and the client can go back to asking for the twenty
 * rows it actually renders. See docs/audit/08-functional-gaps.md FG-23.
 *
 * Optional by design: every existing consumer, including the OpenAPI-generated
 * mobile client, ignores an absent `facets` and is unaffected.
 */
export interface PaginationFacets {
  /**
   * dimension → value → row count, e.g. `{ status: { AVAILABLE: 812 } }`.
   * Only values present in the filtered set appear; callers must treat a
   * missing key as zero rather than assuming every enum member is listed.
   */
  counts?: Record<string, Record<string, number>>;
  /**
   * field → sum, as a decimal string. Money is `Decimal(14,2)` in Postgres and
   * is serialised as a string everywhere else in this API (see
   * DepositsService totals) so that large values do not lose precision through
   * JSON's float. Callers format it; they must not parse it into a number to
   * add more to it.
   */
  sums?: Record<string, string>;
  /**
   * field → maximum, as an ISO string. Added for "most recent X across the
   * whole set" tiles, which are neither a count nor a sum. Absent when the
   * filtered set is empty or every row holds null.
   */
  max?: Record<string, string>;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    facets?: PaginationFacets;
  };
}

export const MAX_PAGE_SIZE = 500;

/**
 * The single clamp rule. Also guards against NaN, which `Number(undefined)` in
 * a controller produces and which would otherwise reach Prisma as `take: NaN`.
 */
export function clampPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize)) return 20;
  return Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE);
}

/** Same NaN guard for the page number — `Number('abc')` must not become skip: NaN. */
export function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

export function takeSkip(p: PaginationParams) {
  const pageSize = clampPageSize(p.pageSize);
  const page = clampPage(p.page);
  return { take: pageSize, skip: (page - 1) * pageSize };
}

export function paginate<T>(
  data: T[],
  total: number,
  p: PaginationParams,
  facets?: PaginationFacets,
): Paginated<T> {
  // Clamp with the same rule takeSkip uses. Clamping only the query would make
  // meta lie: a caller asking for 10,000 would be told pageSize is 10,000 while
  // 500 rows came back, and totalPages would be computed from the fiction.
  const pageSize = clampPageSize(p.pageSize);
  const page = clampPage(p.page);
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      ...(facets ? { facets } : {}),
    },
  };
}

/**
 * Hard ceiling on rows returned in one page, enforced in `takeSkip` regardless
 * of what the caller asked for.
 *
 * WHY — 22 of 26 list DTOs placed no upper bound on `pageSize`, including
 * `@Public() GET /v1/public/units`, and sixteen controllers read it straight
 * off `@Query` with no validation at all. A single unauthenticated request
 * could ask for every row a tenant owns. `PaginationQuerySchema` in
 * packages/shared-types does declare `.max(100)`, but nothing in the API
 * imports it — it was documentation, not a control.
 *
 * 500 rather than 100 because 500 is the largest page any client asks for
 * today, so this breaks nothing. Tightening it to 100 is a follow-up that
 * depends on the filter dropdowns getting a lightweight options endpoint of
 * their own; until then they legitimately need large pages. See
 * docs/audit/08-functional-gaps.md FG-23.
 *
 * This clamp is the backstop, not the contract. DTO-validated routes also
 * carry `@Max(MAX_PAGE_SIZE)` so a caller gets a clear 400 instead of a
 * quietly truncated page.
 */

/**
 * Turn a Prisma `groupBy` result into a facet dimension.
 *
 * Call it as `toCounts(groups.map((g) => [String(g.status), g._count] as const))`.
 * The mapping stays at the call site on purpose: Prisma types each model's
 * groupBy row differently and a generic that tried to reach into `g[key]`
 * collapses into an unusable union. Keeping this function non-generic means
 * the awkward part is one `as const` per call and the shared part is written
 * once.
 *
 * `String()` on the key is deliberate — it normalises enum members and the
 * boolean dimensions (`active`) that some lists group on.
 */
export function toCounts(
  pairs: ReadonlyArray<readonly [string, number]>,
): Record<string, number> {
  return Object.fromEntries(pairs) as Record<string, number>;
}
