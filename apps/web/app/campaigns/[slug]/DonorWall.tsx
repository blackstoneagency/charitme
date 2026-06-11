'use client';

import Link from 'next/link';
import React, { useState } from 'react';

export interface WallDonation {
  id: string;
  name: string;
  avatarUrl: string | null;
  amountCents: number;
  message: string | null;
  createdAt: string;
  anonymous: boolean;
  donorId?: string | null;
  showPublicProfile?: boolean;
}

function fmtCents(c: number) {
  const d = c / 100;
  if (d >= 1_000) return `$${Math.round(d).toLocaleString()}`;
  return `$${d.toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Lightweight giving-tier badge — purely cosmetic recognition for the donor wall
function tierBadge(amountCents: number): string | null {
  if (amountCents >= 50_000) return '💎';
  if (amountCents >= 10_000) return '🥇';
  if (amountCents >= 5_000) return '🥈';
  if (amountCents >= 1_000) return '🥉';
  return null;
}

export default function DonorWall({
  campaignId,
  initialDonations,
  totalCount,
}: {
  campaignId: string;
  initialDonations: WallDonation[];
  totalCount: number;
}) {
  const [tab, setTab] = useState<'recent' | 'top'>('recent');
  const [recent, setRecent] = useState(initialDonations);
  const [top, setTop] = useState<WallDonation[] | null>(null);
  const [loadingTop, setLoadingTop] = useState(false);
  const [offset, setOffset] = useState(initialDonations.length);
  const [hasMore, setHasMore] = useState(initialDonations.length >= 6 && initialDonations.length > 0);
  const [loadingMore, setLoadingMore] = useState(false);

  async function selectTab(next: 'recent' | 'top') {
    setTab(next);
    if (next === 'top' && top === null) {
      setLoadingTop(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/donations?sort=top&limit=10`);
        const data: { donations: WallDonation[] } = await res.json();
        setTop(data.donations ?? []);
      } catch {
        setTop([]);
      } finally {
        setLoadingTop(false);
      }
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/donations?sort=recent&limit=10&offset=${offset}`);
      const data: { donations: WallDonation[]; hasMore: boolean } = await res.json();
      setRecent((prev) => [...prev, ...(data.donations ?? [])]);
      setOffset(offset + (data.donations?.length ?? 0));
      setHasMore(!!data.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  const list = tab === 'recent' ? recent : (top ?? []);

  return (
    <article className="pc-card pc-donor-wall">
      <div className="pc-donor-wall-head">
        <h2 style={{ margin: 0 }}>
          Donor Wall <span className="pc-section-count">{totalCount}</span>
        </h2>
        <div className="pc-donor-wall-tabs">
          <button type="button" className={tab === 'recent' ? 'active' : ''} onClick={() => selectTab('recent')}>
            Recent
          </button>
          <button type="button" className={tab === 'top' ? 'active' : ''} onClick={() => selectTab('top')}>
            Top Donors
          </button>
        </div>
      </div>

      {loadingTop && tab === 'top' ? (
        <p style={{ color: 'var(--t3)', fontSize: 13, padding: '12px 0' }}>Loading top donors…</p>
      ) : list.length === 0 ? (
        <p><span>Be the first supporter</span><b>{fmtCents(0)}</b></p>
      ) : (
        <div className="pc-donor-list">
          {list.map((d) => {
            const initials = d.anonymous ? 'A' : (d.name?.[0] ?? 'K');
            const badge = tierBadge(d.amountCents);
            return (
              <div key={d.id} className="pc-donor-row">
                <div className="pc-donor-avatar" style={{ backgroundImage: d.avatarUrl ? `url(${d.avatarUrl})` : undefined }}>
                  {!d.avatarUrl && initials}
                </div>
                <div className="pc-donor-info">
                  <div className="pc-donor-name">
                    {!d.anonymous && d.donorId && d.showPublicProfile ? (
                      <Link href={`/donors/${d.donorId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {d.name}
                      </Link>
                    ) : (
                      d.anonymous ? 'Anonymous' : d.name
                    )}
                    {badge && <span title="Generous gift" aria-hidden="true">{badge}</span>}
                  </div>
                  {d.message && <div className="pc-donor-msg">{d.message}</div>}
                  <div className="pc-donor-time">{timeAgo(d.createdAt)}</div>
                </div>
                <b className="pc-donor-amount">{fmtCents(d.amountCents)}</b>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'recent' && hasMore && (
        <button type="button" className="pc-donor-loadmore" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more donors'}
        </button>
      )}
    </article>
  );
}
