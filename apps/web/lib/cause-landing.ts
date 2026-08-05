import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import { campaignColumns, applyLiveFilters, applyVisibilityFilters, applyNotExpired } from './campaign-visibility';
import type { Cause } from './causes';
import type { CauseStoryRow, CauseImpactStatRow, EmbeddedCampaignSlug } from './database.types';

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
}

/** Every field null — what an unreadable database honestly looks like here. */
const UNMEASURED: CauseStats = {
  liveCampaigns: null,
  raisedCents: null,
  supporters: null,
  countries: null,
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
      // Expired campaigns excluded, matching the grid directly below this tile.
      // The tile is labelled "Live campaigns"; counting a campaign whose deadline
      // has passed makes the number disagree with the six cards under it, and the
      // cards are the checkable half.
      applyNotExpired(
        applyLiveFilters(
          supabaseAdmin.from('campaigns').select('category, raised_amount, backer_count'),
          cols,
        ),
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
  }

  if (countries.error) {
    console.warn('[cause-landing] country count failed', { code: countries.error.code });
  }

  return {
    liveCampaigns,
    raisedCents,
    supporters,
    countries: countries.error ? null : countries.count ?? 0,
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
  /** Campaign slug when the story links to one; `null` for editorial-only. */
  slug: string | null;
  title: string;
  blurb: string | null;
  category: string | null;
  cover: string | null;
  raisedCents: number;
  backers: number;
  /**
   * Present only for authored `cause_stories` rows that carry a video.
   *
   * ⚠️ This is what makes the reference's play control honest. It renders when
   * and only when there is something to play — the design draws a play button on
   * every card, but every `campaign_media` video row in this database points at
   * `storage.CharitMe.example`, a reserved TLD that cannot resolve. A control
   * that plays nothing is a dead affordance, so the card degrades to a read link
   * when this is null.
   */
  videoUrl: string | null;
  /** Chip label as the design draws it, e.g. "YOUTH EMPOWERMENT". */
  chipLabel: string | null;
  /** 0-2, selecting the chip's accent colour. */
  chipAccent: number;
}

/**
 * Authored stories for a cause, from `cause_stories`.
 *
 * `null` distinguishes "could not read" from "none authored" — the caller falls
 * back to completed campaigns only in the SECOND case, so a database blip never
 * silently swaps editorial content for an approximation of it.
 *
 * The `cause_stories` migration may not be applied yet. Postgres reports an
 * unknown relation as `42P01`, which is treated as "none authored" rather than a
 * failure: on a deployment without the table the page must fall back cleanly,
 * exactly as `campaign-visibility` treats a missing column.
 */
async function getAuthoredStories(cause: Cause, limit: number): Promise<CauseStory[] | null> {
  const { data, error } = await boundedQuery(() =>
    supabaseAdmin
      .from('cause_stories')
      .select('id, title, blurb, chip_label, chip_accent, poster_url, video_url, campaigns:campaign_id(slug)')
      .eq('cause_slug', cause.slug)
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
      .limit(limit),
  );

  if (error) {
    if (error.code === '42P01') return [];
    console.warn('[cause-landing] authored stories read failed', { code: error.code });
    return null;
  }

  type Row = Pick<CauseStoryRow, 'id' | 'title' | 'blurb' | 'chip_label' | 'chip_accent' | 'poster_url' | 'video_url'>
    & { campaigns: EmbeddedCampaignSlug };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const campaign = r.campaigns;
    return {
      id: r.id,
      slug: campaign?.slug ?? null,
      title: r.title,
      blurb: r.blurb ?? null,
      category: null,
      cover: r.poster_url ?? null,
      raisedCents: 0,
      backers: 0,
      videoUrl: r.video_url ?? null,
      chipLabel: r.chip_label ?? null,
      chipAccent: Number(r.chip_accent ?? 0),
    };
  });
}

export async function getCauseStories(cause: Cause, limit = 3): Promise<CauseStory[] | null> {
  try {
  // Authored stories are the design's intent; completed campaigns are the
  // fallback that keeps the section alive before any are written.
  const authored = await getAuthoredStories(cause, limit);
  if (authored === null) return null;
  if (authored.length > 0) return authored;

  // `status` is set here rather than by `applyLiveFilters`, which pins
  // `status = 'active'` — the opposite of what this reads. Visibility is still
  // applied, so a completed campaign the owner has since made private does not
  // reappear as a public "story".
  const cols = await campaignColumns();
  // Bounded like every other read on this page. Unbounded, a stalled database
  // held the whole cause page open; the `error` branch below already renders
  // "we could not load these" rather than "none yet".
  const { data, error } = await boundedQuery(() =>
    applyVisibilityFilters(
      supabaseAdmin
        .from('campaigns')
        .select('id, slug, title, tagline, description, category, cover_image_url, raised_amount, backer_count'),
      cols,
    )
      .in('category', [...cause.categories])
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('raised_amount', { ascending: false })
      .limit(limit),
  );
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
    // A campaign is not a video story: no play control, no editorial chip.
    videoUrl: null,
    chipLabel: null,
    chipAccent: 0,
  }));
  } catch {
    // Same guard as `getCauseStats`: `supabaseAdmin` throws on property access
    // when the env is missing, before any query runs, which no `error` check can
    // see. Without it this 500'd the whole cause page.
    return null;
  }
}

/**
 * An owner-authored figure for the "Real Impact" band.
 *
 * `value` is a display string ("125K+", "1,250+"), because that is what the
 * design shows and formatting it in code would lose the "+".
 */
export interface AuthoredStat {
  value: string;
  label: string;
  icon: number;
}

/**
 * The four figures the design draws, when the owner has authored them.
 *
 * ⚠️ Returns `[]` — not `null` — when nothing is authored or the table is
 * absent (`42P01`), so the caller falls back to MEASURED counts. That fallback
 * is the whole safety property: an unseeded or un-migrated deployment shows real
 * numbers rather than an empty band or invented ones.
 *
 * Why this exists at all: "125K+ Youth Impacted" is not derivable from this
 * schema, and hardcoding it would put an unverifiable claim in front of donors
 * with an engineer as its only author. Authored rows make the platform owner the
 * author, which is who it should be.
 */
export async function getAuthoredStats(cause: Cause): Promise<AuthoredStat[]> {
  try {
    const { data, error } = await boundedQuery(() =>
      supabaseAdmin
        .from('cause_impact_stats')
        .select('value, label, icon')
        .eq('cause_slug', cause.slug)
        .eq('published', true)
        .order('sort_order', { ascending: true })
        .limit(4),
    );
    if (error) {
      if (error.code !== '42P01') {
        console.warn('[cause-landing] authored stats read failed', { code: error.code });
      }
      return [];
    }
    type StatRow = Pick<CauseImpactStatRow, 'value' | 'label' | 'icon'>;
    return ((data ?? []) as unknown as StatRow[]).map((r) => ({
      value: r.value,
      label: r.label,
      icon: Number(r.icon ?? 0),
    }));
  } catch {
    return [];
  }
}
