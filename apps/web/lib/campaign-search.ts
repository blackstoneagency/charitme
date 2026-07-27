// ─────────────────────────────────────────────────────────────────────────────
// Campaign keyword search — tokenized, multi-word matching.
//
// The naive approach (`title.ilike.%<whole query>%`) only matches when the exact
// phrase appears as a substring, so "cancer treatment fund" fails to find a
// campaign titled "Treatment fund for cancer". We instead split the query into
// terms and require EACH term to appear in SOME searchable field (AND across
// terms, OR across fields), which mirrors how users expect keyword search to work
// while staying purely index-backed (ilike over trigram indexes) — no schema
// change, no embeddings.
// ─────────────────────────────────────────────────────────────────────────────

/** Fields a keyword must match at least one of. */
export const CAMPAIGN_SEARCH_FIELDS = ['title', 'tagline', 'description'] as const;

/**
 * Normalize a raw search string into individual terms.
 *  - Strips PostgREST filter-syntax chars (`, ( )`) that would break `.or()`.
 *  - Neutralizes ilike wildcards (`% _`) to spaces so a user can't turn a search
 *    into a match-everything wildcard (or an expensive leading-wildcard scan).
 *  - Caps the term count so a pathological query can't build an unbounded filter.
 */
/**
 * Escape a raw user string for use inside an `ilike` pattern.
 *
 * `%` and `_` are SQL LIKE wildcards, so an unescaped term silently changes the
 * query's meaning: a location of "%" matched EVERY row (the filter did nothing),
 * and "N_w York" matched "New York". Returns '' when the input was entirely
 * wildcards, so callers can skip the filter rather than fall back to a match-all.
 *
 * Shared deliberately: four call sites were doing this (or forgetting to), and a
 * hand-copied version in each is how CAMPAIGN_CATEGORIES drifted to 11 of 18.
 */
export function likeTerm(raw: string): string {
  return raw.replace(/[%_]/g, ' ').trim();
}

export function searchTerms(raw: string, maxTerms = 6): string[] {
  return raw
    .replace(/[,()%_]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, maxTerms);
}

/**
 * PostgREST `.or()` clause for a single term: the term must appear (case-
 * insensitive substring) in at least one searchable field.
 */
export function orClauseForTerm(
  term: string,
  fields: readonly string[] = CAMPAIGN_SEARCH_FIELDS,
): string {
  return fields.map((f) => `${f}.ilike.%${term}%`).join(',');
}

/** Minimal structural view of the one builder method we chain, to avoid TS2589. */
type OrFilter<Q> = { or(filters: string): Q };

/**
 * Apply tokenized keyword search to a PostgREST query. Chaining one `.or()` per
 * term ANDs the terms together while each term ORs across the fields. A blank or
 * all-punctuation query is a no-op (returns the query unchanged).
 */
export function applyCampaignSearch<Q>(
  query: Q,
  raw: string | null | undefined,
  fields: readonly string[] = CAMPAIGN_SEARCH_FIELDS,
): Q {
  if (!raw) return query;
  let out = query;
  for (const term of searchTerms(raw)) {
    out = (out as unknown as OrFilter<Q>).or(orClauseForTerm(term, fields));
  }
  return out;
}
