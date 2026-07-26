'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ── Formatting shared with the server stats ──────────────────────────────────
function fmtMoney(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000_000) return `$${(d / 1_000_000_000).toFixed(1)}B`;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${(d / 1_000).toFixed(1)}K`;
  return `$${Math.round(d).toLocaleString()}`;
}
function fmtInt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
function fmtValue(v: number, kind: 'money' | 'int' | 'percent'): string {
  if (kind === 'money') return fmtMoney(v);
  if (kind === 'percent') return `${Math.round(v)}%`;
  return fmtInt(v);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

// ── Animated count-up. Renders the final value for SSR/SEO/no-JS, then animates
//    from 0 the first time it scrolls into view (unless reduced-motion). ───────
export function CountUp({
  value,
  kind = 'int',
  className,
}: {
  value: number;
  kind?: 'money' | 'int' | 'percent';
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() => fmtValue(value, kind));
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      // Initial state already renders the final value; nothing to animate.
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || done.current) continue;
        done.current = true;
        io.disconnect();
        const duration = 1500;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(fmtValue(value * eased, kind));
          if (p < 1) requestAnimationFrame(tick);
          else setDisplay(fmtValue(value, kind));
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, kind]);

  return <span ref={ref} className={className}>{display}</span>;
}

// ── Scroll reveal. Adds `.is-in` when the element enters the viewport. Content
//    is fully visible without JS (the base class only translates/opacity when
//    JS has marked it revealable), so no-JS users see everything. ─────────────
export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => setShown(true));
      return;
    }
    // Arm (hide for the reveal animation) only once we know JS is running, so
    // no-JS users always see content. Deferred to avoid a sync set in-effect.
    queueMicrotask(() => setArmed(true));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setShown(true); io.disconnect(); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    // Safety net: never leave content hidden if the observer doesn't fire
    // (fast scroll, off-screen mount, prerender edge cases).
    const fallback = window.setTimeout(() => { setShown(true); io.disconnect(); }, 900);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, []);

  const Tag = as as React.ElementType;
  const cls = ['home-reveal', armed ? 'is-armed' : '', shown ? 'is-in' : '', className]
    .filter(Boolean).join(' ');
  return <Tag ref={ref} className={cls} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</Tag>;
}

// ── AI natural-language cause search. Submits to the real /campaigns search. ──
const EXAMPLES = [
  'Children in need of medical care',
  'Help animals and rescue shelters',
  'Families facing an emergency',
  'Support education and scholarships',
  'Disaster relief near me',
];

export function AiSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function go(query: string) {
    const trimmed = query.trim();
    router.push(trimmed ? `/campaigns?q=${encodeURIComponent(trimmed)}` : '/campaigns');
  }

  return (
    <div className="home-ai">
      <form
        className="home-ai-bar"
        role="search"
        onSubmit={(e) => { e.preventDefault(); go(q); }}
      >
        <span className="home-ai-spark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe who you want to help…"
          aria-label="Describe who you want to help and find matching causes"
          className="home-ai-input"
        />
        <button type="submit" className="home-ai-go">
          Find causes
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </form>
      <div className="home-ai-chips" role="group" aria-label="Example searches">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="home-ai-chip" onClick={() => { setQ(ex); go(ex); }}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
