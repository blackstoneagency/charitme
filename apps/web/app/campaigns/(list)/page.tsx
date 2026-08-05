import Link from 'next/link';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { campaignColumns, applyLiveFilters, applyNotExpired } from '../../../lib/campaign-visibility';
import { applyCampaignSearch, likeTerm } from '../../../lib/campaign-search';
import { EmptyState } from '../../../components/ui';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { getCause } from '../../../lib/causes';
import { getTopDonors } from '../../../lib/leaderboard';
import { formatCents } from '../../../lib/stripe';
import { getCoverForCategory } from '../../../lib/photo-catalog';
import { pageWindow } from '../../../lib/pagination';
import { campaignDaysLeft, campaignTimeLabel } from '../../../lib/campaign-lifecycle';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Campaigns',
  description: 'Discover verified fundraising campaigns across medical, emergency, education, community, and more.',
  alternates: { canonical: 'https://www.charitme.com/campaigns' },
};
export const dynamic = 'force-dynamic';

type SortOption = 'raised' | 'latest' | 'donors' | 'ending' | 'trust';

/** One list of columns, so the featured row and the main list cannot drift. */
const CAMPAIGN_SELECT =
  'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score';

type CampaignRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  deadline: string | null;
  category: string | null;
  status: string | null;
  trust_status: string | null;
  nonprofit_verified: boolean | null;
  location: string | null;
  campaign_health_score: number | null;
};

const PAGE_SIZE = 12;

/**
 * The design's "Goal Range" select.
 *
 * Bands are in CENTS because `campaigns.goal_amount` is in cents — the single
 * most common way a money filter silently matches everything is comparing a
 * dollar figure against a cents column.
 */
const GOAL_RANGES = {
  any:    { label: 'Any Amount',        minCents: 0,          maxCents: null },
  small:  { label: 'Under $5,000',      minCents: 0,          maxCents: 500_000 },
  medium: { label: '$5,000 – $25,000',  minCents: 500_000,    maxCents: 2_500_000 },
  large:  { label: '$25,000 – $100,000',minCents: 2_500_000,  maxCents: 10_000_000 },
  xlarge: { label: '$100,000+',         minCents: 10_000_000, maxCents: null },
} as const;

type GoalRange = keyof typeof GOAL_RANGES;

const isGoalRange = (v: string | undefined): v is GoalRange =>
  v != null && Object.prototype.hasOwnProperty.call(GOAL_RANGES, v);

/**
 * Options for the design's "All Locations" select.
 *
 * Derived from live rows rather than a hardcoded country list, so the dropdown
 * can only ever offer a place that actually has campaigns — picking one always
 * returns results. `null` on failure, so the caller renders the plain text input
 * instead of an empty select that looks like "no locations exist".
 */
async function getLocations(): Promise<string[] | null> {
  try {
    const cols = await campaignColumns();
    const { data, error } = await boundedQuery(() =>
      applyLiveFilters(supabaseAdmin.from('campaigns').select('location'), cols)
        .not('location', 'is', null)
        .limit(2000),
    );
    if (error || !data) return null;
    const seen = new Set<string>();
    for (const row of data as { location: string | null }[]) {
      const loc = row.location?.trim();
      if (loc) seen.add(loc);
    }
    return [...seen].sort((a, b) => a.localeCompare(b)).slice(0, 60);
  } catch {
    return null;
  }
}

interface Props {
  searchParams: Promise<{
    category?: string;
    cause?: string;
    q?: string;
    sort?: string;
    verified?: string;
    location?: string;
    tax?: string;
    ending?: string;
    goal?: string;
    page?: string;
  }>;
}

async function getCampaigns(opts: {
  category?: string;
  /**
   * A cause's categories, for `?cause=`.
   *
   * ⚠️ Separate from `category` on purpose. A cause can span several categories
   * (People in Need is Family + Wishes + Memorial), so it cannot be expressed as
   * `?category=` without silently dropping the rest — which is why the cause
   * pages exist at all. `.in()` is the whole difference.
   */
  causeCategories?: readonly string[];
  q?: string;
  sort?: SortOption;
  verifiedOnly?: boolean;
  location?: string;
  taxDeductibleOnly?: boolean;
  endingSoon?: boolean;
  goalRange?: GoalRange;
  page: number;
}) {
  try {
    const cols = await campaignColumns();
    // Not-expired as well as active. `status = 'active'` is not "still running" —
    // nothing moves a campaign out of `active` when its deadline passes, so this
    // listing returned finished campaigns whose own cards rendered "Ended".
    //
    // Applied here, and not only on /causes/[slug], because the cause hub links
    // to THIS page as that cause's "All campaigns": excluding expired campaigns
    // from the cause grid and then showing them one click later would just move
    // the problem. `sort=ending` becomes genuinely "ending soonest" as a result.
    let query = applyNotExpired(
      applyLiveFilters(
        supabaseAdmin
          .from('campaigns')
          .select(CAMPAIGN_SELECT, { count: 'exact' }),
        cols,
      ),
    );

    if (opts.category) query = query.eq('category', opts.category);
    // `?cause=` narrows to the cause's categories. Applied alongside `category`
    // rather than instead of it: both present is a legitimate "this cause, this
    // category" view, and the two conditions simply intersect.
    if (opts.causeCategories?.length) query = query.in('category', [...opts.causeCategories]);
    if (opts.verifiedOnly) query = query.eq('trust_status', 'Verified');
    if (opts.taxDeductibleOnly) query = query.eq('nonprofit_verified', true);
    // Real column, real comparison — the design's "Goal Range" control is wired
    // to `goal_amount` (cents) rather than being decorative.
    if (opts.goalRange && opts.goalRange !== 'any') {
      const band = GOAL_RANGES[opts.goalRange];
      if (band) {
        query = query.gte('goal_amount', band.minCents);
        if (band.maxCents !== null) query = query.lt('goal_amount', band.maxCents);
      }
    }
    // "Ending soon" is a date comparison, not a stored flag: a campaign with a
    // deadline inside 30 days that has not already passed.
    if (opts.endingSoon) {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 864e5);
      query = query
        .not('deadline', 'is', null)
        .gte('deadline', now.toISOString())
        .lte('deadline', in30.toISOString());
    }
    if (opts.location) {
      // Strip SQL LIKE wildcards, exactly as applyCampaignSearch does one line
      // below. Without this a location of "%" matched every campaign (the filter
      // silently did nothing) and "N_w York" matched "New York". Not an injection
      // — .ilike() parameterises the value — but two adjacent inputs on the same
      // page should not escape differently.
      const safeLocation = likeTerm(opts.location);
      if (safeLocation) query = query.ilike('location', `%${safeLocation}%`);
    }
    // Tokenized multi-word keyword search (each word must match some field).
    query = applyCampaignSearch(query, opts.q);

    // Sort
    switch (opts.sort) {
      case 'latest':  query = query.order('created_at', { ascending: false }); break;
      case 'donors':  query = query.order('backer_count', { ascending: false }); break;
      case 'ending':  query = query.not('deadline', 'is', null).order('deadline', { ascending: true }); break;
      case 'trust':   query = query.order('campaign_health_score', { ascending: false }); break;
      default:        query = query.order('raised_amount', { ascending: false }); break; // 'raised'
    }

    const from = (opts.page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    // `error` is checked, not just `data`. supabase-js resolves on a query error,
    // so an unchecked read renders "No campaigns found" — telling a visitor the
    // platform has nothing to support, which is both false and the worst possible
    // moment to say it. `unavailable` lets the caller say "couldn't load" instead.
    // Bounded: the listing's own read was the remaining ~7s after the shared
    // visibility probe was capped. `unavailable` below already distinguishes a
    // failed read from an empty result set.
    const { data, count, error } = await boundedQuery(() => query.range(from, to));
    if (error || data == null) return { campaigns: [], total: 0, unavailable: true };
    return { campaigns: data, total: count ?? 0, unavailable: false };
  } catch {
    return { campaigns: [], total: 0, unavailable: true };
  }
}

/**
 * The three campaigns shown in the "Featured" row.
 *
 * "Featured" here means MOST FUNDED RIGHT NOW, computed from live data — not an
 * editorial pick and not a paid slot, because neither of those exists as a
 * concept the database can answer. The heading says so; a row labelled
 * "Featured" that quietly meant "whatever we chose" would be the kind of claim
 * this codebase keeps having to walk back.
 *
 * Shown only on an unfiltered first page. Once someone has typed a query or
 * picked a category, a fixed row of three unrelated campaigns above their
 * results is noise competing with the thing they asked for.
 */
async function getFeatured(): Promise<CampaignRow[] | null> {
  try {
    const cols = await campaignColumns();
    const { data, error } = await applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select(CAMPAIGN_SELECT),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(3);
    if (error) return null;
    return (data ?? []) as CampaignRow[];
  } catch {
    return null;
  }
}

const SORT_LABELS: Record<SortOption, string> = {
  raised:  'Most Raised',
  latest:  'Recently Added',
  donors:  'Most Donors',
  ending:  'Ending Soon',
  trust:   'Highest Trust',
};

/**
 * One glyph per category.
 *
 * A `switch` rather than a lookup keyed by string so a category added to
 * `CAMPAIGN_CATEGORIES` still renders — it falls through to the generic mark
 * instead of producing an empty circle nobody notices.
 */
function CategoryGlyph({ category }: { category: string }) {
  const p = (d: string) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  switch (category) {
    case 'Medical':
    case 'Emergency':
      return p('M12 5v14M5 12h14');
    case 'Family':
    case 'Community':
    case 'Volunteer':
      return p('M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9');
    case 'Education':
      return p('M3 8l9-4 9 4-9 4-9-4zM7 11v5c0 1.1 2.2 2 5 2s5-.9 5-2v-5');
    case 'Animal':
      return p('M12 21c4-2.5 7-5.6 7-9a4 4 0 0 0-7-2.6A4 4 0 0 0 5 12c0 3.4 3 6.5 7 9z');
    case 'Environment':
      return p('M12 21V9M12 9c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6zM12 13c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5z');
    case 'Memorial':
    case 'Faith':
      return p('M12 3v18M7 8h10');
    case 'Sports':
    case 'Competition':
      return p('M7 4h10v4a5 5 0 0 1-10 0V4zM9 20h6M12 13v7');
    case 'Creative':
    case 'Wishes':
      return p('M12 3l2.4 5.6L20 9.6l-4 4 1 6-5-2.9L7 19.6l1-6-4-4 5.6-1z');
    case 'Travel':
      return p('M2 12l20-7-7 20-3-8-8-3z');
    case 'Business':
    case 'Nonprofit':
      return p('M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2');
    case 'Event':
      return p('M4 6h16v14H4zM4 10h16M9 3v4M15 3v4');
    default:
      return p('M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z');
  }
}

export default async function CampaignsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = sp.category;
  // ⚠️ Every cause page's "All campaigns" tab links here with `?cause=`, and
  // this page IGNORED it — so the tab rendered the whole unfiltered list under a
  // label promising one cause. A link that looks filtered and is not is worse
  // than no link, and it is exactly what the deleted `cause-ways-core` `scoped`
  // flag existed to catch.
  //
  // An unknown slug resolves to `undefined` and the list stays unfiltered rather
  // than erroring — a bad query string should not 500 the campaigns page.
  const cause    = typeof sp.cause === 'string' ? getCause(sp.cause) : undefined;
  const q        = sp.q;
  const sort     = (sp.sort as SortOption | undefined) ?? 'raised';
  const verified = sp.verified === '1';
  const location = sp.location;
  const tax      = sp.tax === '1';
  const ending   = sp.ending === '1';
  const goal     = isGoalRange(sp.goal) ? sp.goal : 'any';
  const page     = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const hasFilters = Boolean(
    q || category || cause || verified || tax || ending || location || goal !== 'any' || sort !== 'raised',
  );
  const showExtras = page === 1 && !hasFilters;

  // The sidebar panels and the featured row are supplementary — a failure in any
  // of them must not take the campaign list with it, so each resolves to null
  // and simply renders nothing rather than throwing the page away.
  const [{ campaigns, total, unavailable }, featured, topDonors, locations] = await Promise.all([
    getCampaigns({
      category, causeCategories: cause?.categories, q, sort, verifiedOnly: verified, location,
      taxDeductibleOnly: tax, endingSoon: ending, goalRange: goal, page,
    }),
    showExtras ? getFeatured() : Promise.resolve(null),
    showExtras
      ? getTopDonors('all', 5).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof getTopDonors>>),
    getLocations(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currencyMap = new Map<string, string>();
  if (campaigns.length > 0) {
    const { data: launchSettings } = await boundedQuery(() => supabaseAdmin
      .from('campaign_launch_settings')
      .select('campaign_id, currency')
      .in('campaign_id', campaigns.map((c) => c.id)));
    for (const ls of launchSettings ?? []) {
      if (ls.currency) currencyMap.set(ls.campaign_id, ls.currency);
    }
  }

  /**
   * Every `/campaigns` link on this page, from one place.
   *
   * ⚠️ `pageHref` and `catHref` were two near-identical copies of this list, and
   * adding `?cause=` had to be remembered in BOTH — plus the hidden inputs on
   * the filters form. It was not: paging to page 2, or picking a category tile,
   * silently dropped the cause and dumped the visitor on the unfiltered list at
   * the moment they tried to narrow further.
   *
   * One builder, so a param added here cannot be carried by some links and not
   * others. This repo has been bitten by hand-maintained duplicates before —
   * the category list drifted three ways for the same reason.
   */
  function campaignsHref(over: { page?: number; category?: string | null } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (location) params.set('location', location);
    const cat = over.category === undefined ? category : over.category;
    if (cat) params.set('category', cat);
    if (cause) params.set('cause', cause.slug);
    if (sort !== 'raised') params.set('sort', sort);
    if (verified) params.set('verified', '1');
    if (tax) params.set('tax', '1');
    if (ending) params.set('ending', '1');
    if (goal !== 'any') params.set('goal', goal);
    if (over.page && over.page > 1) params.set('page', String(over.page));
    const qs = params.toString();
    return `/campaigns${qs ? `?${qs}` : ''}`;
  }

  const pageHref = (targetPage: number) => campaignsHref({ page: targetPage });
  // `category: null` clears the category rather than inheriting it — that is
  // what the "All" tile means.
  const catHref = (c: string | null) => campaignsHref({ category: c });

  const money = (cents: number, id: string) => formatCents(cents, currencyMap.get(id) ?? 'usd');
  const pct = (c: CampaignRow) =>
    c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
  // The countdown comes from the shared helpers, never from arithmetic here:
  // `__tests__/campaign-lifecycle.test.ts` refuses a surface that formats its
  // own, which is how "3 days left" and "Ended" once appeared side by side for
  // the same campaign.
  //
  // `now` is deliberately NOT passed. Reading `Date.now()` in a component body
  // is an impure call and Next rejects it at build time; letting the helper
  // apply its own default keeps the clock read inside the library, which is what
  // every other surface here does.
  const timeLabelFor = (c: CampaignRow) =>
    campaignTimeLabel({ status: c.status ?? 'active', deadline: c.deadline });
  const daysLeftFor = (c: CampaignRow) => campaignDaysLeft(c.deadline);

  return (
    <div className="cb-page">
      <nav aria-label="Breadcrumb" className="cb-crumbs">
        <Link href="/">Home</Link>
        <span aria-hidden="true">&rsaquo;</span>
        <Link href="/causes">People in Need</Link>
        <span aria-hidden="true">&rsaquo;</span>
        <b aria-current="page">Campaigns</b>
      </nav>

      {/* ── Hero band ─────────────────────────────────────────────────────────
          A self-contained dark band, not a page-background change: the page base
          is flat black in dark mode and must stay that way, so this paints its
          own surface and never leaks a colour onto <body>. */}
      <section className="cbx-hero">
        <div className="cbx-hero-copy">
          <h1>
            Campaigns<br />That Change Lives{' '}
            <span className="cbx-hero-heart" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            </span>
          </h1>
          <p>
            Every campaign represents hope in action. Join thousands of people supporting urgent
            needs and building a better world.
          </p>

          {/* Same GET target as the filter form below, so the hero search is the
              real search rather than a second one that disagrees with it. */}
          <form method="GET" action="/campaigns" className="cbx-hero-search" role="search">
            <label htmlFor="cbx-hero-q" className="sr-only">Search campaigns</label>
            <input id="cbx-hero-q" name="q" defaultValue={q} placeholder="Search campaigns..." />
            <button type="submit" aria-label="Search campaigns">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
              </svg>
            </button>
          </form>
        </div>
        {/* The reference art carries a photograph here. It comes from the repo's
            own `photo-catalog` — the same source /causes uses via IndexHero — so
            this is not an unlicensed stock image dropped onto the busiest
            marketing page. Decorative, hence empty alt and aria-hidden: the
            heading beside it already carries the meaning. */}
        <div className="cbx-hero-art" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getCoverForCategory('Community')} alt="" loading="eager" />
        </div>
      </section>

      {/* ── Category strip ────────────────────────────────────────────────────
          The reference art labels these tiles "Emergency Aid", "Food & Hunger",
          "Shelter & Housing", "Children & Youth", "Women & Families". NONE of
          those exist in `CAMPAIGN_CATEGORIES`, which is the single source of
          truth and what `campaigns.category` is actually filtered on. Tiles with
          those labels would each land on an empty page.
          So the STRIP is reproduced exactly — circular tinted icon over a label —
          and filled with the real categories, every one of which filters. */}
      <nav aria-label="Browse by category" className="cbx-cats">
        <Link href={catHref(null)} className={`cbx-cat${!category ? ' is-active' : ''}`}>
          <span className="cbx-cat-icon" data-cat="All" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </span>
          <span className="cbx-cat-label">All Campaigns</span>
        </Link>
        {CAMPAIGN_CATEGORIES.map((c) => (
          <Link key={c} href={catHref(c)} className={`cbx-cat${category === c ? ' is-active' : ''}`}>
            <span className="cbx-cat-icon" data-cat={c} aria-hidden="true">
              <CategoryGlyph category={c} />
            </span>
            <span className="cbx-cat-label">{c}</span>
          </Link>
        ))}
      </nav>

      <div className="cbx-layout">
        {/* ── Filters rail ──────────────────────────────────────────────────── */}
        <aside className="cbx-filters" aria-label="Filter campaigns">
          <form method="GET" action="/campaigns">
            <div className="cbx-filters-head">
              <h2>Filters</h2>
              {hasFilters && <Link href="/campaigns">Clear all</Link>}
            </div>

            {/* Carried so the rail does not silently drop a hero search or a
                category tile the visitor already chose. */}
            {q && <input type="hidden" name="q" value={q} />}
            {category && <input type="hidden" name="category" value={category} />}
            {/* Same reason, and easy to miss when adding a param: without this,
                arriving from a cause hub and then ticking ANY filter drops the
                cause and lands the visitor on the unfiltered list — the scope
                disappearing at the moment they tried to narrow further. */}
            {cause && <input type="hidden" name="cause" value={cause.slug} />}

            <div className="cbx-field">
              <label htmlFor="cbx-sort">Sort by</label>
              <select id="cbx-sort" name="sort" defaultValue={sort}>
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* The design's "Campaign Type" group. Its labels (Urgent Needs,
                Long-Term Projects, Rebuilding & Recovery) have no column behind
                them, so the GROUP is reproduced with the three filters that are
                real and that donors actually act on. A checkbox that changes
                nothing is worse than one fewer checkbox. */}
            <fieldset className="cbx-field cbx-checks">
              <legend>Campaign type</legend>
              <label>
                <input type="checkbox" name="verified" value="1" defaultChecked={verified} />
                <span>Verified only</span>
              </label>
              <label>
                <input type="checkbox" name="tax" value="1" defaultChecked={tax} />
                <span>Tax-deductible</span>
              </label>
              <label>
                <input type="checkbox" name="ending" value="1" defaultChecked={ending} />
                <span>Ending soon</span>
              </label>
            </fieldset>

            <div className="cbx-field">
              <label htmlFor="cbx-loc">Location</label>
              {/* A select only when we could actually read the places that have
                  campaigns; otherwise a text input, so a failed read degrades to
                  a usable control rather than an empty dropdown that reads as
                  "there are no locations". */}
              {locations && locations.length > 0 ? (
                <select id="cbx-loc" name="location" defaultValue={location ?? ''}>
                  <option value="">All Locations</option>
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : (
                <input id="cbx-loc" name="location" defaultValue={location} placeholder="All Locations" />
              )}
            </div>

            <div className="cbx-field">
              <label htmlFor="cbx-goal">Goal range</label>
              <select id="cbx-goal" name="goal" defaultValue={goal}>
                {(Object.entries(GOAL_RANGES) as [GoalRange, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="cbx-apply">Apply Filters</button>
          </form>

          <section className="cbx-start">
            <span className="cbx-start-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            </span>
            <h2>Start Your Own Campaign</h2>
            <p>Create a campaign and rally your community to make a difference.</p>
            <Link href="/create/choose-path" className="cbx-start-cta">Start a Fundraiser &rarr;</Link>
          </section>
        </aside>

        {/* ── Main column ───────────────────────────────────────────────────── */}
        <div className="cbx-main">
          {featured && featured.length > 0 && (
            <section aria-labelledby="cbx-featured">
              <div className="cb-section-head">
                {/* "Featured" is MOST FUNDED RIGHT NOW, computed live. There is
                    no editorial-pick or paid-slot concept in the schema, so the
                    row cannot claim to be one. */}
                <h2 id="cbx-featured">Featured Campaigns</h2>
                <Link href="/campaigns?sort=raised">View All Featured <span aria-hidden="true">&rarr;</span></Link>
              </div>
              <div className="cbx-feat-grid">
                {featured.map((c) => {
                  const d = daysLeftFor(c);
                  return (
                    <article key={c.id} className="cbx-feat">
                      <Link href={`/campaigns/${c.slug}`} className="cbx-feat-media">
                        {c.cover_image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={c.cover_image_url} alt="" loading="lazy" />
                          : <span className="cbx-feat-ph" aria-hidden="true" />}
                        {c.category && <span className="cbx-feat-badge">{c.category}</span>}
                      </Link>
                      <div className="cbx-feat-body">
                        <h3><Link href={`/campaigns/${c.slug}`}>{c.title}</Link></h3>
                        {c.location && (
                          <p className="cbx-feat-loc">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" />
                            </svg>
                            {c.location}
                          </p>
                        )}
                        {c.tagline && <p className="cbx-feat-lede">{c.tagline}</p>}
                        <div className="cbx-feat-figures">
                          <strong>{money(c.raised_amount, c.id)} raised</strong>
                          <span>{money(c.goal_amount, c.id)} goal</span>
                        </div>
                        <div className="cbx-bar" role="img" aria-label={`${pct(c)}% funded`}>
                          <span style={{ width: `${pct(c)}%` }} />
                        </div>
                        <div className="cbx-feat-meta">
                          <span>{c.backer_count.toLocaleString()} supporters</span>
                          {d !== null && <span>{timeLabelFor(c)}</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <div className="cb-section-head">
            <h2 id="cb-all">All Campaigns</h2>
            <span className="cb-count">
              {unavailable
                ? '\u2014'
                : total === 0
                  ? 'No campaigns'
                  : `Showing ${((page - 1) * PAGE_SIZE + 1).toLocaleString()}-${Math.min(page * PAGE_SIZE, total).toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>

          {unavailable ? (
            // Distinct from "no results": one is a fact about the search, the other
            // is a fault on our side. Telling a would-be donor there is nothing to
            // support when the database simply failed is the wrong answer to the
            // wrong question.
            <EmptyState
              icon="&#9888;&#65039;"
              title="We couldn't load campaigns just now"
              body="This is a problem on our side, not an empty catalogue. Please refresh in a moment."
              action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
            />
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon="&#128269;"
              title="No campaigns found"
              body="Try different keywords, remove filters, or browse all campaigns."
              action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Clear filters</Link>}
            />
          ) : (
            <ul className="cbx-list">
              {campaigns.map((c) => {
                const d = daysLeftFor(c);
                return (
                  <li key={c.id} className="cbx-row">
                    <Link href={`/campaigns/${c.slug}`} className="cbx-row-media" aria-hidden="true" tabIndex={-1}>
                      {c.cover_image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.cover_image_url} alt="" loading="lazy" />
                        : <span className="cbx-feat-ph" />}
                    </Link>
                    <div className="cbx-row-body">
                      {c.category && <span className="cbx-row-badge">{c.category}</span>}
                      <h3><Link href={`/campaigns/${c.slug}`}>{c.title}</Link></h3>
                      {c.location && <p className="cbx-row-loc">{c.location}</p>}
                      {c.tagline && <p className="cbx-row-lede">{c.tagline}</p>}
                    </div>
                    <div className="cbx-row-figures">
                      <strong>{money(c.raised_amount, c.id)} raised</strong>
                      <div className="cbx-bar cbx-bar-sm" role="img" aria-label={`${pct(c)}% funded`}>
                        <span style={{ width: `${pct(c)}%` }} />
                      </div>
                      <span className="cbx-row-meta">
                        {c.backer_count.toLocaleString()} supporters{d !== null ? ` \u00b7 ${timeLabelFor(c)}` : ''}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <nav className="cbx-pager" aria-label="Pagination">
              {page > 1
                ? <Link href={pageHref(page - 1)} className="cbx-pg" aria-label="Previous page">&lsaquo;</Link>
                : <span className="cbx-pg is-off" aria-hidden="true">&lsaquo;</span>}
              {pageWindow(page, totalPages).map((n, i) =>
                n === null
                  ? <span key={`gap-${i}`} className="cbx-pg-gap" aria-hidden="true">&hellip;</span>
                  : n === page
                    ? <span key={n} className="cbx-pg is-current" aria-current="page">{n}</span>
                    : <Link key={n} href={pageHref(n)} className="cbx-pg">{n}</Link>,
              )}
              {page < totalPages
                ? <Link href={pageHref(page + 1)} className="cbx-pg" aria-label="Next page">&rsaquo;</Link>
                : <span className="cbx-pg is-off" aria-hidden="true">&rsaquo;</span>}
            </nav>
          )}
        </div>

        {/* ── Ways-to-help rail ─────────────────────────────────────────────── */}
        <aside className="cb-aside" aria-label="Ways to help">
          <section className="cb-panel">
            <h2>Make an Impact Today</h2>
            <p className="cb-panel-lede">Small actions lead to big changes.</p>
            <ul className="cb-actions">
              <li>
                <Link href="/give">
                  <strong>Donate</strong>
                  <span>Support a campaign that matters to you.</span>
                </Link>
              </li>
              <li>
                <Link href="/create/choose-path">
                  <strong>Share</strong>
                  <span>Spread the word and inspire others.</span>
                </Link>
              </li>
              <li>
                <Link href="/get-involved">
                  <strong>Volunteer</strong>
                  <span>Give your time and skills to help.</span>
                </Link>
              </li>
            </ul>
            <Link href="/get-involved" className="cta-primary cb-panel-cta">Get Involved</Link>
          </section>

          {/* Top DONORS, not "Top Fundraisers".
              The reference art labels this panel "Top Fundraisers" and lists
              people with an amount. The only person-level aggregate that exists
              is getTopDonors() — money GIVEN, not money RAISED. Rendering givers
              under a "fundraisers" heading would misdescribe every name on it, so
              the heading matches the data.
              The loader already excludes anonymous donations and respects each
              profile's showPublicProfile flag, so nobody appears who did not
              choose to be visible. */}
          {topDonors.length > 0 && (
            <section className="cb-panel">
              <div className="cb-section-head">
                <h2>Top donors</h2>
                <Link href="/leaderboard">View All <span aria-hidden="true">&rarr;</span></Link>
              </div>
              <ol className="cb-donors">
                {topDonors.map((d) => (
                  <li key={d.donorId}>
                    <span className="cb-rank">{d.rank}</span>
                    <span className="cb-donor-name">{d.name}</span>
                    <span className="cb-donor-amount">{formatCents(d.totalCents, 'usd')}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* The reference art also carries a named testimonial ("Jessica M.,
              Donor"). It is deliberately not reproduced: there is no testimonials
              table, so the quote and the person would both have to be written by
              us and presented as a real supporter's words. That is fabricating a
              review. If real, consented testimonials are collected later, this is
              where they belong. */}
        </aside>
      </div>{/* /.cb-layout */}
    </div>
  );
}
