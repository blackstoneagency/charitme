import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
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

/** Every field null — what an unreadable database honestly looks like here. */
const UNMEASURED: CauseStats = {
  liveCampaigns: null,
  raisedCents: null,
  supporters: null,
  countries: null,
  perCategory: {},
};

const CAUSE_STATS_SCAN_LIMIT = 2000;

export async function getCauseStats(cause: Cause): Promise<CauseStats> {
  try {
  const cols = await campaignColumns();

  // Bounded like every other discovery read. Both were unbounded, which put the
  // cause page back to ~8.6s TTFB against a stalled database after it had been
  // brought to ~4.2s. A timeout yields `{ data: null, error }`, and every figure
  // below is already `number | null` rendering as an em dash — so a slow
  // database shows "—", never a fabricated zero.
  const [rows, countries] = await Promise.all([
    // Both bounds, deliberately. Master added `.limit()` (a ROW bound — stops an
    // unbounded scan) and this lane added `boundedQuery` (a TIME bound — stops a
    // stalled connection). They solve different failures: a row cap does nothing
    // when the database never answers, and a deadline does nothing about a query
    // that answers slowly because it read the whole table.
    boundedQuery(() =>
      applyLiveFilters(
        supabaseAdmin.from('campaigns').select('category, raised_amount, backer_count'),
        cols,
      )
        .in('category', [...cause.categories])
        .limit(CAUSE_STATS_SCAN_LIMIT),
    ),
    boundedQuery(() =>
      supabaseAdmin
        .from('supported_countries')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .eq('can_donate', true),
    ),
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
  } catch {
    // `supabaseAdmin` throws on property access when the env is missing, before
    // any query runs — which the `rows.error` / `countries.error` checks above
    // cannot see, and which 500'd /causes/[slug] outright.
    //
    // This guard existed in the page-local copy of this function that the #196
    // merge deleted in favour of this shared one. Consolidating was right — two
    // implementations of one statistic is how two surfaces quote different
    // numbers — but it dropped the guard with the duplicate. Restored here, where
    // it now covers every caller instead of one.
    return UNMEASURED;
  }
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

/**
 * "Stories from the field" — the campaigns in this cause that actually finished.
 *
 * ⚠️ The reference draws these as VIDEO cards with a play button over each photo.
 * There is no playable video behind them: the 50 `campaign_media` rows with
 * `media_type = 'video'` all point at `storage.CharitMe.example`, a reserved TLD
 * that cannot resolve. A play button that opens a campaign page instead of
 * playing something is a fake affordance, so these are story cards that link to
 * the campaign and say so.
 *
 * Ordered by amount raised: the most-funded finished campaigns are the ones with
 * a story worth reading. `null` on failure, never an empty list, so the caller
 * can tell "we could not load these" from "none yet".
 */
export interface CauseStory {
  id: string;
  slug: string;
  title: string;
  blurb: string | null;
  category: string | null;
  cover: string | null;
  raisedCents: number;
  backers: number;
}

export async function getCauseStories(cause: Cause, limit = 3): Promise<CauseStory[] | null> {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, description, category, cover_image_url, raised_amount, backer_count')
    .in('category', [...cause.categories])
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('raised_amount', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[cause-landing] stories read failed', { code: error.code });
    return null;
  }
  return (data ?? []).map((c) => ({
    id: c.id as string,
    slug: c.slug as string,
    title: c.title as string,
    blurb: ((c.tagline as string | null) ?? (c.description as string | null) ?? null),
    category: (c.category as string | null) ?? null,
    cover: (c.cover_image_url as string | null) ?? null,
    raisedCents: Number(c.raised_amount ?? 0),
    backers: Number(c.backer_count ?? 0),
  }));
}
