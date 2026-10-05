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

export function paginate<T>(
  data: T[],
  total: number,
  p: PaginationParams,
  facets?: PaginationFacets,
): Paginated<T> {
  return {
    data,
    meta: {
      page: p.page,
      pageSize: p.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
      ...(facets ? { facets } : {}),
    },
  };
}

export function takeSkip(p: PaginationParams) {
  return { take: p.pageSize, skip: (p.page - 1) * p.pageSize };
}
