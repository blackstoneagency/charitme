'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { formatCents } from '../../lib/stripe';
import ReceiptButton from './ReceiptButton';

type DonationRow = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  currency: string | null;
  status: string;
  anonymous: boolean;
  message: string | null;
  created_at: string;
  campaign_id: string;
};

type CampaignRow = { id: string; title: string; slug: string; cover_image_url: string | null };

const cardStyle: React.CSSProperties = {
  background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14,
  padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
};

const selectStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--t2, #475569)', padding: '6px 10px',
  borderRadius: 8, border: '1px solid var(--b2, #e2e8f0)', background: 'var(--s1, #fff)',
  outline: 'none', cursor: 'pointer',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

export default function DonationHistoryList({
  donations,
  campaigns,
  hasMore: initialHasMore = false,
}: {
  donations: DonationRow[];
  campaigns: Record<string, CampaignRow>;
  hasMore?: boolean;
}) {
  const [items, setItems] = useState(donations);
  const [campaignMap, setCampaignMap] = useState(campaigns);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded' | 'pending'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  const campaignOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of items) {
      const c = campaignMap[d.campaign_id];
      if (c && !seen.has(c.id)) seen.set(c.id, c.title);
    }
    return [...seen.entries()];
  }, [items, campaignMap]);

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter);
    if (campaignFilter !== 'all') result = result.filter((d) => d.campaign_id === campaignFilter);

    const sorted = [...result];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case 'oldest':
        sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
        break;
      case 'amount_desc':
        sorted.sort((a, b) => b.amount_cents - a.amount_cents);
        break;
      case 'amount_asc':
        sorted.sort((a, b) => a.amount_cents - b.amount_cents);
        break;
    }
    return sorted;
  }, [items, statusFilter, campaignFilter, sortBy]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/donor/donations?offset=${items.length}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { donations: DonationRow[]; campaigns: Record<string, CampaignRow>; hasMore: boolean };
      setItems((prev) => [...prev, ...data.donations]);
      setCampaignMap((prev) => ({ ...prev, ...data.campaigns }));
      setHasMore(data.hasMore);
    } catch {
      setLoadError('Could not load more donations.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return (
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>Donation History</h2>
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t3, #94a3b8)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💚</div>
          <p style={{ fontWeight: 700, margin: '0 0 4px' }}>No donations yet.</p>
          <p style={{ fontSize: 13 }}>Find a campaign to support below.</p>
          <Link href="/campaigns" style={{ display: 'inline-block', marginTop: 12, padding: '10px 24px', background: 'var(--violet, #6c35ff)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Browse Campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          Donation History <span style={{ color: 'var(--t3, #94a3b8)', fontWeight: 600 }}>({filtered.length} of {items.length}{hasMore ? '+' : ''})</span>
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
          </select>
          {campaignOptions.length > 1 && (
            <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} style={selectStyle}>
              <option value="all">All campaigns</option>
              {campaignOptions.map(([id, title]) => (
                <option key={id} value={id}>{title}</option>
              ))}
            </select>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={selectStyle}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount_desc">Amount: high to low</option>
            <option value="amount_asc">Amount: low to high</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t3, #94a3b8)', fontSize: 13 }}>
          No donations match these filters.
        </div>
      ) : (
        <div>
          {filtered.map((d) => {
            const camp = campaignMap[d.campaign_id];
            return (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--b1, #f1f5f9)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                    {camp ? (
                      <Link href={`/campaigns/${camp.slug}`} style={{ color: 'var(--t1, #1a1a2e)', textDecoration: 'none' }}>{camp.title}</Link>
                    ) : 'Campaign'}
                  </div>
                  {d.message && (
                    <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', fontStyle: 'italic', margin: '2px 0' }}>
                      &ldquo;{d.message.slice(0, 80)}{d.message.length > 80 ? '…' : ''}&rdquo;
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--t3, #94a3b8)', marginTop: 2 }}>
                    {fmtDate(d.created_at)}
                    {d.anonymous && ' · Anonymous'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 16 }}>
                  <strong style={{ fontSize: 15, color: d.status === 'refunded' ? 'var(--t3, #94a3b8)' : 'var(--violet, #6c35ff)', textDecoration: d.status === 'refunded' ? 'line-through' : 'none' }}>
                    {formatCents(d.amount_cents, d.currency ?? 'usd')}
                  </strong>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: d.status === 'completed' ? 'rgba(22,163,74,.10)' : d.status === 'refunded' ? 'var(--s2)' : 'rgba(190,18,60,.08)',
                    color: d.status === 'completed' ? 'var(--green-dark, #065f46)' : d.status === 'refunded' ? 'var(--t3, #64748b)' : 'var(--red, #be123c)',
                  }}>{d.status}</span>
                  {d.status === 'completed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <ReceiptButton donationId={d.id} />
                      <Link href={`/dashboard/refund?donation_id=${d.id}`}
                        style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', textDecoration: 'none' }}>
                        Refund?
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--b1, #f1f5f9)' }}>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            style={{
              fontSize: 13, fontWeight: 700, color: 'var(--violet, #6c35ff)', background: 'none',
              border: '1px solid var(--b2, #e2e8f0)', borderRadius: 10, padding: '10px 24px',
              cursor: loadingMore ? 'wait' : 'pointer',
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
          {loadError && <div style={{ color: 'var(--red, #be123c)', fontSize: 12, marginTop: 6 }}>{loadError}</div>}
        </div>
      )}
    </div>
  );
}
