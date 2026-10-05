import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Server-computed aggregates returned alongside a page of rows.
 * Mirrors apps/api/src/common/utils/pagination.ts — keep the two in step.
 * See docs/audit/08-functional-gaps.md FG-23 for why these exist.
 */
export interface PaginationFacets {
  /** dimension → value → row count, e.g. `{ status: { AVAILABLE: 812 } }`. A
   *  missing key means zero; the server omits values absent from the set. */
  counts?: Record<string, Record<string, number>>;
  /** field → sum as a decimal string. Money is Decimal(14,2); it is a string
   *  so JSON floats cannot lose precision. Format it, do not arithmetic on it. */
  sums?: Record<string, string>;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    /** Present only on endpoints that compute aggregates; always optional. */
    facets?: PaginationFacets;
  };
}
