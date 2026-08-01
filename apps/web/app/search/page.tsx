import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { applyCampaignSearch, likeTerm } from '../../lib/campaign-search';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../components/CampaignCard';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { EmptyState } from '../../components/ui';
import {
  SEARCH_SCOPES,
  isSearchScope,
  isSearchSort,
  normalizeQuery,
  searchCauses,
  searchResources,
  causeBrowseHref,
  type SearchScope,
  type SearchSort,
} from '../../lib/site-search';

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search campaigns, causes, and resources across CharitMe — filter by cause, location, and how far along a campaign is.',
  alternates: { canonical: 'https://www.charitme.com/search' },
};

const PAGE_SIZE = 24;

interface Props {
  searchParams: Promise<{ q?: string; type?: string; category?: string; location?: string; sort?: string }>;
}

/** `null` means the query failed — kept distinct from "no results", which is a fact. */
async function findCampaigns(
  q: string,
  opts: { category?: string; location?: string; sort: SearchSort },
): Promise<{ rows: CampaignCardData[]; total: number } | null> {
  try {
    const cols = await campaignColumns();
    let query = applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select(
          'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score',
          { count: 'exact' },
        ),
      cols,
    );

    if (opts.category) query = query.eq('category', opts.category);
    if (opts.location) {
      // Same wildcard stripping as the discovery page. Two adjacent inputs on
      // one form must not escape differently — a bare `%` previously matched
      // every campaign while looking like an active filter.
      const safe = likeTerm(opts.location);
      if (safe) query = query.ilike('location', `%${safe}%`);
    }
    query = applyCampaignSearch(query, q);

    if (opts.sort === 'raised') query = query.order('raised_amount', { ascending: false });
    else if (opts.sort === 'latest') query = query.order('created_at', { ascending: false });
    else if (opts.sort === 'ending') {
      query = query.not('deadline', 'is', null).order('deadline', { ascending: true });
    } else query = query.order('raised_amount', { ascending: false });

    const { data, error, count } = await query.limit(PAGE_SIZE);
    if (error) return null;
    return { rows: (data ?? []) as CampaignCardData[], total: count ?? 0 };
  } catch {
    return null;
  }
}

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--b2)',
  background: 'var(--s1)',
  color: 'var(--t1)',
  fontSize: '14px',
  minWidth: 0,
} as const;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = normalizeQuery(sp.q);
  const scope: SearchScope = isSearchScope(sp.type) ? sp.type : 'all';
  const sort: SearchSort = isSearchSort(sp.sort) ? sp.sort : 'relevance';
  const category = sp.category && (CAMPAIGN_CATEGORIES as readonly string[]).includes(sp.category)
    ? sp.category
    : undefined;
  const location = sp.location?.trim() || undefined;

  const campaigns = q || category || location ? await findCampaigns(q, { category, location, sort }) : { rows: [], total: 0 };
  const causes = searchCauses(q);
  const resources = searchResources(q);

  // Every count is measured, never the mockup's illustrative figures.
  const counts: Record<SearchScope, number | null> = {
    campaigns: campaigns === null ? null : campaigns.total,
    causes: causes.length,
    resources: resources.length,
    all: campaigns === null ? null : campaigns.total + causes.length + resources.length,
  };

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, type: scope, category, location, sort, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === 'type' && v === 'all') && !(k === 'sort' && v === 'relevance')) params.set(k, v);
    }
    const s = params.toString();
    return s ? `/search?${s}` : '/search';
  };

  const show = (s: SearchScope) => scope === 'all' || scope === s;
  const hasQuery = Boolean(q || category || location);

  return (
    <div className="container" style={{ padding: '40px 0 72px' }}>
      <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em' }}>
        {q ? `Search results for “${q}”` : 'Search CharitMe'}
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--t3)', marginTop: '8px', maxWidth: '620px', lineHeight: 1.6 }}>
        Find campaigns, causes, and guidance. Use the filters to narrow by cause, location, or how
        far along a campaign is.
      </p>

      {/* GET form: the query lives in the URL, so a result page is shareable and
          the back button behaves. */}
      <form method="get" action="/search" style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', margin: '24px 0 8px', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '6px', gridColumn: '1 / -1' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t3)' }}>Search keywords</span>
          <input name="q" defaultValue={q} placeholder="Search causes, campaigns, topics…" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t3)' }}>Cause category</span>
          <select name="category" defaultValue={category ?? ''} style={inputStyle}>
            <option value="">All categories</option>
            {CAMPAIGN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t3)' }}>Location</span>
          <input name="location" defaultValue={location ?? ''} placeholder="All locations" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t3)' }}>Sort by</span>
          <select name="sort" defaultValue={sort} style={inputStyle}>
            <option value="relevance">Most relevant</option>
            <option value="raised">Most raised</option>
            <option value="latest">Newest</option>
            <option value="ending">Ending soon</option>
          </select>
        </label>
        <button type="submit" className="kind-start-pill" style={{ display: 'inline-flex', justifyContent: 'center', minHeight: '42px' }}>
          Search
        </button>
      </form>

      <nav aria-label="Result types" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '18px 0 26px', borderBottom: '1px solid var(--b1)', paddingBottom: '10px' }}>
        {SEARCH_SCOPES.map((s) => {
          const n = counts[s.value];
          const active = scope === s.value;
          return (
            <Link
              key={s.value}
              href={href({ type: s.value })}
              style={{
                padding: '7px 13px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                minHeight: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: active ? 'var(--green-text)' : 'var(--t3)',
                background: active ? 'var(--s2)' : 'transparent',
                border: `1px solid ${active ? 'var(--b2)' : 'transparent'}`,
              }}
            >
              {/* `null` renders as an em-dash: the count could not be measured,
                  which is not the same as zero. */}
              {s.label} ({n === null ? '—' : n})
            </Link>
          );
        })}
      </nav>

      {!hasQuery ? (
        <EmptyState
          icon="🔍"
          title="What are you looking for?"
          body="Search for a cause, a campaign, a place, or a question. You can also browse everything."
          action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse all campaigns</Link>}
        />
      ) : (
        <>
          {show('causes') && causes.length > 0 && (
            <section aria-labelledby="r-causes" style={{ marginBottom: '38px' }}>
              <h2 id="r-causes" style={{ fontSize: '18px', fontWeight: 750, color: 'var(--t1)', marginBottom: '14px' }}>
                Causes ({causes.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '14px' }}>
                {causes.map((c) => (
                  <Link key={c.slug} href={causeBrowseHref(c)} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '16px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', height: '100%' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--t1)' }}>{c.label}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '5px', lineHeight: 1.5 }}>{c.blurb}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {show('campaigns') && (
            <section aria-labelledby="r-campaigns" style={{ marginBottom: '38px' }}>
              <h2 id="r-campaigns" style={{ fontSize: '18px', fontWeight: 750, color: 'var(--t1)', marginBottom: '14px' }}>
                Campaigns {campaigns !== null && `(${campaigns.total})`}
              </h2>
              {campaigns === null ? (
                <EmptyState
                  icon="⚠️"
                  title="We couldn't search campaigns just now"
                  body="This is a problem on our side, not an empty result. Please try again in a moment."
                  action={<Link href={href({})} style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
                />
              ) : campaigns.rows.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="No campaigns matched"
                  body="Try fewer words, a different category, or clear the location filter."
                  action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse all campaigns</Link>}
                />
              ) : (
                <CampaignGrid>
                  {campaigns.rows.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                </CampaignGrid>
              )}
            </section>
          )}

          {show('resources') && resources.length > 0 && (
            <section aria-labelledby="r-resources">
              <h2 id="r-resources" style={{ fontSize: '18px', fontWeight: 750, color: 'var(--t1)', marginBottom: '14px' }}>
                Resources ({resources.length})
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                {resources.map((r) => (
                  <li key={r.path}>
                    <Link href={r.path} style={{ textDecoration: 'none', display: 'block', padding: '14px 16px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--t1)' }}>{r.title}</span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--t3)', marginTop: '4px', lineHeight: 1.5 }}>{r.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
