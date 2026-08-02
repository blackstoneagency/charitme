import 'server-only';
import { supabaseAdmin } from './supabase';
import { columnPresence, shouldFilter, isCacheable } from './campaign-visibility-core';
import { withQueryTimeout } from './query-timeout';

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
/**
 * Deadline for the probe.
 *
 * Measured on a production build against an unreachable database: this probe
 * cost ~7.05s on EVERY request to EVERY campaign-backed page, because the
 * "only cache a definitive answer" rule above means an unreachable DB is never
 * cacheable — so it re-probed forever. Pages that then ran their own read came
 * to ~14.1s, and 13 public routes measured exactly that.
 *
 * The timeout fallback is `{ visibility: true, deletedAt: true }` — both filters
 * ON. That is deliberately the same answer the "unknown" path already gives:
 * fail toward privacy. A timeout must never be the reason a private or
 * soft-deleted campaign becomes publicly listed.
 */
const PROBE_TIMEOUT_MS = 1_500;

/** Fail-safe answer: apply every filter. Matches the `unknown` branch below. */
const FAIL_TOWARD_PRIVACY: CampaignCols = { visibility: true, deletedAt: true };

/**
 * The probe currently running, if any.
 *
 * Bounding the probe fixed pages that call it ONCE, and exposed a second shape
 * on pages that call it several times: `lib/home-data.ts` calls it 4×, and the
 * homepage runs `getHomeData` / `getCategoryStats` / `getRecentDonations`
 * concurrently. With the degraded answer deliberately never cached, each call
 * paid the full 1.5s deadline — 4 × 1.5s ≈ the 7.2s the homepage measured.
 *
 * This shares the in-flight promise so concurrent callers get ONE probe. It is
 * not a cache: the reference is cleared as soon as the probe settles, so the
 * next request re-probes and no guess is ever persisted. That distinction is
 * the whole point — caching a degraded answer is exactly the trade this module
 * refuses, because a cached "column missing" would publicly list private and
 * soft-deleted campaigns for the life of the process.
 */
let _inFlight: Promise<CampaignCols> | null = null;

export async function campaignColumns(): Promise<CampaignCols> {
  if (_campaignCols) return _campaignCols;
  if (_inFlight) return _inFlight;

  _inFlight = probeCampaignColumns();
  try {
    return await _inFlight;
  } finally {
    _inFlight = null;
  }
}

async function probeCampaignColumns(): Promise<CampaignCols> {
  const probe = await withQueryTimeout(
    Promise.all([
      supabaseAdmin.from('campaigns').select('visibility').limit(1),
      supabaseAdmin.from('campaigns').select('deleted_at').limit(1),
    ]),
    null,
    PROBE_TIMEOUT_MS,
  );

  // Not cached, exactly like the unknown-error path: a slow moment must not
  // freeze a guess in for the life of the process.
  if (probe.degraded || !probe.data) return FAIL_TOWARD_PRIVACY;

  const [v, d] = probe.data;

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
