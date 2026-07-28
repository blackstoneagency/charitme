'use client';
import React from 'react';
import Link from 'next/link';

// ── Btn ──────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  // #12a653 with white text is only 3.17:1 — fails AA for button-sized text.
  // --green-btn is the darkened brand green that keeps white legible in both themes.
  primary: { background: 'var(--green-btn)', color: '#fff', border: 'none' },
  secondary: { background: 'var(--s1)', color: 'var(--t1)', border: '1px solid var(--b1)' },
  ghost: { background: 'transparent', color: 'var(--t2)', border: '1px solid var(--b2)' },
  danger: { background: 'var(--red)', color: '#fff', border: 'none' },
};

const btnSizes: Record<BtnSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--r)' },
  md: { padding: '10px 20px', fontSize: '14px', borderRadius: 'var(--r)' },
  lg: { padding: '13px 28px', fontSize: '15px', borderRadius: 'var(--rl)' },
};

/** The visual identity of a button, shared by Btn and BtnLink so they cannot drift. */
function btnAppearance(variant: BtnVariant, size: BtnSize): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    transition: 'opacity .15s, background .15s',
    ...btnStyles[variant],
    ...btnSizes[size],
  };
}

export function Btn({
  variant = 'primary',
  size = 'md',
  loading,
  style,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}) {
  return (
    <button
      disabled={loading || props.disabled}
      style={{
        ...btnAppearance(variant, size),
        cursor: loading || props.disabled ? 'not-allowed' : 'pointer',
        opacity: loading || props.disabled ? 0.65 : 1,
        ...style,
      }}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// ── BtnLink ──────────────────────────────────────────────────────────────────
/**
 * A navigation control that LOOKS like a button but IS a link.
 *
 * Use this instead of `<Link><Btn>…</Btn></Link>`. That pattern renders a
 * `<button>` inside an `<a>`, which is invalid HTML — interactive content may
 * not nest — and it produced a real axe failure: the button covers the anchor,
 * leaving a 2px sliver of link exposed, so `target-size` (WCAG 2.2 AA 2.5.8)
 * fails at "147.5px by 2px". It also gives assistive tech two overlapping
 * controls for one action.
 *
 * Appearance comes from the same btnAppearance() as Btn, so the two cannot
 * drift apart visually.
 */
export function BtnLink({
  href,
  variant = 'primary',
  size = 'md',
  style,
  children,
  ...props
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  variant?: BtnVariant;
  size?: BtnSize;
}) {
  return (
    <Link
      href={href}
      style={{ ...btnAppearance(variant, size), cursor: 'pointer', textDecoration: 'none', ...style }}
      {...props}
    >
      {children}
    </Link>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  hint,
  style,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t2)' }}>{label}</label>}
      <input
        style={{
          padding: '10px 12px',
          border: `1px solid ${error ? 'var(--red)' : 'var(--b1)'}`,
          borderRadius: 'var(--r)',
          fontSize: '14px',
          color: 'var(--t1)',
          background: 'var(--bg)',
          outline: 'none',
          width: '100%',
          transition: 'border-color .15s',
          ...style,
        }}
        {...props}
      />
      {hint && !error && <span style={{ fontSize: '12px', color: 'var(--t4)' }}>{hint}</span>}
      {error && <span style={{ fontSize: '12px', color: 'var(--red-text)' }}>{error}</span>}
    </div>
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({
  label,
  error,
  hint,
  style,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t2)' }}>{label}</label>}
      <textarea
        style={{
          padding: '10px 12px',
          border: `1px solid ${error ? 'var(--red)' : 'var(--b1)'}`,
          borderRadius: 'var(--r)',
          fontSize: '14px',
          color: 'var(--t1)',
          background: 'var(--bg)',
          outline: 'none',
          width: '100%',
          resize: 'vertical',
          minHeight: '120px',
          ...style,
        }}
        {...props}
      />
      {hint && !error && <span style={{ fontSize: '12px', color: 'var(--t4)' }}>{hint}</span>}
      {error && <span style={{ fontSize: '12px', color: 'var(--red-text)' }}>{error}</span>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────
type BadgeColor = 'green' | 'red' | 'blue' | 'gray';
const badgeColors: Record<BadgeColor, React.CSSProperties> = {
  green: { background: 'var(--green-light)', color: 'var(--green-dark)' },
  red: { background: 'var(--red-light)', color: 'var(--red-text)' },
  blue: { background: 'var(--blue-light)', color: 'var(--blue-text)' },
  gray: { background: 'var(--s3)', color: 'var(--t3)' },
};

export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '99px',
      fontSize: '12px',
      fontWeight: 600,
      ...badgeColors[color],
    }}>
      {children}
    </span>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: 'var(--s3)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: pct >= 100 ? 'var(--green)' : 'var(--green)',
        borderRadius: '99px',
        transition: 'width .4s ease',
      }} />
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--b1)',
      borderRadius: 'var(--rl)',
      boxShadow: 'var(--shadow)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin .7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="31.4" strokeDashoffset="10" />
    </svg>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, body, action }: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--t3)' }}>
      {icon && <div style={{ fontSize: '40px', marginBottom: '16px' }}>{icon}</div>}
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--t2)', marginBottom: '8px' }}>{title}</h3>
      {body && <p style={{ fontSize: '14px', marginBottom: '20px' }}>{body}</p>}
      {action}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({
  label,
  error,
  style,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t2)' }}>{label}</label>}
      <select
        style={{
          padding: '10px 12px',
          border: `1px solid ${error ? 'var(--red)' : 'var(--b1)'}`,
          borderRadius: 'var(--r)',
          fontSize: '14px',
          color: 'var(--t1)',
          background: 'var(--bg)',
          outline: 'none',
          width: '100%',
          ...style,
        }}
        {...props}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--red-text)' }}>{error}</span>}
    </div>
  );
}
