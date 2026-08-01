// ─────────────────────────────────────────────────────────────────────────────
// The shared layout for the marketing pages added in the design-mirror build.
//
// Everything here is CSS variables. `components/MarketingPage.tsx` is the older
// pattern and hardcodes a light palette (`bg-white`, `text-slate-950`) — that is
// precisely what `__tests__/theme-tokens.test.ts` blocks, because the site ships
// DARK, so a hardcoded light card renders dark text on a dark surface. A
// two-theme sweep found ~138 nodes at 1.22:1 from one such class.
//
// Ten near-identical pages sharing one shell also means a contrast fix lands in
// all ten at once instead of nine of them.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHero({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <header style={{ maxWidth: '760px', marginBottom: '44px' }}>
      {eyebrow && (
        <div
          style={{
            display: 'inline-flex',
            padding: '5px 12px',
            marginBottom: '16px',
            borderRadius: '999px',
            background: 'var(--s2)',
            border: '1px solid var(--b1)',
            fontSize: '12px',
            fontWeight: 750,
            color: 'var(--green-text)',
            letterSpacing: '.02em',
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        style={{
          fontSize: 'clamp(30px, 5vw, 46px)',
          fontWeight: 800,
          color: 'var(--t1)',
          lineHeight: 1.12,
          letterSpacing: '-.02em',
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: '17px', color: 'var(--t3)', lineHeight: 1.65, marginTop: '16px' }}>{lede}</p>
      {actions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '26px' }}>{actions}</div>
      )}
    </header>
  );
}

export function Section({
  id,
  heading,
  intro,
  children,
}: {
  id: string;
  heading: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} style={{ marginBottom: '52px' }}>
      <h2 id={id} style={{ fontSize: '22px', fontWeight: 780, color: 'var(--t1)', letterSpacing: '-.01em' }}>
        {heading}
      </h2>
      {intro && (
        <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.6, marginTop: '10px', maxWidth: '680px' }}>
          {intro}
        </p>
      )}
      <div style={{ marginTop: '22px' }}>{children}</div>
    </section>
  );
}

/** Responsive card grid. `min(100%, …)` is what stops 320px horizontal overflow. */
export function CardGrid({ min = 280, children }: { min?: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))`,
        gap: '18px',
      }}
    >
      {children}
    </div>
  );
}

export function InfoCard({
  title,
  body,
  step,
  href,
}: {
  title: string;
  body: string;
  step?: string;
  href?: string;
}) {
  const inner = (
    <div
      style={{
        padding: '22px',
        height: '100%',
        background: 'var(--s1)',
        border: '1px solid var(--b1)',
        borderRadius: 'var(--rl)',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
      }}
    >
      {step && (
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--green-text)', letterSpacing: '.06em' }}>
          {step}
        </span>
      )}
      <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--t1)', lineHeight: 1.3 }}>{title}</h3>
      <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6 }}>{body}</p>
    </div>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * A statistic.
 *
 * `value` is a string so a page can pass an em-dash when a number could not be
 * measured. Nothing here invents a figure — the repeated bug on this site is a
 * failed loader rendering as "$0" or "0 days left", which reads as a confident
 * fact rather than missing data.
 */
export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        padding: '20px',
        background: 'var(--s2)',
        border: '1px solid var(--b1)',
        borderRadius: 'var(--rl)',
      }}
    >
      <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

export function CtaBand({
  heading,
  body,
  primary,
  secondary,
}: {
  heading: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <div
      style={{
        marginTop: '8px',
        padding: '32px 28px',
        background: 'var(--s2)',
        border: '1px solid var(--b1)',
        borderRadius: 'var(--rxl)',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '21px', fontWeight: 780, color: 'var(--t1)' }}>{heading}</h2>
      <p style={{ fontSize: '15px', color: 'var(--t3)', margin: '10px auto 20px', maxWidth: '560px', lineHeight: 1.6 }}>
        {body}
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={primary.href} className="cta-primary" style={{ display: 'inline-flex' }}>
          {primary.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '11px 22px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--b2)',
              color: 'var(--t1)',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/** Standard page wrapper — one place controlling gutters and vertical rhythm. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="container" style={{ padding: '48px 0 72px' }}>
      {children}
    </div>
  );
}
