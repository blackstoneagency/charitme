import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Theme contrast regression guard.
//
// Reads the REAL token values out of app/globals.css (the :root light block and
// the [data-theme="dark"] root block) and asserts that every text tier clears
// WCAG 2.2 AA (4.5:1 for normal text) against every card surface, in both
// themes. This locks in the readability fix so a future token edit can't
// silently reintroduce the low-contrast "faint muted text" defect.
// ─────────────────────────────────────────────────────────────────────────────

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
const adminCampaigns = readFileSync(
  join(__dirname, '../app/admin/campaigns/_components/AdminCampaignsClient.tsx'),
  'utf8',
);
const campaignControls = readFileSync(
  join(__dirname, '../app/dashboard/campaigns/[id]/_components/CampaignControls.tsx'),
  'utf8',
);
const trustSafety = readFileSync(
  join(__dirname, '../app/admin/trust-safety/page.tsx'),
  'utf8',
);

/** Extract `--name: #hex;` declarations from a single CSS block body. */
function parseTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function blockAfter(selectorRegex: RegExp): string {
  const m = css.match(selectorRegex);
  if (!m) throw new Error(`token block not found: ${selectorRegex}`);
  const start = m.index! + m[0].length;
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

// The bare `[data-theme="dark"] {` selector (no descendant) is the dark token
// block; descendant rules like `[data-theme="dark"] .foo {` have a space+class
// before the brace and are excluded by requiring `{` right after whitespace.
const light = parseTokens(blockAfter(/:root\s*\{/));
const dark = parseTokens(blockAfter(/\[data-theme="dark"\]\s*\{/));

function contrast(fg: string, bg: string): number {
  const toRGB = (hex: string) => {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const L1 = lum(toRGB(fg));
  const L2 = lum(toRGB(bg));
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;
const TEXT_TIERS = ['t1', 't2', 't3', 't4', 'muted'] as const;
// Accent colors rendered AS TEXT use dedicated darkened *-text tokens so they
// clear AA on light surfaces without changing the vivid base fills.
const ACCENT_TEXT = ['green-text', 'blue-text', 'red-text', 'orange-text'] as const;
const SURFACES = ['s1', 's2', 's3'] as const;

describe('theme token contrast (WCAG 2.2 AA)', () => {
  it('extracted the token blocks from globals.css', () => {
    // Sanity: both themes define the tiers + surfaces we assert on.
    for (const key of [...TEXT_TIERS, ...ACCENT_TEXT, ...SURFACES]) {
      expect(light[key], `light --${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(dark[key], `dark --${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  for (const [themeName, tokens] of [['light', light], ['dark', dark]] as const) {
    for (const tier of [...TEXT_TIERS, ...ACCENT_TEXT]) {
      for (const surface of SURFACES) {
        it(`${themeName}: --${tier} on --${surface} meets AA`, () => {
          const ratio = contrast(tokens[tier], tokens[surface]);
          expect(
            ratio,
            `--${tier} (${tokens[tier]}) on --${surface} (${tokens[surface]}) = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }

  it('keeps neutral campaign actions legible under white text', () => {
    expect(contrast('#ffffff', light['neutral-btn'])).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(campaignControls.match(/label:\s*'Close Campaign'[^}\r\n]*color:\s*'var\(--neutral-btn\)'/g)).toHaveLength(2);
    expect(campaignControls).not.toMatch(/label:\s*'Close Campaign'[^}\r\n]*color:\s*'var\(--t2\)'/);
  });

  it('uses theme-aware surfaces for the admin carousel badge', () => {
    const carouselBadge = adminCampaigns.split(/\r?\n/).find((line) => line.includes('>🏠 Carousel<'));
    expect(carouselBadge).toContain("background: 'var(--s2)'");
    expect(carouselBadge).toContain("border: '1px solid var(--b1)'");
    expect(carouselBadge).not.toContain("background: '#eff6ff'");
  });

  it('gives completed create steps a readable dark-theme label', () => {
    expect(css).toContain('[data-theme="dark"] .cr2-track-item.done .cr2-track-label { color: var(--violet-ink); }');
  });

  it('keeps campaign-builder AI actions readable over every gradient endpoint', () => {
    for (const background of ['#6d28d9', '#0369a1', '#a16207', '#92400e']) {
      expect(contrast('#ffffff', background), background).toBeGreaterThanOrEqual(AA_NORMAL);
    }
    expect(css).toContain('linear-gradient(135deg, #6d28d9, #0369a1)');
    expect(css).toContain('linear-gradient(135deg, #a16207, #92400e)');
  });

  it('keeps the signed-in identity readable on the always-black global header', () => {
    expect(contrast('#d8dee5', '#000000')).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(css).toContain('.kind-header .kind-user-btn { color: #d8dee5; }');
  });

  it('uses a theme-aware surface for the trust flag resolution action', () => {
    expect(trustSafety).toContain("background: 'var(--green-light)'");
    expect(trustSafety).toContain("border: '1px solid var(--green-dark)'");
    expect(trustSafety).not.toContain("background: '#f0fff4'");
  });
});
