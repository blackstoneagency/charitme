'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatMoneyCompact } from '@shared/currencies';

// One featured-campaign slide. All relative-time labels (deadlineLabel)
// and funded% are precomputed on the server so the client render is pure and never
// mismatches hydration.
export type HeroSpotItem = {
  slug: string;
  title: string;
  organizer: string;
  cover: string;
  fallbackCover: string;
  currency: string;
  trust: number;
  funded: number;
  raised: number;
  goal: number;
  backers: number;
  deadlineLabel: string;
  verified: boolean;
  href: string;
};

const ROTATE_MS = 6500;

// Inline SVGs mirror app/page.tsx's <Icon> so the carousel matches the rest of
// the hero exactly (same paths, same `hi` sizing class).
const P: Record<string, React.ReactNode> = {
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="M9 12l2 2 4-4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
};
function Ic({ name, className = 'hi' }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.heart}
    </svg>
  );
}

export default function HeroSpotlightCarousel({ items }: { items: HeroSpotItem[] }) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const pendingRef = useRef<number | null>(null);

  // Crossfade to a slide: fade out, swap after the transition, fade back in.
  const goTo = useCallback((index: number) => {
    if (count < 2) return;
    const next = ((index % count) + count) % count;
    if (next === active) return;
    pendingRef.current = next;
    setFading(true);
  }, [active, count]);

  const advance = useCallback(() => goTo(active + 1), [active, goTo]);
  const retreat = useCallback(() => goTo(active - 1), [active, goTo]);

  // Commit the swap once the fade-out finishes.
  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => {
      if (pendingRef.current !== null) setActive(pendingRef.current);
      pendingRef.current = null;
      setFading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [fading]);

  // Auto-advance — paused on hover/focus and when the user prefers reduced motion.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => goTo(active + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [active, count, paused, goTo]);

  if (count === 0) {
    // No live campaigns yet — static invitation card (no controls).
    return (
      <div className="home-spot-frame">
        <div className="home-spot-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-child-crop.webp" alt="Start a trusted campaign on CharitMe" width={640} height={460} decoding="async" />
        </div>
        <div className="home-spot-card">
          <span className="home-spot-active"><i aria-hidden="true" /> START TODAY</span>
          <h2 className="home-spot-title">Start a trusted campaign on CharitMe</h2>
          <p className="home-spot-org">Be the first to launch a fundraiser</p>
          <Link href="/create/choose-path" className="home-spot-donate"><Ic name="heart" /> Create a fundraiser</Link>
        </div>
      </div>
    );
  }

  const c = items[active];
  const fadeStyle = { transition: 'opacity .28s ease', opacity: fading ? 0 : 1 } as const;

  return (
    // Pause-on-hover is a mouse enhancement; keyboard users get the equivalent via
    // onFocusCapture/onBlurCapture, so the container needs no interactive role.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="home-spot-frame"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
    >
      <div className="home-spot-media" style={fadeStyle}>
        {/* onError swaps a broken DB cover for the deterministic category image. */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions */}
        <img
          key={c.slug}
          src={c.cover}
          alt={`Cover for ${c.title}`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width={640}
          height={460}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== c.fallbackCover) img.src = c.fallbackCover;
          }}
        />
      </div>

      <ul className="home-spot-stats" aria-label="Campaign stats" style={fadeStyle}>
        <li className="home-spot-stat">
          <span className="home-spot-ic home-spot-ic--green"><Ic name="shield" /></span>
          <div><b>{c.trust}</b><small>Trust Score</small><em>Live</em></div>
        </li>
        <li className="home-spot-stat">
          <span className="home-spot-ic home-spot-ic--blue"><Ic name="users" /></span>
          <div><b>{c.backers.toLocaleString()}</b><small>Donors</small></div>
        </li>
        <li className="home-spot-stat">
          <span className="home-spot-ic home-spot-ic--amber"><Ic name="chart" /></span>
          <div><b>{c.funded}%</b><small>Funded</small></div>
        </li>
      </ul>

      <div className="home-spot-card" style={fadeStyle}>
        <span className="home-spot-active"><i aria-hidden="true" /> {c.verified ? 'VERIFIED CAMPAIGN' : 'ACTIVE CAMPAIGN'}</span>
        <h2 className="home-spot-title">{c.title}</h2>
        <p className="home-spot-org">
          Organized by {c.organizer}
          {c.verified && <span className="home-spot-verified" role="img" aria-label="Verified organizer"><Ic name="check" /></span>}
        </p>
        <div className="home-spot-amounts">
          <strong>{formatMoneyCompact(c.raised, c.currency)}</strong> <span>raised</span>
          <em>{formatMoneyCompact(c.goal, c.currency)} goal</em>
        </div>
        <div className="home-spot-progress" role="progressbar" aria-valuenow={c.funded} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.funded}% funded`}>
          <span style={{ width: `${c.funded}%` }} />
        </div>
        <div className="home-spot-meta">
          <span>{c.backers.toLocaleString()} donations</span>
          <span>{c.deadlineLabel}</span>
        </div>
        <Link href={c.href} className="home-spot-donate"><Ic name="heart" /> Donate Now</Link>
      </div>

      {count > 1 && (
        <div className="home-spot-nav">
          <button type="button" className="home-spot-nav-btn" onClick={retreat} aria-label="Previous campaign">
            <Ic name="arrow" className="hi home-spot-nav-prev" />
          </button>
          <div className="home-spot-dots" role="tablist" aria-label="Choose featured campaign">
            {items.map((it, i) => (
              <button
                key={it.slug}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Campaign ${i + 1} of ${count}: ${it.title}`}
                className={`home-spot-dot${i === active ? ' is-active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button type="button" className="home-spot-nav-btn" onClick={advance} aria-label="Next campaign">
            <Ic name="arrow" />
          </button>
        </div>
      )}

      {/* Screen-reader live announcement of the current slide. */}
      <p className="sr-only" aria-live="polite">Featured campaign {active + 1} of {count}: {c.title}</p>
    </div>
  );
}
