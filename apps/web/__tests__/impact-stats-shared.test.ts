import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseImpactTiles, MAX_IMPACT_TILES } from '../lib/impact-stats';

// ─────────────────────────────────────────────────────────────────────────────
// /about-us and /success-stories show the SAME five-tile impact strip.
//
// Two copies of one claim is how this repo's three hand-maintained copies of
// CAMPAIGN_CATEGORIES drifted. Here the stakes are higher than a category list:
// a figure that disagrees with itself across two pages of the same site tells
// the visitor at least one page is lying, on a platform whose entire product is
// being trusted with money.
//
// So both pages read `resolveImpactTiles`, and this fails if either stops.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

/**
 * Comments are stripped before the figure sweep below.
 *
 * Both pages carry a comment that QUOTES the reference figures to explain why
 * they are not rendered. That documentation is the most valuable part of the
 * decision and must not be what trips the guard — the first version of this
 * test matched it and demanded the explanation be deleted.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const PAGES = ['app/about-us/page.tsx', 'app/success-stories/page.tsx'];

describe('the impact strip has one source', () => {
  it('both pages resolve it through the shared module', () => {
    for (const page of PAGES) {
      const src = read(page);
      expect(src, `${page} must import the shared resolver`).toContain(
        "from '../../lib/impact-stats'",
      );
      expect(src, `${page} must await resolveImpactTiles`).toContain('await resolveImpactTiles(');
      // The prop takes the resolved array, not a literal — a literal would be a
      // second copy that this guard could not see.
      expect(src, `${page} must pass the resolved tiles to StatStrip`).toContain('tiles={impactTiles}');
    }
  });

  it('neither page hardcodes the reference figures', () => {
    // Measured 2026-08-08: 352 active campaigns, $96,850 raised, 69 supported
    // countries. The designs read 2.3M+, 68K+, 1,250+, 120+ and 98% — two of
    // them ~1000x the real value, and "98% Funds to Programs" contradicts the
    // 0% platform fee that /fees documents. They are the OWNER's to publish
    // through settings, not ours to bake into a page.
    for (const page of PAGES) {
      const src = stripComments(read(page));
      for (const figure of ['2.3M', '68K', '1,250+', '120+', '98%']) {
        expect(src, `${page} must not hardcode "${figure}"`).not.toContain(figure);
      }
    }
  });

  it('the measured fallback still explains itself, and only when it applies', () => {
    // The footnotes describe how the MEASURED numbers are counted. Under
    // owner-entered figures they would be describing something else entirely.
    for (const page of PAGES) {
      expect(read(page), `${page} must gate its footnote`).toContain('!ownerSetImpact &&');
    }
  });
});

describe('parseImpactTiles', () => {
  it('accepts well-formed tiles', () => {
    expect(parseImpactTiles('[{"value":"2.3M+","label":"People Helped"}]')).toEqual([
      { value: '2.3M+', label: 'People Helped' },
    ]);
  });

  it('takes jsonb that is already parsed, not only a string', () => {
    expect(parseImpactTiles([{ value: '69', label: 'Countries' }])).toEqual([
      { value: '69', label: 'Countries' },
    ]);
  });

  it('drops a figure with no claim attached', () => {
    // A number with no label is a statistic about nothing; a label with no
    // number is an empty promise. Both are worse than one fewer tile.
    expect(parseImpactTiles('[{"value":"120+"},{"label":"Countries"}]')).toEqual([]);
    expect(parseImpactTiles('[{"value":"  ","label":"Countries"}]')).toEqual([]);
  });

  it('is empty for anything that is not an array of objects', () => {
    for (const bad of ['not json', '{}', '"a string"', 'null', '[1,2,3]', '[[]]']) {
      expect(parseImpactTiles(bad), bad).toEqual([]);
    }
    expect(parseImpactTiles(undefined)).toEqual([]);
  });

  it('bounds the strip at five, because the layout has five columns', () => {
    const many = JSON.stringify(
      Array.from({ length: 9 }, (_, i) => ({ value: `${i}`, label: `Label ${i}` })),
    );
    expect(parseImpactTiles(many)).toHaveLength(MAX_IMPACT_TILES);
  });

  it('truncates rather than drops an over-long entry', () => {
    // The owner clearly meant to say something; losing the tile entirely would
    // silently shrink the strip.
    const [tile] = parseImpactTiles([{ value: 'x'.repeat(50), label: 'y'.repeat(80) }]);
    expect(tile.value.length).toBeLessThanOrEqual(12);
    expect(tile.label.length).toBeLessThanOrEqual(32);
  });
});

describe('the owner can actually edit it', () => {
  it('has an editing surface, a diff label, and a warning about what it publishes', () => {
    const client = read('app/admin/system/_components/SystemClient.tsx');
    expect(client).toContain("setField('about', 'impactStats'");
    expect(client).toContain("impactStats: 'Impact Stats (JSON)'");
    // These render to donors as impact claims and nothing verifies them. The
    // person typing them should be told that where they type them.
    expect(client).toContain('published as impact claims');
  });
});
