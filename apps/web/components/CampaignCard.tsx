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
// Whole-currency formatting for the feature card. Cents on a card headline are
// noise — the reference writes "$125,000 of $150,000" — and this is the shared
// helper the rest of the app already uses for compact figures rather than a
// local copy that would round differently.
import { formatMoneyCompact } from '@shared/currencies';
import { STORED_TRUST_TIERS } from '../lib/trust-tiers';
import { getDisplayCover } from '../lib/photo-catalog';
import { optimizedCoverUrl } from '../lib/img-optimize';
import { campaignDaysLeft, campaignTimeLabel } from '../lib/campaign-lifecycle';
import { DEMO_BADGE_LABEL } from '../lib/demo-campaign';

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
  /**
   * `campaigns.featured` — staff- or purchase-promoted. Optional because most
   * listings do not select it; absent means "not known to be featured", which
   * renders exactly like false. It must never be inferred from position: a card
   * that happens to sort first is not a featured campaign.
   */
  featured?: boolean | null;
  /** Seeded catalog/example row. It must be visibly distinguished from a fundraiser. */
  is_demo?: boolean | null;
}

export function CampaignCard({
  campaign: c,
  currency = 'usd',
  variant = 'full',
  highlightFeatured = true,
  coverScope,
}: {
  campaign: CampaignCardData;
  currency?: string;
  /**
   * Whether this card may wear the featured ring and badge.
   *
   * Presentation only, and defaulted to `true` so every existing caller is
   * unchanged. Cause pages pass `false` past the third featured card: a grid
   * where every card is highlighted distinguishes nothing (see
   * `lib/featured-cap.ts`). It does NOT mean "not featured" — the campaign's
   * flag, its position, and its paid placement are all untouched.
   */
  highlightFeatured?: boolean;
  /** Replaces known stock catalog media with a route-specific first-party cover. */
  coverScope?: string;
  /**
   * `full` is the dense listing card: trust score, donor count, goal tiles and
   * the countdown. `feature` is the quieter card from the cause-landing
   * reference — cover, title, one line of description, raised-of-goal and a
   * progress bar.
   *
   * A VARIANT rather than a second component, deliberately. This file exists
   * because the repo's recurring failure is a lookalike copy that drifts: three
   * copies of the category list, five of the public-route list, and ten
   * implementations of "days left", one of which shipped "136 days left" directly
   * above "This campaign has ended". A card states the things a donor decides on,
   * so a divergent copy misstates exactly those.
   */
  variant?: 'full' | 'feature';
}) {
  const pct = Math.min(100, Math.round(((c.raised_amount ?? 0) / c.goal_amount) * 100));
  // Both forms come from the same helper, so the urgency badge and the footer
  // label cannot disagree about how much time is left.
  const daysLabel = campaignTimeLabel({ status: c.status, deadline: c.deadline });
  const days = campaignDaysLeft(c.deadline);
  const isDemo = c.is_demo === true;
  const isVerified = !isDemo && c.trust_status === 'Verified';
  // ⚠️ The corner chip used to render `getTrustLabel(calculateTrustScore(c))`.
  // A card carries 5 of the 15 signals that scorer reads, and it treats an
  // ABSENT signal exactly like a failed one — so every campaign scored 52 or 57
  // and every chip read "Needs More Info". Measured on production: all 18 cards
  // on /supporter-space showed that chip beside an admin-set "✓ Verified" badge.
  // Two labels using the same words to mean different things, contradicting each
  // other on the same card.
  //
  // The stored tier is the platform's actual judgement and IS on the card, so it
  // is shown directly rather than re-derived from data the card does not have.
  const tier = isDemo ? undefined : STORED_TRUST_TIERS.find((t) => t === c.trust_status);
  const hasEnded = daysLabel === 'Ended';
  // `=== true`, not truthiness: the column is `boolean NOT NULL DEFAULT false`,
  // but most listings do not select it, and `undefined` means "not known" — which
  // must render identically to false rather than throwing a highlight around
  // every card on a surface that forgot the column.
  const isFeatured = c.featured === true && highlightFeatured;

  if (variant === 'feature') {
    return (
      <Link
        href={`/campaigns/${c.slug}`}
        className={isFeatured ? 'cc-feature cc-feature--promoted' : 'cc-feature'}
      >
        <div className="cc-feature-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizedCoverUrl(getDisplayCover(c.cover_image_url, c.category, c.slug, coverScope), 700)}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <div className="cc-feature-badges">
            {/* First, and before the category, because it is the reason this card
                is where it is. A ring alone would be decoration a screen-reader
                user never receives — the badge is the accessible half of the
                highlight, which is why both ship together. */}
            {isFeatured && <Badge color="green">★ Featured</Badge>}
            {isDemo && <Badge color="blue">{DEMO_BADGE_LABEL}</Badge>}
            {c.category && <Badge color="gray">{c.category}</Badge>}
            {/* The reference shows no status chips. These two are kept anyway:
                dropping "Verified" removes a signal a donor decides on, and
                dropping "Ended" is how this repo once shipped a live-looking
                countdown above a finished campaign. The trust NUMBER and the
                donor/goal tiles are what the quieter layout drops. */}
            {isVerified && <Badge color="green">✓ Verified</Badge>}
            {hasEnded && <Badge color="gray">Ended</Badge>}
          </div>
        </div>
        <div className="cc-feature-body">
          <h3 className="cc-feature-title">{c.title}</h3>
          {c.tagline && <p className="cc-feature-blurb">{c.tagline}</p>}
          <div className="cc-feature-foot">
            <p className="cc-feature-money">
              <strong>{formatMoneyCompact(c.raised_amount ?? 0, currency)}</strong>
              <span> of {formatMoneyCompact(c.goal_amount, currency)}</span>
            </p>
            <span className="cc-feature-pct">{pct}%</span>
          </div>
          <ProgressBar value={c.raised_amount ?? 0} max={c.goal_amount} />
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none' }}>
      <Card style={{ cursor: 'pointer', transition: 'box-shadow .2s', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '190px', position: 'relative', flexShrink: 0, overflow: 'hidden', background: 'var(--s3)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizedCoverUrl(getDisplayCover(c.cover_image_url, c.category, c.slug, coverScope), 700)}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
            {/* Same mark on both variants: one campaign must not read as featured
                on the cause page and ordinary on /campaigns. */}
            {isFeatured && <Badge color="green">★ Featured</Badge>}
            {isDemo && <Badge color="blue">{DEMO_BADGE_LABEL}</Badge>}
            {c.category && <Badge color="gray">{c.category}</Badge>}
            {isVerified && <Badge color="green">✓ Verified</Badge>}
            {!isDemo && c.nonprofit_verified && <Badge color="green">💚 Tax Deductible</Badge>}
            {days !== null && days <= 5 && days > 0 && daysLabel !== 'Ended' && (
              <Badge color="red">⏰ {days}d left</Badge>
            )}
          </div>
          {/* Only when it says something the badge row has not. "Verified" is
              already a badge above; repeating it here is noise, and there is no
              honest score to put in its place. */}
          {tier && !isVerified && (
            <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
              <Badge color={tier === 'Trusted' ? 'green' : 'gray'}>{tier}</Badge>
            </div>
          )}
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
              // "Trust" here was the same near-constant 52/57 as the corner chip
              // — a score computed from 5 of the 15 signals it needs, presented
              // as a per-campaign number. Replaced with `raised`, which the card
              // genuinely carries and which a donor actually reads next to
              // Donors and Goal.
              { label: 'Raised', value: formatCents(c.raised_amount ?? 0, currency) },
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
          <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '4px' }}>
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
