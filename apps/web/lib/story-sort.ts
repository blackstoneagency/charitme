/**
 * Sort options for /success-stories, shared by the server page and the client
 * `SortSelect`.
 *
 * ⚠️ This lives here rather than in `SortSelect.tsx` for a reason that only
 * shows up in production. `SortSelect` is a `'use client'` module, and when a
 * SERVER component imports a named value from one, Next replaces the module
 * with a client-reference proxy — the component export is usable (as a
 * reference to render), but a plain `const` is not a real value on the server.
 *
 * Exported from the client file, this array typechecked, linted, built, and
 * passed a source-reading test suite, then 500'd the live page with
 * `SORTS.some is not a function`. Only a browser hitting the built page caught
 * it. Keep shared constants in a non-client module.
 */
export const SORTS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'raised', label: 'Most Raised' },
  { value: 'supporters', label: 'Most Supporters' },
] as const;

export type SortValue = (typeof SORTS)[number]['value'];

/** Column and direction for each option, applied by the page's query. */
export const SORT_ORDER: Record<SortValue, { column: string; ascending: boolean }> = {
  recent: { column: 'created_at', ascending: false },
  raised: { column: 'raised_amount', ascending: false },
  supporters: { column: 'backer_count', ascending: false },
};

export function isSortValue(v: string | undefined): v is SortValue {
  return SORTS.some((s) => s.value === v);
}
