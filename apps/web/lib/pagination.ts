// Small pagination helpers shared by list endpoints.

/**
 * Number of pages for `total` rows at `limit` per page.
 * Always at least 1 (an empty list is still "page 1 of 1"), and never NaN/∞
 * for a zero/negative limit.
 */
export function totalPages(total: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / limit));
}
