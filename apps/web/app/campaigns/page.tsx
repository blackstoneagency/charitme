import Link from 'next/link';
import { supabaseAdmin } from '../../lib/supabase';
import { ProgressBar, Badge, Card, EmptyState } from '../../components/ui';
import { formatCents } from '../../lib/stripe';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { calculateTrustScore, getTrustLabel } from '../../lib/ai-platform';
import { getCoverForCategory } from '../../lib/photo-catalog';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Campaigns',
  description: 'Discover verified fundraising campaigns across medical, emergency, education, community, and more.',
  alternates: { canonical: 'https://www.charitme.com/campaigns' },
};
export const dynamic = 'force-dynamic';

type SortOption = 'raised' | 'latest' | 'donors' | 'ending' | 'trust';

interface Props {
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    verified?: string;
    location?: string;
    tax?: string;
  }>;
}

async function getCampaigns(opts: {
  category?: string;
  q?: string;
  sort?: SortOption;
  verifiedOnly?: boolean;
  location?: string;
  taxDeductibleOnly?: boolean;
}) {
  try {
    let query = supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, trust_status, nonprofit_verified, location, campaign_health_score')
      .eq('status', 'active');

    if (opts.category) query = query.eq('category', opts.category);
    if (opts.verifiedOnly) query = query.eq('trust_status', 'Verified');
    if (opts.taxDeductibleOnly) query = query.eq('nonprofit_verified', true);
    if (opts.location) query = query.ilike('location', `%${opts.location}%`);
    if (opts.q) {
      query = query.or(`title.ilike.%${opts.q}%,tagline.ilike.%${opts.q}%,description.ilike.%${opts.q}%`);
    }

    // Sort
    switch (opts.sort) {
      case 'latest':  query = query.order('created_at', { ascending: false }); break;
      case 'donors':  query = query.order('backer_count', { ascending: false }); break;
      case 'ending':  query = query.not('deadline', 'is', null).order('deadline', { ascending: true }); break;
      case 'trust':   query = query.order('campaign_health_score', { ascending: false }); break;
      default:        query = query.order('raised_amount', { ascending: false }); break; // 'raised'
    }

    const { data } = await query.limit(60);
    return data ?? [];
  } catch {
    return [];
  }
}

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
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

  const campaigns = await getCampaigns({
    category, q, sort, verifiedOnly: verified, location, taxDeductibleOnly: tax,
  });

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Browse trusted campaigns</h1>
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
      <style>{`
        .cb-filter-pill { position: relative; display: inline-flex; cursor: pointer; }
        .cb-filter-pill input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
        .cb-filter-pill span { display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; border: 1.5px solid var(--b2); background: #fff; color: var(--t2); transition: border-color .15s, background .15s, color .15s; }
        .cb-filter-pill input:focus-visible + span { outline: 2px solid var(--violet); outline-offset: 2px; }
        .cb-filter-pill.verified input:checked + span { border-color: #6c35ff; background: #f0eaff; color: #551cf2; }
        .cb-filter-pill.tax input:checked + span { border-color: #19b86a; background: #f0fff8; color: #065f46; }
      `}</style>
      <form method="GET" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search campaigns…"
            style={{ flex: '1 1 220px', padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', outline: 'none' }}
          />
          <input
            name="location"
            defaultValue={location}
            placeholder="Location…"
            style={{ flex: '0 1 140px', padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', outline: 'none' }}
          />
          <select name="category" defaultValue={category ?? ''}
            style={{ padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', background: '#fff', color: 'var(--t1)', cursor: 'pointer' }}>
            <option value="">All categories</option>
            {CAMPAIGN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="sort" defaultValue={sort}
            style={{ padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--r)', fontSize: '14px', background: '#fff', color: 'var(--t1)', cursor: 'pointer' }}>
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button type="submit" style={{ padding: '10px 20px', background: 'var(--green)', color: '#fff', borderRadius: 'var(--r)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', border: 'none' }}>
            Search
          </button>
        </div>

        {/* ── Toggle filters — submitted together with the search above so typed
             keywords/location aren't lost when toggling these checkboxes ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} found
          </span>
        </div>
      </form>

      {campaigns.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No campaigns found"
          body="Try different keywords, remove filters, or browse all campaigns."
          action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green)', fontWeight: 600 }}>Clear filters</Link>}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {campaigns.map((c) => {
            const pct  = Math.min(100, Math.round(((c.raised_amount ?? 0) / c.goal_amount) * 100));
            const days = daysLeft(c.deadline);
            const trust = calculateTrustScore(c);
            const isVerified = c.trust_status === 'Verified';
            const isTaxDeductible = (c as { nonprofit_verified?: boolean }).nonprofit_verified;

            return (
              <Link key={c.id} href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none' }}>
                <Card style={{ cursor: 'pointer', transition: 'box-shadow .2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: '190px', background: `url(${c.cover_image_url || getCoverForCategory(c.category)}) center/cover`, position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge color="gray">{c.category}</Badge>
                      {isVerified && <Badge color="green">✓ Verified</Badge>}
                      {isTaxDeductible && <Badge color="green">💚 Tax Deductible</Badge>}
                      {days !== null && days <= 5 && days > 0 && <Badge color="red">⏰ {days}d left</Badge>}
                    </div>
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
                      <Badge color={trust >= 70 ? 'green' : trust >= 40 ? 'blue' : 'gray'}>
                        {getTrustLabel(trust)} {trust}
                      </Badge>
                    </div>
                  </div>
                  <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: 'var(--t1)', lineHeight: 1.35 }}>
                      {c.title}
                    </h2>
                    {c.tagline && (
                      <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '12px', lineHeight: 1.4 }}>
                        {c.tagline.slice(0, 90)}{c.tagline.length > 90 ? '…' : ''}
                      </p>
                    )}
                    {(c as { location?: string }).location && (
                      <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '8px' }}>
                        📍 {(c as { location?: string }).location}
                      </p>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      {[
                        { label: 'Trust', value: `${trust}` },
                        { label: 'Donors', value: `${c.backer_count ?? 0}` },
                        { label: 'Goal', value: formatCents(c.goal_amount) },
                      ].map((signal) => (
                        <div key={signal.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t1)' }}>{signal.value}</div>
                          <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '1px' }}>{signal.label}</div>
                        </div>
                      ))}
                    </div>
                    <ProgressBar value={c.raised_amount ?? 0} max={c.goal_amount} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '4px' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px' }}>
                          {formatCents(c.raised_amount ?? 0)}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--t4)', marginLeft: '4px' }}>
                          of {formatCents(c.goal_amount)}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
                        {pct}%{days !== null ? ` · ${days}d left` : ''}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
