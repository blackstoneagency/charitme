import Link from 'next/link';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../../lib/campaign-visibility';
import { applyCampaignSearch, likeTerm } from '../../../lib/campaign-search';
import { EmptyState } from '../../../components/ui';
import { CampaignCard, CampaignGrid } from '../../../components/CampaignCard';
import { IndexHero, StatStrip, statValue, moneyValue } from '../../../components/IndexHero';
import { getCausesIndexData } from '../../../lib/causes-index';
import { getCoverForCategory } from '../../../lib/photo-catalog';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { getTopDonors } from '../../../lib/leaderboard';
import { formatCents } from '../../../lib/stripe';
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

const PAGE_SIZE = 60;

interface Props {
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    verified?: string;
    location?: string;
    tax?: string;
    page?: string;
  }>;
}

async function getCampaigns(opts: {
  category?: string;
  q?: string;
  sort?: SortOption;
  verifiedOnly?: boolean;
  location?: string;
  taxDeductibleOnly?: boolean;
  page: number;
}) {
  try {
    const cols = await campaignColumns();
    let query = applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select(CAMPAIGN_SELECT, { count: 'exact' }),
      cols,
    );

    if (opts.category) query = query.eq('category', opts.category);
    if (opts.verifiedOnly) query = query.eq('trust_status', 'Verified');
    if (opts.taxDeductibleOnly) query = query.eq('nonprofit_verified', true);
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

export default async function CampaignsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = sp.category;
  const q        = sp.q;
  const sort     = (sp.sort as SortOption | undefined) ?? 'raised';
  const verified = sp.verified === '1';
  const location = sp.location;
  const tax      = sp.tax === '1';
  const page     = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const hasFilters = Boolean(q || category || verified || tax || location || sort !== 'raised');
  const showExtras = page === 1 && !hasFilters;

  // The sidebar panels and the featured row are supplementary — a failure in any
  // of them must not take the campaign list with it, so each resolves to null
  // and simply renders nothing rather than throwing the page away.
  const [{ campaigns, total, unavailable }, featured, topDonors, platform] = await Promise.all([
    getCampaigns({ category, q, sort, verifiedOnly: verified, location, taxDeductibleOnly: tax, page }),
    showExtras ? getFeatured() : Promise.resolve(null),
    showExtras
      ? getTopDonors('all', 5).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof getTopDonors>>),
    getCausesIndexData(),
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

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (location) params.set('location', location);
    if (category) params.set('category', category);
    if (sort !== 'raised') params.set('sort', sort);
    if (verified) params.set('verified', '1');
    if (tax) params.set('tax', '1');
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return `/campaigns${qs ? `?${qs}` : ''}`;
  }

  const catHref = (c: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (location) params.set('location', location);
    if (c) params.set('category', c);
    if (sort !== 'raised') params.set('sort', sort);
    if (verified) params.set('verified', '1');
    if (tax) params.set('tax', '1');
    const qs = params.toString();
    return `/campaigns${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="cb-page">
      {/* Same hero and stats strip as /causes, from the SHARED component rather
          than a second copy — a lookalike would drift exactly where it matters
          most, in the scrim that keeps the text readable over an arbitrary
          photo. Figures come from the same loader too, so the two browse
          indexes cannot state different platform totals. */}
      <IndexHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Causes', href: '/causes' }, { label: 'Campaigns' }]}
        title="Campaigns that change lives"
        lede="Every campaign here is a real fundraiser with a real goal. Search by cause, place, or keyword — or browse what people are supporting right now."
        photo={getCoverForCategory('Community')}
        photoCategory="Community"
        photoKey="campaigns-index"
        card={{
          title: 'See exactly what you are supporting.',
          body: 'Each card shows a CharitScore trust rating, how much has been raised, and how long is left — before you give.',
        }}
        actions={
          <>
            <Link href="/create" className="cta-primary" style={{ display: 'inline-flex' }}>
              Start a fundraiser
            </Link>
            <Link href="/how-it-works" className="cx-btn-secondary">How it works</Link>
          </>
        }
      />

      <StatStrip
        label="CharitMe at a glance"
        tiles={[
          { value: statValue(platform.activeCampaigns), label: 'Active campaigns' },
          { value: moneyValue(platform.raisedTotalCents), label: 'Raised on CharitMe' },
          { value: statValue(platform.gifts), label: 'Gifts given' },
          { value: statValue(platform.countries), label: 'Countries supported' },
        ]}
      />

      {/* Category chips. Built from CAMPAIGN_CATEGORIES, the single source of
          truth in @shared/fees — three hand-maintained copies of this list had
          already drifted apart before it was centralised, so the row cannot
          advertise a category the rest of the app does not know about. */}
      <nav aria-label="Browse by category" className="cb-chips">
        <Link href={catHref(null)} className={`cb-chip${!category ? ' is-active' : ''}`}>
          All Campaigns
        </Link>
        {CAMPAIGN_CATEGORIES.map((c) => (
          <Link key={c} href={catHref(c)} className={`cb-chip${category === c ? ' is-active' : ''}`}>
            {c}
          </Link>
        ))}
      </nav>

      <div className="cb-layout">
      <div className="cb-main">

      {/* ── Search + filter bar ── */}
      <form method="GET" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', minWidth: 0, gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            name="q"
            defaultValue={q}
            aria-label="Search campaigns"
            placeholder="Search campaigns…"
            className="cmp-filter-input"
            style={{ flex: '1 1 220px', padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', outline: 'none', background: 'var(--s1, #fff)', color: 'var(--t1)' }}
          />
          <input
            name="location"
            defaultValue={location}
            aria-label="Filter by location"
            placeholder="Location…"
            className="cmp-filter-input"
            style={{ flex: '0 1 140px', padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', outline: 'none', background: 'var(--s1, #fff)', color: 'var(--t1)' }}
          />
          <select name="category" defaultValue={category ?? ''} aria-label="Filter by category"
            style={{ padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', background: 'var(--s1, #fff)', color: 'var(--t1)', cursor: 'pointer' }}>
            <option value="">All categories</option>
            {CAMPAIGN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort campaigns"
            style={{ padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', background: 'var(--s1, #fff)', color: 'var(--t1)', cursor: 'pointer' }}>
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button type="submit" style={{ padding: '10px 20px', background: '#08763b', color: '#fff', borderRadius: 'var(--r)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', border: 'none' }}>
            Search
          </button>
        </div>

        {/* ── Toggle filters — submitted together with the search above so typed
             keywords/location aren't lost when toggling these checkboxes ── */}
        <div style={{ display: 'flex', minWidth: 0, gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="cb-filter-pill verified">
            <input type="checkbox" name="verified" value="1" defaultChecked={verified} />
            <span>✓ Verified only</span>
          </label>
          <label className="cb-filter-pill tax">
            <input type="checkbox" name="tax" value="1" defaultChecked={tax} />
            <span>💚 Tax-deductible</span>
          </label>
          {(q || category || verified || tax || location || sort !== 'raised') && (
            <Link href="/campaigns" style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', border: '1.5px solid var(--b2)', color: 'var(--t3)' }}>
              ✕ Clear all
            </Link>
          )}
          <span style={{ fontSize: '13px', color: 'var(--t3)', marginLeft: 4 }}>
            {total} campaign{total !== 1 ? 's' : ''} found
          </span>
        </div>
      </form>

      {featured && featured.length > 0 && (
        <section aria-labelledby="cb-featured" className="cb-featured">
          <div className="cb-section-head">
            <h2 id="cb-featured">Most funded right now</h2>
            <Link href="/campaigns?sort=raised">View all <span aria-hidden="true">→</span></Link>
          </div>
          <CampaignGrid>
            {featured.map((c) => (
              <CampaignCard key={c.id} campaign={c} currency={currencyMap.get(c.id) ?? 'usd'} />
            ))}
          </CampaignGrid>
        </section>
      )}

      <div className="cb-section-head">
        <h2 id="cb-all">All campaigns</h2>
        <span className="cb-count">
          {unavailable ? '—' : `${total.toLocaleString()} campaign${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {unavailable ? (
        // Distinct from "no results": one is a fact about the search, the other is
        // a fault on our side. Telling a would-be donor there is nothing to support
        // when the database simply failed is the wrong answer to the wrong question.
        <EmptyState
          icon="⚠️"
          title="We couldn't load campaigns just now"
          body="This is a problem on our side, not an empty catalogue. Please refresh in a moment."
          action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No campaigns found"
          body="Try different keywords, remove filters, or browse all campaigns."
          action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Clear filters</Link>}
        />
      ) : (
        <CampaignGrid>
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} currency={currencyMap.get(c.id) ?? 'usd'} />
          ))}
        </CampaignGrid>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', minWidth: 0, justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '32px' }}>
          {page > 1 ? (
            <Link href={pageHref(page - 1)} style={{ padding: '10px 18px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              ← Previous
            </Link>
          ) : (
            <span style={{ padding: '10px 18px', borderRadius: 'var(--r)', border: '1px solid var(--b1)', color: 'var(--t4)', fontSize: '13px', fontWeight: 700 }}>
              ← Previous
            </span>
          )}
          <span style={{ fontSize: '13px', color: 'var(--t3)', fontWeight: 700 }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} style={{ padding: '10px 18px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              Next →
            </Link>
          ) : (
            <span style={{ padding: '10px 18px', borderRadius: 'var(--r)', border: '1px solid var(--b1)', color: 'var(--t4)', fontSize: '13px', fontWeight: 700 }}>
              Next →
            </span>
          )}
        </div>
      )}
      </div>{/* /.cb-main */}

      <aside className="cb-aside" aria-label="Ways to help">
        <section className="cb-panel">
          <h2>Make an impact today</h2>
          <p className="cb-panel-lede">Small actions lead to big changes.</p>
          <ul className="cb-actions">
            <li>
              <Link href="/give">
                <strong>Give to many causes</strong>
                <span>Split one gift across several campaigns, with a single receipt.</span>
              </Link>
            </li>
            <li>
              <Link href="/create/choose-path">
                <strong>Start a fundraiser</strong>
                <span>Raise for someone you know, or for a cause you care about.</span>
              </Link>
            </li>
            <li>
              <Link href="/get-involved">
                <strong>Volunteer your time</strong>
                <span>Ways to help that do not involve money.</span>
              </Link>
            </li>
          </ul>
          <Link href="/get-involved" className="cta-primary cb-panel-cta">Get involved</Link>
        </section>

        {/* Top DONORS, not "top fundraisers".
            The supplied design labels this panel "Top Fundraisers" and lists
            people with an amount. The only person-level aggregate that exists is
            getTopDonors() — money GIVEN, not money RAISED. Rendering givers under
            a "fundraisers" heading would misdescribe every name on the list, so
            the heading matches the data.
            The loader already excludes anonymous donations and respects each
            profile's showPublicProfile flag, so nobody appears here who did not
            choose to be visible. */}
        {topDonors.length > 0 && (
          <section className="cb-panel">
            <div className="cb-section-head">
              <h2>Top donors</h2>
              <Link href="/leaderboard">View all <span aria-hidden="true">→</span></Link>
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

        {/* The design also carries a named testimonial ("Jessica M., Donor").
            It is not reproduced: there is no testimonials table, so the quote and
            the person would both have to be written by us and presented as a real
            supporter's words. That is fabricating a review, which is not a thing
            to ship regardless of how good the panel looks. If real, consented
            testimonials are collected later, this is where they belong. */}
        <section className="cb-panel cb-start">
          <h2>Start your own campaign</h2>
          <p className="cb-panel-lede">
            Create a campaign and rally your community. There is no platform fee.
          </p>
          <Link href="/create/choose-path" className="cta-primary cb-panel-cta">Start a fundraiser</Link>
        </section>
      </aside>
      </div>{/* /.cb-layout */}
    </div>
  );
}
