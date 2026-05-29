'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export type RotatorCampaign = {
  slug: string;
  title: string;
  category: string | null;
  cover_image_url: string;   // always present — pre-filtered to non-null on server
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  trust_status: string | null;
  campaign_health_score: number | null;
  deadline: string | null;
  organizer_name: string | null;
  featured: boolean | null;  // featured campaigns sort first in the rotator
};

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const ROTATION_INTERVAL = 5000; // ms

interface Props {
  campaigns: RotatorCampaign[];
  fallbackImageUrl?: string;
}

export default function HeroRotator({ campaigns, fallbackImageUrl = '/hero-child-crop.png' }: Props) {
  const [active, setActive]         = useState(0);
  const [fading, setFading]         = useState(false);
  const [paused, setPaused]         = useState(false);
  const [nextIndex, setNextIndex]   = useState<number | null>(null);

  const count = campaigns.length;

  const goTo = useCallback((index: number) => {
    if (index === active || fading) return;
    setFading(true);
    setNextIndex(index);
  }, [active, fading]);

  const advance = useCallback(() => {
    if (count < 2) return;
    goTo((active + 1) % count);
  }, [active, count, goTo]);

  const retreat = useCallback(() => {
    if (count < 2) return;
    goTo((active - 1 + count) % count);
  }, [active, count, goTo]);

  // Commit the transition after the fade-out completes
  useEffect(() => {
    if (!fading || nextIndex === null) return;
    const t = setTimeout(() => {
      setActive(nextIndex);
      setNextIndex(null);
      setFading(false);
    }, 300); // matches CSS transition duration
    return () => clearTimeout(t);
  }, [fading, nextIndex]);

  // Auto-advance timer
  useEffect(() => {
    if (paused || count < 2) return;
    const t = setInterval(advance, ROTATION_INTERVAL);
    return () => clearInterval(t);
  }, [advance, paused, count]);

  const campaign  = campaigns[active];
  const heroPercent = campaign
    ? Math.min(100, Math.round(((campaign.raised_amount ?? 0) / (campaign.goal_amount || 1)) * 100))
    : 0;
  const daysLeft = campaign?.deadline
    ? Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - new Date().getTime()) / 86_400_000))
    : 0;
  const photoUrl = campaign?.cover_image_url || fallbackImageUrl;
  const heroHref = campaign ? `/campaigns/${campaign.slug}` : '/campaigns';
  const heroTitle = campaign?.title ?? 'Start a trusted campaign on CharitMe';
  const trustScore = campaign?.campaign_health_score ?? campaign?.trust_status ?? '—';

  return (
    <div
      className="kind-hero-art"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Dynamic photo with crossfade ── */}
      <div
        className="kind-photo"
        style={{
          backgroundImage: `url(${photoUrl})`,
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.3s ease, background-image 0s 0.3s',
        }}
        aria-hidden="true"
      />

      {/* ── Floating stat badges ── */}
      <div className="kind-floating kind-floating-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
        <div>
          <span>Trust Score</span>
          <strong style={{ transition: 'opacity 0.3s', opacity: fading ? 0 : 1 }}>
            {typeof trustScore === 'number' ? trustScore : (campaign?.campaign_health_score ?? 0)}
          </strong>
          <small style={{ transition: 'opacity 0.3s', opacity: fading ? 0 : 1 }}>
            {campaign?.trust_status ?? 'Live'}
          </small>
        </div>
      </div>

      <div className="kind-floating kind-floating-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <div>
          <strong style={{ transition: 'opacity 0.3s', opacity: fading ? 0 : 1 }}>
            {(campaign?.backer_count ?? 0).toLocaleString()}
          </strong>
          <span>Donors</span>
        </div>
      </div>

      <div className="kind-floating kind-floating-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>
        <div>
          <strong style={{ transition: 'opacity 0.3s', opacity: fading ? 0 : 1 }}>{heroPercent}%</strong>
          <span>Funded</span>
        </div>
      </div>

      <div className="kind-floating kind-floating-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        <div>
          <strong>Real-time</strong>
          <span>Impact Updates</span>
        </div>
      </div>

      {/* ── Campaign card — position:relative so the progress bar can anchor to its bottom ── */}
      <div className="kind-campaign-card" style={{ transition: 'opacity 0.3s', opacity: fading ? 0 : 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div className="kind-verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={14} height={14}><path d="M20 6L9 17l-5-5"/></svg>
            VERIFIED CAMPAIGN
          </div>
          {campaign?.featured && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 999, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontSize: 11, fontWeight: 950 }}>
              ⭐ FEATURED
            </span>
          )}
        </div>
        <h2>{heroTitle}</h2>
        <p>
          Organized by {campaign?.organizer_name ?? 'CharitMe Organizer'}
          <b aria-hidden="true" />
        </p>
        <div className="kind-raise-row">
          <strong>{formatCents(campaign?.raised_amount ?? 0)} <span>raised</span></strong>
          <span>{formatCents(campaign?.goal_amount ?? 0)} goal</span>
        </div>
        <div className="kind-progress">
          <i style={{ width: `${heroPercent}%` }} />
        </div>
        <div className="kind-raise-row kind-small">
          <span>{(campaign?.backer_count ?? 0).toLocaleString()} donations</span>
          <span>{daysLeft > 0 ? `${daysLeft} days left` : 'No deadline'}</span>
        </div>
        <Link href={heroHref} className="kind-donate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
          Donate Now
        </Link>

        {/* Auto-play progress bar anchored to the BOTTOM of the campaign card */}
        {count > 1 && !paused && (
          <div
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 3,
              background: 'rgba(108,53,255,.12)',
              overflow: 'hidden',
              borderRadius: '0 0 22px 22px', // match card's bottom border-radius
            }}
          >
            <div
              key={`${active}-progress`}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg,#6c35ff,#b43bef)',
                animation: `heroProgress ${ROTATION_INTERVAL}ms linear`,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Rotation controls (only when multiple campaigns) ── */}
      {count > 1 && (
        <>
          {/*
            Dot indicators — positioned OUTSIDE the floating badge column.
            Floating boxes sit at right:0. We use right:-20px so the dots
            appear to the right of (outside) those boxes.
          */}
          <div style={{
            position: 'absolute',
            right: -20,           // outside the floating boxes column
            top: 80,              // start at the level of the first badge
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 12,
            alignItems: 'center',
          }}>
            {campaigns.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to campaign ${i + 1}`}
                onClick={() => goTo(i)}
                style={{
                  width: i === active ? 10 : 7,
                  height: i === active ? 10 : 7,
                  borderRadius: '50%',
                  background: i === active ? '#6c35ff' : 'rgba(108,53,255,.28)',
                  border: i === active ? '2px solid rgba(108,53,255,.5)' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all .2s',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/*
            Prev / Next arrows — below the Real-time Impact Updates badge.
            That badge is at top:358px and is ~60px tall → arrows below at top:432px.
            Placed in the floating badge column at right:0.
          */}
          <div style={{
            position: 'absolute',
            right: 0,
            top: 432,
            display: 'flex',
            gap: 8,
            zIndex: 12,
          }}>
            <button
              type="button"
              aria-label="Previous campaign"
              onClick={retreat}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,.92)',
                border: '1px solid rgba(108,53,255,.3)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,.10)',
                fontSize: 16, color: '#6c35ff', fontWeight: 700,
                transition: 'background .15s',
              }}
            >‹</button>
            <button
              type="button"
              aria-label="Next campaign"
              onClick={advance}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,.92)',
                border: '1px solid rgba(108,53,255,.3)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,.10)',
                fontSize: 16, color: '#6c35ff', fontWeight: 700,
                transition: 'background .15s',
              }}
            >›</button>
          </div>
        </>
      )}
    </div>
  );
}
