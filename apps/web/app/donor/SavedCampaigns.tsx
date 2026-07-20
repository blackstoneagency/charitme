'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { formatCents } from '@shared/currencies';

type SavedCampaign = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  status: string;
  currency?: string | null;
};

const cardStyle: React.CSSProperties = {
  background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14,
  padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
};

export default function SavedCampaigns() {
  const [campaigns, setCampaigns] = useState<SavedCampaign[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/saved-campaigns')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { campaigns?: SavedCampaign[] } | null) => {
        if (!cancelled) setCampaigns(json?.campaigns ?? []);
      })
      .catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, []);

  if (!campaigns) return null;

  if (campaigns.length === 0) {
    return (
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>♥ Saved Campaigns</h2>
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t3, #94a3b8)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>♥</div>
          <p style={{ fontWeight: 700, margin: '0 0 4px' }}>No saved campaigns yet.</p>
          <p style={{ fontSize: 13 }}>Tap the heart icon on any campaign to save it for later.</p>
          <Link href="/campaigns" style={{ display: 'inline-block', marginTop: 12, padding: '10px 24px', background: 'var(--violet, #6c35ff)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Browse Campaigns
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>
        ♥ Saved Campaigns <span style={{ color: 'var(--t3, #94a3b8)', fontWeight: 600 }}>({campaigns.length})</span>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
        {campaigns.map((c) => {
          const pct = c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
          return (
            <Link key={c.id} href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid var(--b1, #f1f5f9)', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  height: 110, background: c.cover_image_url ? `url(${c.cover_image_url}) center/cover` : 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
                }} />
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {c.category && <span style={{ fontSize: 11, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.category}</span>}
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--t1, #1a1a2e)', lineHeight: 1.3 }}>{c.title}</div>
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ background: 'var(--s3, #f1f5f9)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green, #19b86a)', borderRadius: 99 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <strong style={{ color: 'var(--t1, #1a1a2e)' }}>{formatCents(c.raised_amount, c.currency ?? 'usd')}</strong>
                      <span style={{ color: 'var(--t3, #94a3b8)' }}>{pct}% funded</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
