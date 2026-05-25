import Link from 'next/link';
import { supabaseAdmin } from '../../lib/supabase';
import { ProgressBar, Badge, Card, EmptyState } from '../../components/ui';
import { formatCents } from '../../lib/stripe';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Browse Campaigns' };
export const revalidate = 30;

interface Props {
  searchParams: Promise<{ category?: string; q?: string }>;
}

async function getCampaigns(category?: string, q?: string) {
  let query = supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category')
    .eq('status', 'active')
    .order('raised_amount', { ascending: false });

  if (category) query = query.eq('category', category);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data } = await query.limit(50);
  return data ?? [];
}

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}

export default async function CampaignsPage({ searchParams }: Props) {
  const { category, q } = await searchParams;
  const campaigns = await getCampaigns(category, q);

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Browse campaigns</h1>
        <p style={{ color: 'var(--t3)', fontSize: '15px' }}>Support causes that matter to you.</p>
      </div>

      {/* Search + filter bar */}
      <form method="GET" style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search campaigns…"
          style={{
            flex: '1 1 240px',
            padding: '10px 14px',
            border: '1px solid var(--b1)',
            borderRadius: 'var(--r)',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <select
          name="category"
          defaultValue={category ?? ''}
          style={{
            padding: '10px 14px',
            border: '1px solid var(--b1)',
            borderRadius: 'var(--r)',
            fontSize: '14px',
            background: '#fff',
            color: 'var(--t1)',
            cursor: 'pointer',
          }}
        >
          <option value="">All categories</option>
          {CAMPAIGN_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="submit" style={{
          padding: '10px 20px',
          background: 'var(--green)',
          color: '#fff',
          borderRadius: 'var(--r)',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          border: 'none',
        }}>
          Search
        </button>
      </form>

      {campaigns.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No campaigns found"
          body="Try a different search or category."
          action={
            <Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green)', fontWeight: 600 }}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
        }}>
          {campaigns.map((c) => {
            const pct = Math.min(100, Math.round(((c.raised_amount ?? 0) / c.goal_amount) * 100));
            const days = daysLeft(c.deadline);
            return (
              <Link key={c.id} href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none' }}>
                <Card style={{ cursor: 'pointer', transition: 'box-shadow .2s' }}>
                  <div style={{
                    height: '190px',
                    background: c.cover_image_url
                      ? `url(${c.cover_image_url}) center/cover`
                      : 'linear-gradient(135deg, var(--green-light), var(--s2))',
                    position: 'relative',
                  }}>
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <Badge color="gray">{c.category}</Badge>
                    </div>
                  </div>
                  <div style={{ padding: '18px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: 'var(--t1)' }}>
                      {c.title}
                    </h2>
                    {c.tagline && (
                      <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '14px', lineHeight: 1.4 }}>
                        {c.tagline}
                      </p>
                    )}
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
                        {pct}% · {days !== null ? `${days}d left` : ''} · {c.backer_count ?? 0} donors
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
