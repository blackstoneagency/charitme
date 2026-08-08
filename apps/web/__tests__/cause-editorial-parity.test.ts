import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAUSES, getCause, type Cause, type HelpIcon } from '../lib/causes';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const css = read('app/globals.css');
const glyphs = read('components/HelpGlyph.tsx');

// The two reference designs. Every other cause is held to the shape these two
// establish, rather than to a list written down separately here — if a
// reference gains a field, this file starts failing for the other eighteen.
const REFERENCES = ['sports-youth', 'people-in-need'] as const;

/**
 * The fields that make a cause page a PAGE rather than a hero over a grid.
 *
 * Before this suite, seventeen of the twenty causes declared none of the last
 * three: no `helps`, so "How Your Support Helps" did not render at all, and no
 * closing copy, so every one of them ended on the same translated fallback.
 */
const REQUIRED = ['impactTitle', 'blurb', 'intro', 'tagline', 'ctaTitle', 'ctaBlurb', 'helps'] as const;

describe('every cause is built out, not just the two with reference designs', () => {
  it('the references themselves still carry every field', () => {
    // Guards the guard: if a reference lost a field, the loop below would stop
    // requiring it everywhere and this suite would quietly weaken.
    for (const slug of REFERENCES) {
      const c = getCause(slug)!;
      for (const key of REQUIRED) {
        expect(c[key], `${slug} lost ${key} — parity can no longer be checked`).toBeTruthy();
      }
    }
  });

  it.each(CAUSES.map((c) => [c.slug, c] as [string, Cause]))('%s carries every editorial field', (slug, c) => {
    for (const key of REQUIRED) {
      expect(c[key], `${slug} is missing ${key}`).toBeTruthy();
    }
  });

  it.each(CAUSES.map((c) => [c.slug, c] as [string, Cause]))('%s fills its helps grid', (slug, c) => {
    // Four is the floor because People in Need's reference draws four cards and
    // a four-row hero card; the rest draw five. Fewer than four leaves visible
    // gaps in the grid, which reads as a page that failed to load.
    expect(c.helps!.length, `${slug} has too few helps cards`).toBeGreaterThanOrEqual(4);
  });

  it.each(CAUSES.map((c) => [c.slug, c] as [string, Cause]))('%s gives each card its own glyph', (slug, c) => {
    const icons = c.helps!.map((h) => h.icon);
    expect(icons.every(Boolean), `${slug} has a card with no icon`).toBe(true);
    expect(new Set(icons).size, `${slug} repeats a glyph inside one grid`).toBe(icons.length);
  });

  it.each(CAUSES.map((c) => [c.slug, c] as [string, Cause]))('%s says what a gift buys without inventing a figure', (slug, c) => {
    // Editorial copy is allowed on these cards — it is a claim about the cause.
    // A COUNT is not: this repo has already had to retract one fabricated
    // statistic, and 100 hand-written card bodies is exactly where another
    // would slip in.
    for (const h of c.helps!) {
      expect(h.body.length, `${slug}/${h.title} is too short to be useful`).toBeGreaterThan(40);
      expect(
        /\d[\d,.]*\s*(\+|k\b|m\b|million|people|patients|families|children|students|animals)/i.test(h.body),
        `${slug}/${h.title} states an unmeasured figure`,
      ).toBe(false);
    }
  });
});

describe('no cause is a copy of another', () => {
  const dupes = (pick: (c: Cause) => string | undefined) => {
    const seen = new Map<string, string>();
    const out: string[] = [];
    for (const c of CAUSES) {
      const v = pick(c);
      if (!v) continue;
      const prior = seen.get(v);
      if (prior) out.push(`${c.slug} repeats ${prior}`);
      seen.set(v, c.slug);
    }
    return out;
  };

  it('closing headings are unique', () => {
    // Twenty pages sharing a closing heading is the duplicate-H1 problem one
    // section further down the page.
    expect(dupes((c) => c.ctaTitle)).toEqual([]);
  });

  it('closing copy is unique', () => {
    expect(dupes((c) => c.ctaBlurb)).toEqual([]);
  });

  it('no two causes ship an identical helps card', () => {
    // Titles legitimately recur across causes ("Clean the water" suits both
    // animals and environment). An identical title AND body is copy-paste.
    const seen = new Map<string, string>();
    const out: string[] = [];
    for (const c of CAUSES) {
      for (const h of c.helps ?? []) {
        const key = `${h.title}|${h.body}`;
        const prior = seen.get(key);
        if (prior) out.push(`${c.slug} repeats "${h.title}" verbatim from ${prior}`);
        seen.set(key, c.slug);
      }
    }
    expect(out).toEqual([]);
  });
});

describe('every glyph a cause names is drawable and coloured', () => {
  // Both halves caught real omissions while this was being written: an icon
  // added to the union renders a BLANK badge until it is drawn, and an
  // UNSTYLED one until it has a colour rule. Neither fails typecheck, and
  // neither is visible in a diff.
  const used = new Set<HelpIcon>();
  for (const c of CAUSES) {
    for (const h of c.helps ?? []) if (h.icon) used.add(h.icon);
    for (const p of c.programs ?? []) used.add(p.icon);
  }

  it('the icon set is actually in use', () => {
    // Without this, an empty `used` set would make every loop below pass
    // vacuously.
    expect(used.size).toBeGreaterThanOrEqual(20);
  });

  it('draws each one', () => {
    for (const icon of used) {
      expect(glyphs, `HelpGlyph has no path for "${icon}"`).toContain(`${icon}:`);
    }
  });

  it('gives each one a badge colour on the helps grid', () => {
    for (const icon of used) {
      // Matched to a word boundary, not a trailing space: several rules are
      // comma-separated (`.cl-helps-ic--food, .cl-helps-ic--gear { … }`), and a
      // bare `toContain` would also accept a longer class that merely starts
      // with this name.
      expect(css, `.cl-helps-ic--${icon} has no colour rule`).toMatch(
        new RegExp(`\\.cl-helps-ic--${icon}(?![\\w-])`),
      );
    }
  });

  it('gives each hero-card glyph the same colour it has on the grid', () => {
    // A glyph that changed hue between the hero card and the grid on one page
    // would read as two different things.
    for (const icon of new Set(CAUSES.flatMap((c) => (c.programs ?? []).map((p) => p.icon)))) {
      expect(css, `.cl-programs-ic--${icon} has no colour rule`).toMatch(
        new RegExp(`\\.cl-programs-ic--${icon}(?![\\w-])`),
      );
    }
  });
});
