import type { CSSProperties } from 'react';

/**
 * Shared inline styles for steps 9–12.
 *
 * Four screens in one flow have to look like one flow, and this codebase styles
 * inline — so the alternative is four copies of the same numbers, which drift.
 * (Three hand-maintained copies of CAMPAIGN_CATEGORIES already drifted here;
 * this is the same failure in CSS.)
 *
 * Every horizontal container below sets `minWidth: 0`. A bare `1fr` grid column
 * is `minmax(auto, 1fr)`, and flex items default to `min-width: auto`, so both
 * refuse to shrink below their content — a long campaign title or a 66-character
 * Stripe id then pushes the page wider than the viewport. `html`/`body` set
 * `overflow-x: hidden`, so the page does not scroll to reveal it: it CLIPS. And
 * an inline style carries no media query, so it cannot be corrected at a
 * breakpoint later.
 */

export const flowShell: CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '56px 24px 72px',
  textAlign: 'center',
  minWidth: 0,
};

export const panel: CSSProperties = {
  textAlign: 'left',
  padding: 20,
  border: '1px solid var(--b1)',
  borderRadius: 'var(--rl)',
  background: 'var(--s1)',
  minWidth: 0,
};

export const dl: CSSProperties = {
  margin: 0,
  display: 'grid',
  // `auto` for the term, `minmax(0, 1fr)` for the value — the value is the side
  // that can be arbitrarily long, and it is the side allowed to shrink.
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  rowGap: 10,
  columnGap: 16,
  fontSize: 14,
};

export const dt: CSSProperties = { color: 'var(--t3)' };

export const dd: CSSProperties = {
  margin: 0,
  color: 'var(--t1)',
  fontWeight: 650,
  textAlign: 'right',
  minWidth: 0,
  overflowWrap: 'anywhere',
};

const action: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // 46 ≥ the 44px WCAG 2.2 target minimum, with room for a focus ring.
  minHeight: 46,
  padding: '0 22px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 15,
  textDecoration: 'none',
  minWidth: 0,
};

export const primaryAction: CSSProperties = {
  ...action,
  background: 'var(--fill-brand)',
  color: '#fff',
};

export const outlineAction: CSSProperties = {
  ...action,
  border: '1px solid var(--b2)',
  background: 'var(--s1)',
  color: 'var(--t1)',
  fontWeight: 650,
};

export const quietLink: CSSProperties = {
  color: 'var(--t3)',
  fontSize: 14,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};
