import Link from 'next/link';
import { supabaseAdmin } from '../../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../../lib/campaign-visibility';
import { applyCampaignSearch, likeTerm } from '../../../lib/campaign-search';
import { EmptyState } from '../../../components/ui';
import { CampaignCard, CampaignGrid } from '../../../components/CampaignCard';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Campaigns',
  description: 'Discover verified fundraising campaigns across medical, emergency, education, community, and more.',
  alternates: { canonical: 'https://www.charitme.com/campaigns' },
};
export const dynamic = 'force-dynamic';

type SortOption = 'raised' | 'latest' | 'donors' | 'ending' | 'trust';

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
        .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score', { count: 'exact' }),
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
    const { data, count, error } = await query.range(from, to);
    if (error || data == null) return { campaigns: [], total: 0, unavailable: true };
    return { campaigns: data, total: count ?? 0, unavailable: false };
  } catch {
    return { campaigns: [], total: 0, unavailable: true };
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

  const { campaigns, total, unavailable } = await getCampaigns({
    category, q, sort, verifiedOnly: verified, location, taxDeductibleOnly: tax, page,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currencyMap = new Map<string, string>();
  if (campaigns.length > 0) {
    const { data: launchSettings } = await supabaseAdmin
      .from('campaign_launch_settings')
      .select('campaign_id, currency')
      .in('campaign_id', campaigns.map((c) => c.id));
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

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', minWidth: 0, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 650, marginBottom: '8px' }}>Browse trusted campaigns</h1>
          <p style={{ color: 'var(--t3)', fontSize: '15px' }}>
            Support causes with AI trust scores, transparent goals, and real-time verification.
          </p>
        </div>
        <Link
          href="/leaderboard"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px',
            borderRadius: '999px', border: '1px solid var(--b2)', background: 'var(--s1)',
            color: 'var(--t1)', fontSize: '13px', fontWeight: 800, textDecoration: 'none', flexShrink: 0,
          }}
        >
          🏆 Leaderboard
        </Link>
      </div>

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
    </div>
  );
}
