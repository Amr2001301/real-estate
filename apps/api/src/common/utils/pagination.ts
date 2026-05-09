export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function paginate<T>(data: T[], total: number, p: PaginationParams): Paginated<T> {
  return {
    data,
    meta: {
      page: p.page,
      pageSize: p.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
    },
  };
}

export function takeSkip(p: PaginationParams) {
  return { take: p.pageSize, skip: (p.page - 1) * p.pageSize };
}
