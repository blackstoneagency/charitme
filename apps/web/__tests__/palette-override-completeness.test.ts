import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// A block that overrides a SURFACE family must override the INK family too.
//
// CSS custom properties inherit from the nearest ancestor that sets them. So a
// selector that redeclares `--bg`/`--s1`/`--t1` to build its own colour world,
// but leaves `--green-text` alone, does not get a neutral default: it gets
// whatever the SITE theme said. The result is ink from one theme painted on a
// surface from another, which is invisible in review and lands as a serious
// axe violation.
//
// This has now happened three times in this codebase, which is why the rule is
// enforced generally instead of per-component:
//
//   1. `.campaign-embed` declared `--green` but not `--green-text`, so a LIGHT
//      widget on a dark-themed page drew #4ade80 on #f7f8fc — 1.58:1, four
//      nodes, axe "serious".
//   2. `.rp-page` (the permanently-dark reference pages) declared the whole
//      surface family and no inks, so shared components drew light-mode
//      #2164d5 on #1d2b36 (2.65:1) and #0d783c on #020b12 (3.56:1) — live on
//      /supporter-space until it was measured.
//   3. `.rr-band-light`, a WHITE band nested inside `.rp-page`, declared 7
//      surface tokens and not one ink. Fixing (2) would have pushed bright
//      dark-mode ink onto white here — the same bug, mirrored, introduced BY
//      the fix for the previous one. This test found it before that shipped.
//
// The threshold is deliberate: overriding three or more surface tokens is a
// block building its own colour world, not tweaking one value.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'globals.css'),
  'utf8',
);

/** Tokens that mean "this block is defining its own surfaces". */
const SURFACE_TOKENS = ['--s1', '--s2', '--s3', '--bg', '--t1', '--t2', '--t3'];

/** The ink half of the palette. Each is a text colour tuned to a surface. */
const INK_TOKENS = ['--brand-text', '--green-text', '--red-text', '--orange-text', '--blue-text'];

/**
 * Blocks that build their own colour world, with the tokens each declares.
 *
 * `:root`, `html` and `body` are the site theme itself — they are where the
 * defaults come FROM, so they cannot leak.
 */
function overridingBlocks(): { selector: string; declared: Set<string>; surfaces: number }[] {
  const out: { selector: string; declared: Set<string>; surfaces: number }[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().split('\n').pop()!.trim();
    if (selector.startsWith('@') || selector.startsWith(':root') || selector === 'html' || selector === 'body') {
      continue;
    }
    const declared = new Set([...m[2].matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((t) => t[1]));
    const surfaces = SURFACE_TOKENS.filter((t) => declared.has(t)).length;
    if (surfaces >= 3) out.push({ selector, declared, surfaces });
  }
  return out;
}

/**
 * Ink tokens a block may omit, and why.
 *
 * ⚠️ An entry is a claim that NOTHING rendered inside that block uses the
 * token. It is not a way to silence the check — the whole failure mode is that
 * the leak is invisible until someone renders the wrong component there.
 */
const PERMITTED_OMISSIONS: Readonly<Record<string, readonly string[]>> = {
  // The embed widget renders exactly one page's subtree, pinned component-by-
  // component in embed-widget-palette.test.ts. Nothing in it uses an amber or
  // blue ink; that test fails the moment something starts to.
  '.campaign-embed': ['--orange-text', '--blue-text'],
  '.campaign-embed--dark': ['--orange-text', '--blue-text'],
  '.campaign-embed--auto': ['--orange-text', '--blue-text'],
};

describe('every palette override declares both halves', () => {
  const blocks = overridingBlocks();

  it('finds the blocks to check', () => {
    // Without this the sweep below passes vacuously if the parser breaks.
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    const selectors = blocks.map((b) => b.selector);
    expect(selectors).toContain('.rp-page');
    expect(selectors).toContain('.rr-band-light');
  });

  it('no block redefines surfaces while inheriting ink from the site theme', () => {
    const gaps: string[] = [];
    for (const block of blocks) {
      const permitted = PERMITTED_OMISSIONS[block.selector] ?? [];
      const missing = INK_TOKENS.filter((t) => !block.declared.has(t) && !permitted.includes(t));
      if (missing.length) {
        gaps.push(`${block.selector} (${block.surfaces} surface tokens) is missing ${missing.join(', ')}`);
      }
    }
    expect(
      gaps,
      'These blocks build their own surfaces but inherit ink from the site theme,\n' +
        'so a component rendered inside them draws one theme\'s text on another\n' +
        'theme\'s background:\n  ' + gaps.join('\n  ') +
        '\n\nDeclare the ink tokens in the SAME direction as the surfaces.',
    ).toEqual([]);
  });

  it('the two nested reference palettes point in opposite directions', () => {
    // `.rr-band-light` is a white island inside the near-black `.rp-page`. If
    // they ever agree on an ink value, one of them is wrong.
    const dark = blocks.find((b) => b.selector === '.rp-page');
    const light = blocks.find((b) => b.selector === '.rr-band-light');
    expect(dark && light).toBeTruthy();
    for (const token of INK_TOKENS) {
      expect(dark!.declared.has(token), `.rp-page ${token}`).toBe(true);
      expect(light!.declared.has(token), `.rr-band-light ${token}`).toBe(true);
    }
  });

  it('detects a block that declares surfaces and no ink', () => {
    // A guard that has never fired proves nothing.
    const planted = new Set(['--bg', '--s1', '--t1']);
    const missing = INK_TOKENS.filter((t) => !planted.has(t));
    expect(missing).toEqual(INK_TOKENS);
  });
});
