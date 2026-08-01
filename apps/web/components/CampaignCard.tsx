// ─────────────────────────────────────────────────────────────────────────────
// The campaign card, extracted from app/campaigns/(list)/page.tsx so the cause
// pages render the SAME card rather than a lookalike.
//
// This repo's recurring failure mode is a second copy that drifts: three copies
// of the category list, five copies of the public-route list, and ten separate
// implementations of "days left" — one of which shipped "136 days left" directly
// above "This campaign has ended". A card carries the trust badge, the verified
// mark, and the countdown, so a divergent copy misstates exactly the things a
// donor uses to decide. Hence one component.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { ProgressBar, Badge, Card } from './ui';
import { formatCents } from '../lib/stripe';
import { calculateTrustScore, getTrustLabel } from '../lib/ai-platform';
import { getCoverForCampaign } from '../lib/photo-catalog';
import { optimizedCoverUrl } from '../lib/img-optimize';
import { campaignDaysLeft, campaignTimeLabel } from '../lib/campaign-lifecycle';

export interface CampaignCardData {
  id: string;
  slug: string;
  title: string;
  tagline?: string | null;
  cover_image_url?: string | null;
  goal_amount: number;
  raised_amount?: number | null;
  backer_count?: number | null;
  deadline?: string | null;
  category?: string | null;
  /** Consulted by the countdown — without it a finished campaign reads as live. */
  status?: string | null;
  trust_status?: string | null;
  nonprofit_verified?: boolean | null;
  location?: string | null;
  campaign_health_score?: number | null;
}

export function CampaignCard({
  campaign: c,
  currency = 'usd',
}: {
  campaign: CampaignCardData;
  currency?: string;
}) {
  const pct = Math.min(100, Math.round(((c.raised_amount ?? 0) / c.goal_amount) * 100));
  // Both forms come from the same helper, so the urgency badge and the footer
  // label cannot disagree about how much time is left.
  const daysLabel = campaignTimeLabel({ status: c.status, deadline: c.deadline });
  const days = campaignDaysLeft(c.deadline);
  const trust = calculateTrustScore(c);
  const isVerified = c.trust_status === 'Verified';

  return (
    <Link href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none' }}>
      <Card style={{ cursor: 'pointer', transition: 'box-shadow .2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '190px', position: 'relative', flexShrink: 0, overflow: 'hidden', background: 'var(--s3)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizedCoverUrl(c.cover_image_url || getCoverForCampaign(c.category ?? undefined, c.slug), 700)}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {c.category && <Badge color="gray">{c.category}</Badge>}
            {isVerified && <Badge color="green">✓ Verified</Badge>}
            {c.nonprofit_verified && <Badge color="green">💚 Tax Deductible</Badge>}
            {days !== null && days <= 5 && days > 0 && daysLabel !== 'Ended' && (
              <Badge color="red">⏰ {days}d left</Badge>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
            <Badge color={trust >= 70 ? 'green' : trust >= 40 ? 'blue' : 'gray'}>
              {getTrustLabel(trust)} {trust}
            </Badge>
          </div>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: 'var(--t1)', lineHeight: 1.35 }}>
            {c.title}
          </h3>
          {c.tagline && (
            <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '12px', lineHeight: 1.4 }}>
              {c.tagline.slice(0, 90)}{c.tagline.length > 90 ? '…' : ''}
            </p>
          )}
          {c.location && (
            <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '8px' }}>📍 {c.location}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'Trust', value: `${trust}` },
              { label: 'Donors', value: `${c.backer_count ?? 0}` },
              { label: 'Goal', value: formatCents(c.goal_amount, currency) },
            ].map((signal) => (
              <div key={signal.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--t1)' }}>{signal.value}</div>
                <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '1px' }}>{signal.label}</div>
              </div>
            ))}
          </div>
          <ProgressBar value={c.raised_amount ?? 0} max={c.goal_amount} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '4px' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--green-text)', fontSize: '14px' }}>
                {formatCents(c.raised_amount ?? 0, currency)}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--t4)', marginLeft: '4px' }}>
                of {formatCents(c.goal_amount, currency)}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--t4)' }}>
              {pct}%{daysLabel === 'No deadline' ? '' : ` · ${daysLabel}`}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/** The grid the cards sit in — `min(100%, …)` prevents 320px overflow (PR #49). */
export function CampaignGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '24px' }}>
      {children}
    </div>
  );
}
