import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAUSES, getCause, type HelpIcon } from '../lib/causes';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const css = read('app/globals.css');
const glyphs = read('components/HelpGlyph.tsx');

const health = getCause('health-wellness')!;
const sports = getCause('sports-youth')!;

describe('Health & Wellness is built out to the same depth as Sports & Youth', () => {
  it('resolves at all — the route 404s without this', () => {
    expect(health).toBeTruthy();
    expect(health.label).toBe('Health & Wellness');
  });

  it('carries every editorial field Sports & Youth carries', () => {
    // Parity is the actual requirement, so it is asserted against the reference
    // cause rather than against a hardcoded list. If Sports & Youth grows a new
    // field, this fails and Health & Wellness gets it too — which is the point.
    for (const key of ['impactTitle', 'blurb', 'intro', 'tagline', 'ctaTitle', 'ctaBlurb', 'helps'] as const) {
      expect(sports[key], `sports-youth lost ${key}, so parity cannot be checked`).toBeTruthy();
      expect(health[key], `health-wellness is missing ${key}`).toBeTruthy();
    }
  });

  it('fills the helps grid rather than half of it', () => {
    // The grid draws one card per entry. Three cards in a five-column layout
    // reads as a page that failed to load, not as a shorter list.
    expect(health.helps!.length).toBe(sports.helps!.length);
  });

  it('gives every helps card a distinct glyph', () => {
    // The whole reason HelpGlyph exists: five identical shapes tell a visitor
    // nothing about which card is which, leaving colour to do work colour
    // cannot do alone (and cannot do at all for a reader who does not see it).
    const icons = health.helps!.map((h) => h.icon);
    expect(icons.every(Boolean), 'a helps card has no icon').toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('says what a gift buys without stating a number it has not measured', () => {
    // Editorial copy is allowed here; a fabricated COUNT is not. This is the
    // standing rule on this page, and the helps grid is the easiest place to
    // break it by writing "helps 500 patients".
    for (const h of health.helps!) {
      expect(h.body.length, `${h.title} body is too short to be useful`).toBeGreaterThan(40);
      expect(
        /\d[\d,.]*\s*(\+|k\b|m\b|patients|families|people|treatments)/i.test(h.body),
        `${h.title} states an unmeasured figure`,
      ).toBe(false);
    }
  });

  it('does not reuse another cause\'s closing copy', () => {
    const others = CAUSES.filter((c) => c.slug !== 'health-wellness' && c.ctaTitle);
    for (const o of others) {
      expect(health.ctaTitle, `shares a closing heading with ${o.slug}`).not.toBe(o.ctaTitle);
      expect(health.ctaBlurb, `shares closing copy with ${o.slug}`).not.toBe(o.ctaBlurb);
    }
  });
});

describe('every glyph a cause names is actually drawable and coloured', () => {
  // Both halves of this caught a real omission while it was being written: an
  // icon added to the union renders as a blank badge until it is drawn, and as
  // an UNSTYLED badge until it has a colour rule. Neither fails typecheck, and
  // neither is visible in a diff.
  const used = new Set<HelpIcon>();
  for (const c of CAUSES) {
    for (const h of c.helps ?? []) if (h.icon) used.add(h.icon);
    for (const p of c.programs ?? []) used.add(p.icon);
  }

  it('names at least the glyphs the two reference causes use', () => {
    // Guards the guard: an empty `used` set would make both loops below pass
    // vacuously.
    expect(used.size).toBeGreaterThanOrEqual(8);
  });

  it('draws each one', () => {
    for (const icon of used) {
      expect(glyphs, `HelpGlyph has no path for "${icon}"`).toContain(`${icon}:`);
    }
  });

  it('gives each one a badge colour on the helps grid', () => {
    for (const icon of used) {
      expect(css, `.cl-helps-ic--${icon} has no colour rule`).toContain(`.cl-helps-ic--${icon}`);
    }
  });

  it('gives each hero-card glyph a colour too', () => {
    const inPrograms = new Set(CAUSES.flatMap((c) => (c.programs ?? []).map((p) => p.icon)));
    for (const icon of inPrograms) {
      expect(css, `.cl-programs-ic--${icon} has no colour rule`).toContain(`.cl-programs-ic--${icon}`);
    }
  });
});
