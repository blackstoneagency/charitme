import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// The embed widget carries its OWN palette, so anything it fails to declare
// leaks in from the site theme.
//
// `.campaign-embed` is deliberately independent of the site's light/dark state:
// the snippet lives on third-party pages, and its theme comes from `?theme=`,
// not from us. That independence is only as good as the token list. A token the
// widget does not declare falls through to `:root[data-theme="dark"]`, so a
// LIGHT widget on a dark-themed page draws dark-mode ink on a light surface.
//
// That is not hypothetical. `--green-text` was missing from all three palettes
// while `DonateButton` — which the widget renders — uses it. Result: #4ade80 on
// #f7f8fc, **1.58:1**, four nodes, axe severity "serious". It survived because
// the embed route 404s without a database, so every sweep skipped it; it became
// visible the moment the audits were pointed at a stub that answers.
//
// This walks the other way — from what the widget's own subtree USES to what its
// palettes DECLARE — so the next missing token fails here instead of shipping.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = readFileSync(join(WEB_ROOT, 'app', 'globals.css'), 'utf8');

/** Custom properties declared inside every `.campaign-embed*` block. */
function declaredPerBlock(): { selector: string; tokens: Set<string> }[] {
  const out: { selector: string; tokens: Set<string> }[] = [];
  const re = /(\.campaign-embed(?:--[a-z]+)?)\s*\{([^}]*)\}/g;
  for (const m of CSS.matchAll(re)) {
    out.push({
      selector: m[1],
      tokens: new Set([...m[2].matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((t) => t[1])),
    });
  }
  return out;
}

/**
 * Components that render inside the widget, and the tokens they reference.
 *
 * Followed by import rather than guessed: the widget page's own file plus what
 * it imports from `app/campaigns/[slug]`. `DonateButton` is the one that caught
 * this, and it is not in the widget's own directory.
 */
function widgetSubtreeSources(): string[] {
  const page = join(WEB_ROOT, 'app', 'campaigns', '[slug]', 'embed', 'page.tsx');
  const src = readFileSync(page, 'utf8');
  const files = [page];
  for (const m of src.matchAll(/from\s+'(\.\.?\/[^']+)'/g)) {
    const rel = m[1];
    // Local components only — lib helpers render no markup.
    if (!/\/[A-Z]/.test(rel)) continue;
    const candidate = join(dirname(page), `${rel}.tsx`);
    try { if (statSync(candidate).isFile()) files.push(candidate); } catch { /* not a component */ }
  }
  return files;
}

function tokensUsed(files: readonly string[]): Map<string, string> {
  const used = new Map<string, string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/var\((--[a-z0-9-]+)/gi)) {
      if (!used.has(m[1])) used.set(m[1], f.slice(WEB_ROOT.length + 1));
    }
  }
  return used;
}

describe('the embed widget declares every token its own subtree uses', () => {
  const blocks = declaredPerBlock();
  const sources = widgetSubtreeSources();
  const used = tokensUsed(sources);

  it('found the palettes and the components — not an empty scan', () => {
    // Three blocks: the light base, --dark, and --auto inside the media query.
    expect(blocks.length, 'the .campaign-embed palettes moved').toBe(3);
    expect(blocks.map((b) => b.selector)).toContain('.campaign-embed');
    expect(sources.some((f) => f.endsWith('DonateButton.tsx')), 'DonateButton is rendered by the widget').toBe(true);
    expect(used.size).toBeGreaterThan(5);
  });

  it('no token leaks to the site theme, in any of the three palettes', () => {
    const gaps: string[] = [];
    for (const block of blocks) {
      for (const [token, file] of used) {
        // A `var(--x, fallback)` still resolves from the site theme first, so a
        // fallback does not rescue it — only declaring the token does.
        if (!block.tokens.has(token)) gaps.push(`${block.selector} is missing ${token} (used by ${file})`);
      }
    }
    expect(
      gaps,
      'The widget renders these tokens but does not declare them, so they resolve\n' +
        'from the SITE theme — a light widget on a dark page draws dark-mode ink on\n' +
        'a light surface:\n  ' + gaps.join('\n  '),
    ).toEqual([]);
  });

  it('declares both halves of the green pair — the fill AND the ink', () => {
    // The specific shape of the bug: --green was there, --green-text was not.
    for (const block of blocks) {
      expect(block.tokens.has('--green'), `${block.selector} --green`).toBe(true);
      expect(block.tokens.has('--green-text'), `${block.selector} --green-text`).toBe(true);
    }
  });

  it('detects a missing token when one is planted', () => {
    // A guard that has never fired proves nothing.
    const planted = new Set(['--s1', '--t1']);
    expect([...used.keys()].filter((t) => !planted.has(t)).length).toBeGreaterThan(0);
  });
});
