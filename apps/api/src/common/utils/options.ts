/**
 * "Options" endpoints back dropdowns and filters: every row of a small,
 * company-bounded set (projects, brokers, staff), a handful of columns each.
 *
 * They replace pages that fetched ?pageSize=100–500 *full* rows (relations,
 * includes, facets) just to fill a <select> — heavy, and silently truncated
 * past the page size. A dropdown needs every option, so these are not paged;
 * the cap below only bounds a runaway tenant, and `truncated` says when it hit.
 */
export const OPTIONS_LIMIT = 1000;

export interface OptionsResult<T> {
  data: T[];
  /** True when the set had more than OPTIONS_LIMIT rows and was cut. */
  truncated: boolean;
}

/** Pass rows fetched with `take: OPTIONS_LIMIT + 1`. */
export function optionsResult<T>(rows: T[]): OptionsResult<T> {
  return { data: rows.slice(0, OPTIONS_LIMIT), truncated: rows.length > OPTIONS_LIMIT };
}
