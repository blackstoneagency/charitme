import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

const COMPONENT = 'components/BackToTop.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// The floating "back to top" control. Behaviour is verified in a real browser;
// these guard the decisions that are easy to undo by accident and whose failure
// is silent — nothing throws, the control just becomes worse.
// ─────────────────────────────────────────────────────────────────────────────

describe('back to top is mounted everywhere except the embed widget', () => {
  it('is rendered from the ROOT LAYOUT, not from a shell', () => {
    // AppShell short-circuits for /dashboard, /admin and /profile, which render
    // their own shell — mounting there would miss the longest pages in the app.
    const layout = read('app/layout.tsx');
    expect(layout).toContain('<BackToTop />');
    expect(layout).toMatch(/import BackToTop from '\.\.\/components\/BackToTop'/);
  });

  it('excludes the campaign embed widget', () => {
    // The embed runs inside a third-party iframe and must render no CharitMe
    // chrome at all.
    const src = read(COMPONENT);
    expect(src).toContain('isEmbedRoute');
  });

  it('shares ONE embed matcher with AppShell rather than copying the regex', () => {
    const shell = read('components/AppShell.tsx');
    expect(shell, 'isEmbedRoute must be exported for BackToTop to reuse')
      .toMatch(/export function isEmbedRoute/);
    // A second copy of the pattern would eventually disagree, and the failure
    // mode is a floating button appearing inside somebody else's page.
    const copies = read(COMPONENT).match(/\\\/campaigns\\\//g) ?? [];
    expect(copies, 'BackToTop re-declares the embed regex').toHaveLength(0);
  });
});

describe('the control does not degrade accessibility', () => {
  const src = read(COMPONENT);

  it('unmounts instead of hiding, so it never sits in the tab order inertly', () => {
    // `hidden` / opacity:0 would leave a focusable button that does nothing
    // visible for a keyboard user near the top of a short page.
    expect(src).toMatch(/if \(!visible.*\) return null;/);
  });

  it('moves focus, not just the viewport', () => {
    // Scrolling alone leaves focus on a now-offscreen button, so the next Tab
    // resumes from the bottom of the page.
    expect(src).toContain("getElementById('main-content')");
    expect(src).toMatch(/\.focus\(\{ preventScroll: true \}\)/);
  });

  it('has an accessible name and hides the decorative glyph', () => {
    expect(src).toContain('aria-label="Back to top"');
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain('type="button"');
  });

  it('honours prefers-reduced-motion, read at click time', () => {
    // A full-page scroll animation is exactly what the preference suppresses.
    // Read per click so a mid-session change is picked up.
    expect(src).toContain("matchMedia?.('(prefers-reduced-motion: reduce)')");
    expect(src).toMatch(/behavior: reduced \? 'auto' : 'smooth'/);
  });

  it('throttles its scroll listener to animation frames', () => {
    // This listener runs on every page of the site.
    expect(src).toContain('requestAnimationFrame');
    expect(src).toContain('{ passive: true }');
    expect(src).toContain('cancelAnimationFrame');
  });
});

describe('the control is visible in both themes', () => {
  const css = read('app/globals.css');
  const block = css.slice(css.indexOf('.back-to-top {'), css.indexOf('.back-to-top {') + 1400);

  it('is styled with tokens, so it flips theme without a parallel dark block', () => {
    expect(block).toMatch(/background: var\(--s1/);
    expect(block).toMatch(/color: var\(--t1/);
  });

  it('draws its ring with --t4, not --b2', () => {
    // The button surface (--s1) is within a couple of points of the page
    // background in BOTH themes, so the circle is identifiable only by its
    // edge. --b2 rendered that edge at 1.34:1 light / 1.58:1 dark — a ring you
    // cannot see. --t4 measures 5.38:1 and 3.31:1 against the page.
    expect(block).toMatch(/border: 1px solid var\(--t4/);
    expect(block, 'ring reverted to the invisible --b2').not.toMatch(/border: 1px solid var\(--b2/);
  });

  it('keeps a target of at least 44px at every size', () => {
    expect(block).toMatch(/width: 48px/);
    expect(block).toMatch(/height: 48px/);
    const mobile = css.slice(css.indexOf('.back-to-top { right: 16px'), css.indexOf('.back-to-top { right: 16px') + 120);
    expect(mobile).toMatch(/width: 44px; height: 44px/);
  });

  it('sits below the transient overlays it would otherwise cover', () => {
    // InstallPrompt is z-1000 and the settings toast is z-9999; both are
    // transient and both matter more than a scroll affordance.
    const z = block.match(/z-index: (\d+)/);
    expect(z).not.toBeNull();
    expect(Number(z![1])).toBeLessThan(1000);
  });
});
