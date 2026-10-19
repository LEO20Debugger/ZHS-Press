/**
 * Rows per page in the admin's long lists — catalogue, orders, submissions.
 * Fifteen fits a laptop screen without scrolling past the page controls.
 */
export const ADMIN_PER_PAGE = 15;

/**
 * A ?page= value as a page number. Anything that is not a positive whole
 * number is page 1: Number('abc') is NaN, and a NaN offset reaches the
 * database as an invalid query.
 */
export function toPage(raw: string | number | undefined): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/** The one shape every paged admin list returns, so the pages can share a pager. */
export function pageOf<T>(items: T[], page: number, total: number) {
  return {
    items,
    page,
    perPage: ADMIN_PER_PAGE,
    total,
    totalPages: Math.max(1, Math.ceil(total / ADMIN_PER_PAGE)),
  };
}
