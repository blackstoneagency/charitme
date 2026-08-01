// ─────────────────────────────────────────────────────────────────────────────
// Global site search.
//
// Three real sources, and deliberately no fourth:
//
//   • campaigns  — Supabase, via the same `applyCampaignSearch` the discovery
//                  page uses, so a query returns the same rows in both places
//   • causes     — the taxonomy in lib/causes.ts
//   • resources  — the sitemap catalog in lib/public-routes.ts, which is already
//                  the single source of truth for indexable pages
//
// The design also shows a "People (18)" tab. That is NOT built, on purpose:
// `profiles` holds donor and organizer records, and making them keyword-
// searchable by default would expose people who never asked to be findable.
// Adding it needs an explicit opt-in column and an owner decision, not a tab.
//
// Every count here is measured. The mockup shows "All (128) · Causes (45) ·
// Campaigns (32)" as illustrative numbers; rendering those as literals would be
// a fabricated statistic on a page whose entire job is to report what exists.
// ─────────────────────────────────────────────────────────────────────────────

import { CAUSES, causeBrowseHref, type Cause } from './causes';
import { INDEXABLE_PUBLIC_ROUTES, type PublicRoute } from './public-routes';

export type SearchScope = 'all' | 'campaigns' | 'causes' | 'resources';

export const SEARCH_SCOPES: readonly { value: SearchScope; labelKey: string; label: string }[] = [
  { value: 'all', labelKey: 'search.tab.all', label: 'All' },
  { value: 'campaigns', labelKey: 'search.tab.campaigns', label: 'Campaigns' },
  { value: 'causes', labelKey: 'search.tab.causes', label: 'Causes' },
  { value: 'resources', labelKey: 'search.tab.resources', label: 'Resources' },
];

export function isSearchScope(v: string | undefined): v is SearchScope {
  return v === 'all' || v === 'campaigns' || v === 'causes' || v === 'resources';
}

/**
 * Normalise a raw query.
 *
 * Strips the SQL LIKE wildcards and the characters `applyCampaignSearch`
 * tokenises on, so the cause/resource matching below behaves the same way the
 * database matching does. Without this, `%` matched everything in one source
 * and nothing in another, and the tab counts silently disagreed.
 */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[%_(),]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function terms(q: string): string[] {
  return q.toLowerCase().split(' ').filter(Boolean);
}

/** Every term must appear somewhere in the haystack — same AND-of-ORs as the DB. */
function matchesAll(haystack: string, q: string): boolean {
  const hay = haystack.toLowerCase();
  return terms(q).every((t) => hay.includes(t));
}

export function searchCauses(q: string): Cause[] {
  if (!q) return [];
  return CAUSES.filter((c) => matchesAll(`${c.label} ${c.blurb} ${c.categories.join(' ')}`, q));
}

export interface ResourceHit {
  path: string;
  title: string;
  description: string;
}

/**
 * Resource pages matching the query.
 *
 * Reads the sitemap catalog rather than a hand-written list of pages — that
 * catalog is already required to stay in step with `e2e/public-routes.json`, so
 * a new page becomes searchable automatically instead of being forgotten.
 */
export function searchResources(q: string, limit = 12): ResourceHit[] {
  if (!q) return [];
  return (INDEXABLE_PUBLIC_ROUTES as PublicRoute[])
    .filter((r) => matchesAll(`${r.title} ${r.description} ${r.path}`, q))
    .slice(0, limit)
    .map((r) => ({ path: r.path, title: r.title, description: r.description }));
}

/** Where a cause result should link. Shared with the nav so they cannot diverge. */
export { causeBrowseHref };

export const SEARCH_SORTS = ['relevance', 'raised', 'latest', 'ending'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export function isSearchSort(v: string | undefined): v is SearchSort {
  return (SEARCH_SORTS as readonly string[]).includes(v ?? '');
}
