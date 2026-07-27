import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// The campaign builder suggests what photos to add, per category. It listed only
// Medical / Emergency / Education / Animal, so **14 of the 18 categories** fell
// through to a generic default: a Memorial or Sports organizer was told to add a
// "Campaign hero image" while a Medical one got real guidance.
//
// CLAUDE.md calls hand-maintained copies of the category list a known drift trap
// (three had already diverged). This test is the tripwire: add a category to the
// shared list without prompts here and it fails.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE = readFileSync(join(__dirname, '../app/create/page.tsx'), 'utf8');

function suggestedPhotoKeys(): Map<string, string[]> {
  const block = /const SUGGESTED_PHOTOS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(SOURCE);
  if (!block) throw new Error('SUGGESTED_PHOTOS not found — did the constant move or get renamed?');
  const entries = new Map<string, string[]>();
  // `Key: ['a', 'b']` or `Key: ["a", 'b']`, skipping comment lines.
  for (const line of block[1].split('\n')) {
    if (/^\s*\/\//.test(line)) continue;
    const m = /^\s*(\w+)\s*:\s*\[(.*)\]/.exec(line);
    if (!m) continue;
    const values = [...m[2].matchAll(/'([^']*)'|"([^"]*)"/g)].map((v) => v[1] ?? v[2]);
    entries.set(m[1], values);
  }
  return entries;
}

describe('campaign photo suggestions cover every category', () => {
  const entries = suggestedPhotoKeys();

  it('parsed the constant (guards against this test going vacuous)', () => {
    expect(entries.size).toBeGreaterThan(5);
    expect(entries.has('default')).toBe(true);
  });

  it('has prompts for every CAMPAIGN_CATEGORY', () => {
    const missing = CAMPAIGN_CATEGORIES.filter((c) => !entries.has(c));
    expect(
      missing,
      `These categories fall back to the generic default:\n${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('offers no category that is not a real one', () => {
    const known = new Set<string>([...CAMPAIGN_CATEGORIES, 'default']);
    const stray = [...entries.keys()].filter((k) => !known.has(k));
    expect(stray, `Not in CAMPAIGN_CATEGORIES: ${stray.join(', ')}`).toEqual([]);
  });

  it('gives each category three distinct, non-empty prompts', () => {
    for (const [category, prompts] of entries) {
      expect(prompts.length, `${category} has ${prompts.length} prompts`).toBe(3);
      expect(new Set(prompts).size, `${category} repeats a prompt`).toBe(3);
      for (const p of prompts) expect(p.trim().length, `${category} has an empty prompt`).toBeGreaterThan(3);
    }
  });

  it('uses real punctuation, not HTML entities', () => {
    // These render as JSX children, where entities are NOT decoded — `&apos;`
    // would appear on screen verbatim. Same class as the `&var(--green-dark);`
    // bug a theme sweep once left in the dashboard greeting.
    for (const [category, prompts] of entries) {
      for (const p of prompts) {
        expect(p, `${category} prompt contains an HTML entity: ${p}`).not.toMatch(/&[a-z]+;|&#\d+;/);
      }
    }
  });
});
