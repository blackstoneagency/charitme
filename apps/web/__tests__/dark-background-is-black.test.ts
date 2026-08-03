import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Dark mode's page canvas is TRUE BLACK (#000), by product decision.
//
// It was `#0b0d24` with a navy radial wash on `body`, plus four more page-level
// gradients that each had to agree with it. That is the shape this file has been
// bitten by before: one visual fact spread across several rules, which drift
// apart one edit at a time. The wash is gone and every canvas is a flat #000.
//
// Depth now comes from the SURFACE tokens (--s1/--s2/--s3), which stay lifted
// above the page. That is deliberate: a card has to be distinguishable from the
// page behind it, and lifting the surface is how, not tinting the page.
//
// Verified in a browser at the time of the change: 83 public routes rendered in
// dark mode, every one reporting `rgb(0, 0, 0)` for the body with no residual
// background-image.
// ─────────────────────────────────────────────────────────────────────────────

/** The `[data-theme="dark"] { … }` token block. */
function darkTokenBlock(): string {
  const start = CSS.indexOf('[data-theme="dark"] {');
  expect(start, 'dark token block not found').toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf('\n}', start));
}

/**
 * The DECLARATIONS of a `[data-theme="dark"] <selector> { … }` rule.
 *
 * Comments are stripped first. Without that, a rule whose comment explains why
 * it no longer uses a gradient fails the "has no gradient" assertion — which is
 * exactly what happened when this test was written, and is the same
 * match-the-text-not-the-code mistake that has cost time elsewhere today.
 */
function darkRule(selector: string): string {
  const needle = `[data-theme="dark"] ${selector}`;
  const at = CSS.indexOf(needle);
  expect(at, `rule not found: ${needle}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', at);
  const body = CSS.slice(open, CSS.indexOf('}', open));
  return body.replace(/\/\*[\s\S]*?\*\//g, '');
}

const BLACK = /#000000|#000\b/;

describe('dark mode paints a true black page', () => {
  it('--bg is black', () => {
    expect(darkTokenBlock()).toMatch(/--bg:\s*#000000/);
  });

  it('body is a flat black with no gradient wash', () => {
    const body = darkRule('body');
    expect(body).toMatch(BLACK);
    // The specific regression: a radial/linear ramp painted onto the page. A
    // navy wash over black is still not black, and it is what put a coloured
    // band behind the header twice already.
    expect(body, 'body has a gradient again').not.toMatch(/gradient/);
  });

  it.each([
    ['.pub-page', 'public marketing pages'],
    ['.kf-main', 'the signed-in app canvas'],
    ['.dash-home', 'the dashboard landing'],
  ])('%s is black (%s)', (selector) => {
    const rule = darkRule(selector);
    expect(rule).toMatch(BLACK);
    expect(rule, `${selector} paints a gradient`).not.toMatch(/gradient/);
  });

  it('surfaces stay LIFTED above the page, not black too', () => {
    // If a card is also #000 it disappears into the page. The whole reason the
    // canvas can be black is that the surface tokens are not.
    const tokens = darkTokenBlock();
    for (const t of ['--s1', '--s2', '--s3']) {
      const m = new RegExp(`${t}:\\s*(#[0-9a-fA-F]{3,6})`).exec(tokens);
      expect(m, `${t} missing from the dark palette`).not.toBeNull();
      expect(m![1].toLowerCase(), `${t} is black — cards would vanish into the page`)
        .not.toMatch(/^#(000|000000)$/);
    }
  });
});
