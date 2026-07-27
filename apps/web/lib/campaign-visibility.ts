import 'server-only';
import { supabaseAdmin } from './supabase';
import { columnPresence, shouldFilter, isCacheable } from './campaign-visibility-core';

// ─────────────────────────────────────────────────────────────────────────────
// Schema-resilient "live public campaign" filtering.
//
// The `visibility` and `deleted_at` columns are added by later migrations. On a
// deployment where those migrations have not been applied yet, filtering on them
// errors and returns nothing (silently emptying discovery pages). We probe once
// (cached for the process) and only apply the filters that actually exist — so
// public campaign listings render on any DB state while still enforcing
// public/non-deleted filtering wherever the columns are present.
// ─────────────────────────────────────────────────────────────────────────────
export type CampaignCols = { visibility: boolean; deletedAt: boolean };
let _campaignCols: CampaignCols | null = null;

/**
 * Probe which optional columns exist, and cache only a definitive answer.
 *
 * This used to read `{ visibility: !v.error }` — i.e. **any** error meant "column
 * absent", cached for the process lifetime. One transient failure on the first
 * call after a cold start therefore disabled `visibility = 'public'` and
 * `deleted_at IS NULL` on every public listing until the instance recycled,
 * publicly listing private and soft-deleted campaigns.
 *
 * Now only Postgres `42703 undefined_column` proves absence. Anything else is
 * unknown: the filter is still applied (fail toward privacy) and the result is
 * NOT cached, so the next call re-probes. Verified against production, where both
 * columns exist and a bogus column really does return 42703.
 */
export async function campaignColumns(): Promise<CampaignCols> {
  if (_campaignCols) return _campaignCols;
  const [v, d] = await Promise.all([
    supabaseAdmin.from('campaigns').select('visibility').limit(1),
    supabaseAdmin.from('campaigns').select('deleted_at').limit(1),
  ]);

  const visibility = columnPresence(v.error);
  const deletedAt = columnPresence(d.error);
  const cols: CampaignCols = {
    visibility: shouldFilter(visibility),
    deletedAt: shouldFilter(deletedAt),
  };

  // Cache only when BOTH answers are definitive; a transient blip must not be
  // frozen in for the life of the process.
  if (isCacheable(visibility) && isCacheable(deletedAt)) _campaignCols = cols;
  return cols;
}

// Structural view of just the two filter methods we call, to avoid deeply
// instantiating the full PostgREST builder generic (which trips TS2589).
type AnyFilter = { eq(column: string, value: string): AnyFilter; is(column: string, value: null): AnyFilter };

/** Apply status=active plus visibility=public / deleted_at IS NULL where present. */
export function applyLiveFilters<Q>(query: Q, cols: CampaignCols): Q {
  return applyVisibilityFilters((query as unknown as AnyFilter).eq('status', 'active') as unknown as Q, cols);
}

/** Apply only visibility=public / deleted_at IS NULL where present (caller sets status). */
export function applyVisibilityFilters<Q>(query: Q, cols: CampaignCols): Q {
  let out = query as unknown as AnyFilter;
  if (cols.visibility) out = out.eq('visibility', 'public');
  if (cols.deletedAt) out = out.is('deleted_at', null);
  return out as unknown as Q;
}
