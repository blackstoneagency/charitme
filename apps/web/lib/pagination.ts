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

/**
 * Page numbers to render in a numbered pager, with `null` marking an ellipsis:
 *
 *   1 2 3 … 21
 *
 * Always yields the first and last page so a visitor can jump to either end, and
 * keeps a one-page window either side of the current page.
 *
 * Deduped and gap-aware, because the two halves overlap: for a small
 * `total` the endpoints and the window are the same numbers, and a naive
 * concatenation prints "1 1 2 3 3". A pager that repeats a number looks broken
 * in a way people report as a data bug.
 *
 * Lives here rather than beside the campaigns page because a Next.js page module
 * may only export a fixed set of names — exporting a helper from one is a build
 * error. Same reason `app/campaigns/[slug]/get-campaign.ts` is its own module:
 * the logic stays unit-testable without rendering a server component.
 */
export function pageWindow(page: number, total: number): (number | null)[] {
  if (total < 1) return [];
  const keep = new Set<number>([1, total, page - 1, page, page + 1]);
  const shown = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of shown) {
    // Only a real gap becomes an ellipsis. Adjacent numbers must stay adjacent,
    // otherwise "1 … 2" appears, claiming hidden pages that do not exist.
    if (prev && n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
