import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const page = read('app/page.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// The homepage hero must offer a direct way to give.
//
// ⚠️ It did not. The hero's two actions were "Explore Causes" — an in-page
// anchor to #causes — and "See Our Impact". A visitor who landed ready to
// donate had no path to do so from the top of the page, on a fundraising
// platform. The nearest Donate Now was ~240 lines further down the document.
//
// The hero now serves BOTH visitors: two donor actions and one for the person
// who came to raise money. "See Our Impact" was replaced by "Create Campaign",
// which is what the third slot is asserted to be below.
//
// This is invisible to every audit in this repo: the links resolved, contrast
// passed, axe passed, focus order passed. A missing call to action is not a
// defect any of them look for.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The hero's action row with JSX comments removed.
 *
 * The comments matter: they explain what each action replaced, so they NAME the
 * old labels. A "this string is absent" assertion run against the raw slice
 * therefore fails on correct code — and would pass on code that shipped the
 * label after someone deleted the comment. Twice in one day, so it is written
 * down here rather than rediscovered a third time.
 */
function heroActionsCode(): string {
  return heroActions().replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

/** The hero's action row, up to the closing div. */
function heroActions(): string {
  const at = page.indexOf('<div className="mirror-actions">');
  expect(at, 'hero action row not found').toBeGreaterThan(-1);
  return page.slice(at, page.indexOf('</div>', at));
}

describe('the homepage hero offers a way to give', () => {
  it('has a Donate Now action', () => {
    expect(heroActions()).toMatch(/>\s*Donate Now/);
  });

  it('points it at /campaigns', () => {
    // Not `#causes` and not `/donate`. A donation is always to a specific
    // campaign, so /campaigns is where a donor picks one — there is no single
    // donate endpoint to send them to.
    const donate = /<Link href="([^"]+)"[^>]*>\s*Donate Now/.exec(heroActions());
    expect(donate, 'Donate Now is not a Link').not.toBeNull();
    expect(donate![1]).toBe('/campaigns');
  });

  it('gives it the primary treatment, not a buried tertiary link', () => {
    // A donate CTA styled as the least prominent thing in the row is the same
    // defect wearing different clothes.
    expect(heroActions()).toMatch(/mirror-btn-primary[^>]*>\s*Donate Now/);
  });
});

describe('the hero also serves the visitor who came to RAISE money', () => {
  it('has a Create Campaign action', () => {
    // Two of the three hero actions serve donors. Without this one, a
    // fundraiser has no entry point at the top of the homepage at all.
    expect(heroActions()).toMatch(/>\s*Create Campaign/);
  });

  it('sends it to the path chooser, not straight into one builder', () => {
    // /create/choose-path offers the AI-guided build AND the manual wizard.
    // Linking either one directly makes that choice on the visitor's behalf.
    const create = /<Link href="([^"]+)"[^>]*>\s*Create Campaign/.exec(heroActions());
    expect(create, 'Create Campaign is not a Link').not.toBeNull();
    expect(create![1]).toBe('/create/choose-path');
  });

  it('does not leave a second Impact link in the row it replaced', () => {
    expect(heroActionsCode()).not.toMatch(/See Our Impact/);
  });

  it('gets its own purple treatment, not the plain secondary style', () => {
    expect(heroActions()).toMatch(/mirror-btn-create[^>]*>\s*Create Campaign/);
  });

  it('does not reuse the brand ramp that belongs to Donate Now', () => {
    // The two sit side by side. Sharing a background makes the hero look like
    // it is showing the same button twice.
    const css = read('app/globals.css');
    const rule = css.slice(css.indexOf('.mirror-btn-create {'));
    expect(rule.slice(0, rule.indexOf('}'))).not.toContain('--grad-brand');
  });
});

describe('the Create Campaign button stays readable and accessible', () => {
  const css = read('app/globals.css');

  it('every gradient stop clears 4.5:1 against its white label', () => {
    // The label is 14px at weight 850 — NOT WCAG "large text" (18.66px bold),
    // so 3:1 is not enough. The livelier violets all fail this, which is why
    // the ramp is dark: #8b5cf6 is 4.23, #a855f7 is 3.96, #6366f1 is 4.47.
    const ramp = /--grad-create:\s*linear-gradient\([^)]*\)/.exec(css)?.[0] ?? '';
    const stops = ramp.match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(stops.length, 'no gradient stops found').toBeGreaterThan(1);

    const lum = (hex: string) => {
      const n = hex.replace('#', '');
      const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(ch[0]!) + 0.7152 * f(ch[1]!) + 0.0722 * f(ch[2]!);
    };
    for (const stop of stops) {
      const ratio = (1 + 0.05) / (lum(stop) + 0.05);
      expect(ratio, `${stop} is ${ratio.toFixed(2)}:1 against white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('drops the sheen for people who asked for reduced motion', () => {
    // A sweeping highlight is exactly what that setting asks not to be shown.
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm.slice(0, rm.indexOf('\n}'))).toMatch(/\.mirror-btn-create[^{]*\{[^}]*animation: none/);
  });

  it('cannot let the sheen swallow its own click', () => {
    const rule = css.slice(css.indexOf('.mirror-btn-create::after'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('pointer-events: none');
  });
});

describe('removing the Impact button did not orphan /impact', () => {
  it('keeps it reachable from the shared navigation', () => {
    // The rule this guards: a page whose only inbound link is deleted becomes
    // unreachable without anything failing. /impact has five other routes in.
    expect(read('lib/main-nav.ts'), 'main nav lost /impact').toContain("href: '/impact'");
    expect(read('lib/footer-nav.ts'), 'footer lost /impact').toContain("href: '/impact'");
  });
});
