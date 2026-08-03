'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProgressBar, Badge } from '../../components/ui';
import { getCoverForCampaign } from '../../lib/photo-catalog';
import { optimizedCoverUrl } from '../../lib/img-optimize';
import { formatMoneyShort } from '@shared/currencies';
import type { LeaderboardCampaign, LeaderboardDonor, LeaderboardPeriod } from '../../lib/leaderboard';

function fmtCents(c: number) {
  const d = c / 100;
  if (d >= 1_000) return `$${Math.round(d).toLocaleString()}`;
  return `$${d.toFixed(2)}`;
}

// Lightweight giving-tier badge — purely cosmetic recognition, mirrors DonorWall
function tierBadge(amountCents: number): string | null {
  if (amountCents >= 50_000) return '💎';
  if (amountCents >= 10_000) return '🥇';
  if (amountCents >= 5_000) return '🥈';
  if (amountCents >= 1_000) return '🥉';
  return null;
}

const RANK_CLASS: Record<number, string> = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const RANK_ICON: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankBadge({ rank }: { rank: number }) {
  return (
    <div className={`lb-rank ${RANK_CLASS[rank] ?? ''}`}>
      {RANK_ICON[rank] ?? `#${rank}`}
    </div>
  );
}

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  all: 'All time',
  month: 'This month',
  week: 'This week',
};

/** Reads as a phrase under an amount ("$4,120 · in the last 7 days"). */
const PERIOD_SUBLABELS: Record<LeaderboardPeriod, string> = {
  all: 'all time',
  month: 'in the last 30 days',
  week: 'in the last 7 days',
};

export default function LeaderboardClient({
  initialCampaigns,
  initialDonors,
}: {
  initialCampaigns: LeaderboardCampaign[];
  initialDonors: LeaderboardDonor[];
}) {
  const [tab, setTab] = useState<'campaigns' | 'donors'>('campaigns');
  // Cached per period, same as donors: switching back to a window already
  // fetched must not re-hit the network or flash a loading state.
  const [campaignsByPeriod, setCampaignsByPeriod] = useState<Partial<Record<LeaderboardPeriod, LeaderboardCampaign[]>>>({ all: initialCampaigns });
  const [campaignPeriod, setCampaignPeriod] = useState<LeaderboardPeriod>('all');
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [donorsByPeriod, setDonorsByPeriod] = useState<Partial<Record<LeaderboardPeriod, LeaderboardDonor[]>>>({ all: initialDonors });
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [loadingDonors, setLoadingDonors] = useState(false);

  async function selectPeriod(next: LeaderboardPeriod) {
    setPeriod(next);
    if (donorsByPeriod[next] !== undefined) return;
    setLoadingDonors(true);
    try {
      const res = await fetch(`/api/leaderboard/donors?period=${next}&limit=20`);
      const data: { donors: LeaderboardDonor[] } = await res.json();
      setDonorsByPeriod((prev) => ({ ...prev, [next]: data.donors ?? [] }));
    } catch {
      setDonorsByPeriod((prev) => ({ ...prev, [next]: [] }));
    } finally {
      setLoadingDonors(false);
    }
  }

  async function selectCampaignPeriod(next: LeaderboardPeriod) {
    setCampaignPeriod(next);
    if (campaignsByPeriod[next] !== undefined) return;
    setLoadingCampaigns(true);
    try {
      const res = await fetch(`/api/leaderboard/campaigns?period=${next}&limit=20`);
      const data: { campaigns: LeaderboardCampaign[] } = await res.json();
      setCampaignsByPeriod((prev) => ({ ...prev, [next]: data.campaigns ?? [] }));
    } catch {
      setCampaignsByPeriod((prev) => ({ ...prev, [next]: [] }));
    } finally {
      setLoadingCampaigns(false);
    }
  }

  const campaigns = campaignsByPeriod[campaignPeriod];
  const donors = donorsByPeriod[period];

  return (
    <div>
      <div className="lb-tabs">
        <button type="button" className={tab === 'campaigns' ? 'active' : ''} onClick={() => setTab('campaigns')}>
          🚀 Top Campaigns
        </button>
        <button type="button" className={tab === 'donors' ? 'active' : ''} onClick={() => setTab('donors')}>
          ❤️ Top Donors
        </button>
      </div>

      {tab === 'campaigns' ? (
        <article className="pc-card">
          <div className="pc-donor-wall-head">
            <h2 style={{ margin: 0 }}>Top Fundraising Campaigns</h2>
            <div className="lb-period">
              {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((p) => (
                <button key={p} type="button" className={campaignPeriod === p ? 'active' : ''} onClick={() => selectCampaignPeriod(p)}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          {loadingCampaigns || campaigns === undefined ? (
            <p style={{ color: 'var(--t3)', fontSize: 13, padding: '12px 0' }}>Loading top campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>
              {campaignPeriod === 'all'
                ? 'No active campaigns yet — be the first to launch one!'
                : 'No campaigns received donations in this period yet.'}
            </p>
          ) : (
            <div>
              {campaigns.map((c) => (
                <div key={c.id} className="lb-campaign-row">
                  <RankBadge rank={c.rank} />
                  <div
                    className="lb-campaign-cover"
                    style={{ backgroundImage: `url(${optimizedCoverUrl(c.coverImageUrl || getCoverForCampaign(c.category, c.slug), 320)})` }}
                  />
                  <div className="lb-campaign-info">
                    <Link href={`/campaigns/${c.slug}`} className="lb-campaign-title">
                      {c.title}
                    </Link>
                    <div className="lb-campaign-meta">
                      by {c.organizerName}
                      {c.location ? ` · ${c.location}` : ''}
                    </div>
                    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 220 }}>
                        <ProgressBar value={c.raisedAmount} max={c.goalAmount} />
                      </div>
                      <Badge color="gray">{c.category}</Badge>
                      {c.trustStatus === 'Verified' && <Badge color="green">✓ Verified</Badge>}
                      {c.nonprofitVerified && <Badge color="green">💚 Tax Deductible</Badge>}
                    </div>
                  </div>
                  {/* In a period view the headline figure is what was raised
                      IN that period — it is what the ranking is based on, so
                      showing the lifetime total here would leave the order
                      looking arbitrary. Lifetime moves to the sub-line. */}
                  <div className="lb-campaign-amount">
                    {c.periodRaisedCents === undefined ? (
                      <>
                        <b>{formatMoneyShort(c.raisedAmount, c.currency ?? 'usd')}</b>
                        <span>of {formatMoneyShort(c.goalAmount, c.currency ?? 'usd')} · {c.backerCount} donors</span>
                      </>
                    ) : (
                      <>
                        <b>{formatMoneyShort(c.periodRaisedCents, c.currency ?? 'usd')}</b>
                        <span>
                          {PERIOD_SUBLABELS[campaignPeriod]} · {formatMoneyShort(c.raisedAmount, c.currency ?? 'usd')} all time
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : (
        <article className="pc-card">
          <div className="pc-donor-wall-head">
            <h2 style={{ margin: 0 }}>Top Donors</h2>
            <div className="lb-period">
              {(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((p) => (
                <button key={p} type="button" className={period === p ? 'active' : ''} onClick={() => selectPeriod(p)}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {loadingDonors || donors === undefined ? (
            <p style={{ color: 'var(--t3)', fontSize: 13, padding: '12px 0' }}>Loading top donors…</p>
          ) : donors.length === 0 ? (
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>No donations recorded for this period yet.</p>
          ) : (
            <div className="pc-donor-list">
              {donors.map((d) => {
                const badge = tierBadge(d.totalCents);
                const initials = d.name?.[0] ?? 'K';
                return (
                  <div key={d.donorId} className="pc-donor-row">
                    <RankBadge rank={d.rank} />
                    <div className="pc-donor-avatar" style={{ backgroundImage: d.avatarUrl ? `url(${d.avatarUrl})` : undefined }}>
                      {!d.avatarUrl && initials}
                    </div>
                    <div className="pc-donor-info">
                      <div className="pc-donor-name">
                        {d.showPublicProfile ? (
                          <Link href={`/donors/${d.donorId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {d.name}
                          </Link>
                        ) : (
                          d.name
                        )}
                        {badge && <span title="Generous giver" aria-hidden="true">{badge}</span>}
                      </div>
                      <div className="pc-donor-time">{d.donationCount} donation{d.donationCount === 1 ? '' : 's'}</div>
                    </div>
                    <b className="pc-donor-amount">{fmtCents(d.totalCents)}</b>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      )}
    </div>
  );
}
