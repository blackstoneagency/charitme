import 'server-only';
import { supabaseAdmin } from './supabase';
import { campaignColumns, applyLiveFilters } from './campaign-visibility';
import type { Cause } from './causes';

/**
 * Live figures for a cause landing page.
 *
 * ⚠️ Every field here is MEASURED. The reference design shows inflated totals for people helped, lives
 * transformed, programmes funded and countries reached, plus a star rating from
 * a five-figure supporter count. Not one of those is backed by this database:
 *
 *   · there is no ratings table at all, so the stars and the 4.9 cannot exist;
 *   · `supported_countries` holds 69 rows, far fewer than the mock asserts —
 *     and that exact country claim is already called out in docs/ as a
 *     fabricated statistic this repo has been caught by before;
 *   · "programs" is not an entity here; campaigns are.
 *
 * So the tiles show real counts and the rating is not rendered. A visitor
 * deciding whether to give money is exactly the person who must not be handed
 * invented numbers.
 *
 * Every field is `number | null`. `null` means the query FAILED and renders as
 * "—". Do not add `?? 0`: on this page 0 is a meaningful, publishable answer
 * ("no live campaigns in this cause yet"), so it has to be distinguishable from
 * "we could not count".
 */
export interface CauseStats {
  /** Live campaigns in this cause's categories. */
  liveCampaigns: number | null;
  /** Sum of raised_amount across those campaigns, in cents. */
  raisedCents: number | null;
  /** Sum of backer_count across those campaigns. */
  supporters: number | null;
  /** Countries CharitMe can actually operate in — from `supported_countries`. */
  countries: number | null;
  /** Live campaign count per category, for the "programs" panel. */
  perCategory: Record<string, number>;
}

export async function getCauseStats(cause: Cause): Promise<CauseStats> {
  const cols = await campaignColumns();

  const [rows, countries] = await Promise.all([
    applyLiveFilters(
      supabaseAdmin.from('campaigns').select('category, raised_amount, backer_count'),
      cols,
    ).in('category', [...cause.categories]),
    supabaseAdmin
      .from('supported_countries')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .eq('can_donate', true),
  ]);

  const perCategory: Record<string, number> = {};
  let liveCampaigns: number | null = null;
  let raisedCents: number | null = null;
  let supporters: number | null = null;

  if (rows.error) {
    console.warn('[cause-landing] campaign stats failed', { code: rows.error.code });
  } else {
    const data = rows.data ?? [];
    liveCampaigns = data.length;
    raisedCents = data.reduce((sum, r) => sum + Number(r.raised_amount ?? 0), 0);
    supporters = data.reduce((sum, r) => sum + Number(r.backer_count ?? 0), 0);
    for (const c of cause.categories) perCategory[c] = 0;
    for (const r of data) {
      const key = r.category as string | null;
      if (key && key in perCategory) perCategory[key] += 1;
    }
  }

  if (countries.error) {
    console.warn('[cause-landing] country count failed', { code: countries.error.code });
  }

  return {
    liveCampaigns,
    raisedCents,
    supporters,
    countries: countries.error ? null : countries.count ?? 0,
    perCategory,
  };
}

/**
 * Compact display for a measured count. `null` becomes an em-dash, never "0" —
 * see the note above.
 *
 * Thresholds are deliberately high: rounding 1,240 to "1.2K" loses precision a
 * donor may care about on a page that is asking them for money, and the numbers
 * here are small enough to state exactly.
 */
export function formatStat(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en-US');
}

/** Whole dollars — cents on a headline figure are noise. */
export function formatMoneyStat(cents: number | null): string {
  if (cents === null) return '—';
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  // Exact below a million. "$12K" for $12,345 rounds away precision a donor may
  // care about on a page that is asking them for money.
  return `$${dollars.toLocaleString('en-US')}`;
}
