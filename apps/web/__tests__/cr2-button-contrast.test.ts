import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'app', 'globals.css'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The two builder buttons that carry a WHITE label on a GRADIENT.
//
// Both shipped failing WCAG AA and stayed that way for over two weeks:
//   .cr2-ai-banner-btn  "✨ Write with AI"  white on #0ea5e9 → 2.77:1
//   .cr2-strengthen-btn "Enhance"           white on #f59e0b → 2.15:1
//
// ⚠️ A GRADIENT MUST BE SCORED AT ITS WORST STOP, not its average. A label is
// unreadable wherever the gradient is lightest — averaging hides exactly the
// region that fails. `audit:signed-in --strict-gradients` does this correctly,
// and it is what caught these. But that audit only runs inside a ~6-minute CI
// step at the end of a ~60-minute job, which is late enough that a red result
// gets waved through. The same arithmetic is checkable from the stylesheet in
// milliseconds, so it is checked here too.
//
// Amber is the specific trap worth naming: at full saturation it looks solid
// and confident while being one of the lightest hues there is. #f59e0b reads as
// a strong button and is 2.15:1 — barely half the required ratio.
// ─────────────────────────────────────────────────────────────────────────────

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Every `#rrggbb` inside the rule's `background:` gradient. */
function gradientStops(selector: string): string[] {
  const rule = css.split(`\n${selector} {`)[1];
  expect(rule, `${selector} not found — was it renamed?`).toBeDefined();
  const decl = rule!.slice(0, rule!.indexOf('}'));
  const bg = /background:\s*([^;]+);/.exec(decl);
  expect(bg, `${selector} has no background declaration`).not.toBeNull();
  return [...bg![1]!.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
}

const WHITE = '#ffffff';
const AA = 4.5; // 13px/650 is not "large text", so the 3:1 exception does not apply.

describe('white-on-gradient builder buttons meet AA at every stop', () => {
  // `.cr2-ai-hero-cta` is included although it was already compliant: it is the
  // same white-on-gradient shape with the same palette, so it is one careless
  // colour edit away from the identical bug. Pinning only the rules that have
  // already broken is how the next one gets missed.
  it.each([['.cr2-ai-hero-cta'], ['.cr2-ai-banner-btn'], ['.cr2-strengthen-btn']])(
    '%s',
    (selector) => {
      const stops = gradientStops(selector);
      // Guards the guard: a rule whose gradient stopped being a gradient, or
      // whose colours moved into a variable, would otherwise pass vacuously.
      expect(stops.length, `${selector} should have at least two gradient stops`).toBeGreaterThanOrEqual(2);
      for (const stop of stops) {
        expect(
          contrast(WHITE, stop),
          `${selector}: white on ${stop} is ${contrast(WHITE, stop).toFixed(2)}:1, under AA ${AA}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    },
  );

  it('scores the WORST stop, because an average overstates a gradient', () => {
    // ⚠️ The first version of this test asserted that the old ai-banner
    // gradient's AVERAGE passed AA while its worst stop failed. That was wrong
    // and this test caught it: the mean of 5.85 and 2.77 is 4.31, which is
    // itself under 4.5. Averaging would have failed this one too.
    //
    // The real, checkable point is narrower and still worth pinning: an average
    // reports a number materially better than what a reader actually gets at
    // the light end, so it understates how bad the failure is and invites
    // "close enough" fixes that leave the light end unreadable.
    const oldBanner = ['#6c35ff', '#0ea5e9'];
    const worst = Math.min(...oldBanner.map((s) => contrast(WHITE, s)));
    const mean = oldBanner.reduce((n, s) => n + contrast(WHITE, s), 0) / oldBanner.length;

    expect(worst).toBeCloseTo(2.77, 1);
    expect(mean).toBeCloseTo(4.31, 1);
    expect(mean, 'the average flatters the gradient by ~1.5x').toBeGreaterThan(worst * 1.4);

    // And the case where averaging genuinely hides a failure — a light stop
    // paired with a very dark one, which is a shape this codebase could easily
    // introduce next.
    const hidden = ['#000000', '#f59e0b']; // 21:1 and 2.15:1
    const hiddenMean = hidden.reduce((n, s) => n + contrast(WHITE, s), 0) / hidden.length;
    expect(Math.min(...hidden.map((s) => contrast(WHITE, s)))).toBeLessThan(AA);
    expect(hiddenMean, 'averaging would call this comfortably compliant').toBeGreaterThan(AA);
  });

  it('computes a ratio the same way the audit does', () => {
    // Anchors the maths against values checked by hand, so a bug in `contrast`
    // cannot quietly make every assertion above pass.
    expect(contrast(WHITE, '#0ea5e9')).toBeCloseTo(2.77, 1);
    expect(contrast(WHITE, '#f59e0b')).toBeCloseTo(2.15, 1);
    expect(contrast(WHITE, '#000000')).toBeCloseTo(21, 0);
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5);
  });
});
