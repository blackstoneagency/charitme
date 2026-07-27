import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Theme regression guard.
//
// The dashboard was swept free of hardcoded light-palette colors so it renders
// correctly in dark AND light mode (design tokens instead of literals). This
// test fails if a component reintroduces the definitive dark-mode bugs:
//   • a hardcoded white/near-white BACKGROUND (light card in dark mode), or
//   • a hardcoded dark TEXT color (dark-text-on-dark in dark mode).
// Intentional literals (white button TEXT, gradient stops, brand/chart accents,
// amber/orange status) are allowed — only surfaces and dark text are policed.
// ─────────────────────────────────────────────────────────────────────────────

// User-facing app areas that must render correctly in dark AND light mode.
// (Admin console is intentional light-only internal tooling; branded marketing
// pages keep their brand palettes — both are out of scope for this guard.)
// Public dynamic [slug]/[id] routes are included too: they are Supabase-backed,
// so they cannot be browser-audited from the sandbox (no DB) — this static guard
// is the regression protection they'd otherwise lack.
// Previously an explicit list of 12 directories, which left ~25 other user-facing
// areas unguarded — `create` (the campaign wizard) and `features` had both drifted
// back to hardcoded light-mode values without failing anything. The guard now walks
// EVERY directory under app/ and excludes only what is deliberately out of scope,
// so a new page is covered the moment it exists rather than when someone remembers
// to add it here.
const EXCLUDED_DIRS = new Set([
  'api',    // route handlers render no UI
  'admin',  // intentionally light-only internal tooling (documented decision)
]);

const APP_DIR = join(__dirname, '..', 'app');
const GUARDED_DIRS = readdirSync(APP_DIR)
  .filter((entry) => !EXCLUDED_DIRS.has(entry))
  .map((entry) => join(APP_DIR, entry))
  .filter((p) => {
    try { return statSync(p).isDirectory(); } catch { return false; }
  });

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// Hardcoded white/near-white used as a BACKGROUND (light surface in dark mode).
// Previously an ENUMERATION of six near-white hexes. That is whack-a-mole: every
// fix appends one more literal, so the next unseen shade sails through — which is
// exactly what happened. `#fafafa` (a competitor card on /features) and `#f9f7ff`
// (the donate breakdown card) were both invisible to this guard, and the runtime
// contrast sweep had to find them instead. Measure LUMINANCE instead of matching
// a list, so any near-white surface is caught the first time it appears.
const NEAR_WHITE_LUMINANCE = 0.75;

function hexLuminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** True when the line sets a background to a literal near-white colour. */
function hasNearWhiteBackground(line: string): boolean {
  for (const m of line.matchAll(/background(?:Color)?:\s*['"](#[0-9a-fA-F]{3,6})['"]/g)) {
    if (hexLuminance(m[1]) > NEAR_WHITE_LUMINANCE) return true;
  }
  return false;
}

const HARDCODED_BG_WHITE = /background:\s*['"]#(?:fff|ffffff|fefefe|fdfdff|fbfaff|f8f7ff)['"]/i;

// Hardcoded dark ink used as a text color (dark-on-dark in dark mode).
const HARDCODED_DARK_TEXT = /color:\s*['"]#(?:1a1a2e|0f1238|0f172a|101944|0f0f30|26335c|334064|334155|27305d)['"]/i;

// A line with this marker is a deliberate exception (e.g. a white toggle knob).
const ALLOW = /theme-keep/;

// Return the dashboard-relative locations where `re` matches a non-allowlisted line.
function offendingLines(files: string[], re: RegExp | ((line: string) => boolean)): string[] {
  const match = typeof re === 'function' ? re : (line: string) => re.test(line);
  const hits: string[] = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (match(line) && !ALLOW.test(line)) {
        const idx = f.indexOf(`app${sep}`);
        hits.push(`${idx >= 0 ? f.slice(idx) : f}:${i + 1}`);
      }
    });
  }
  return hits;
}

describe('user-facing theme tokens (dark-mode regression guard)', () => {
  const files = GUARDED_DIRS.flatMap(walk);

  it('finds user-facing component files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('no component uses a hardcoded white background (use var(--s1)/--s2)', () => {
    const offenders = offendingLines(files, hasNearWhiteBackground);
    expect(offenders, `Near-white hardcoded background — replace with a surface token, a translucent tint, or mark /* theme-keep */ if intentional:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no component uses a hardcoded dark text color (use var(--t1)/--t2)', () => {
    const offenders = offendingLines(files, HARDCODED_DARK_TEXT);
    expect(offenders, `Hardcoded dark text — replace with a text token:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --violet-ink is the adaptive violet-text token introduced to fix WCAG AA
// contrast on public pages: it must stay AA on light surfaces AND flip to a
// light violet on dark surfaces. Several fixes (/features, /supported-countries,
// /transparency labels) rely on it being defined in BOTH themes — if either
// definition is dropped, those pages silently regress to failing contrast.
// ─────────────────────────────────────────────────────────────────────────────
describe('--violet-ink adaptive token', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

  it('is defined in the light (:root) palette', () => {
    // A --violet-ink declaration that appears before the dark-theme block.
    const darkIdx = css.indexOf('[data-theme="dark"]');
    const lightScope = darkIdx > 0 ? css.slice(0, darkIdx) : css;
    expect(/--violet-ink:\s*#[0-9a-fA-F]{3,8}/.test(lightScope), 'globals.css :root must define --violet-ink (light value)').toBe(true);
  });

  it('is overridden in the dark palette', () => {
    // At least two declarations total (light + dark override).
    const count = (css.match(/--violet-ink:\s*#[0-9a-fA-F]{3,8}/g) || []).length;
    expect(count, 'globals.css must define --violet-ink in both :root and [data-theme="dark"]').toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin is excluded from the guard above as "intentionally light-only". That is
// only safe while it is CONSISTENTLY light: nothing scopes admin out of the
// theme (there is no data-theme override in app/admin/layout.tsx or the shell),
// so `<html data-theme="dark">` applies there too. A file that mixes the modes —
// an adaptive text token inside a hardcoded-light container — renders near-white
// on white. app/admin/setup/page.tsx did exactly that and measured ~1.1:1, i.e.
// invisible, on the health-check page an operator opens when something is wrong.
//
// The naive version of this check ("file has #fff AND has var(--t…)") was
// rejected: it false-positived on 2 of its 4 hits, because the `#fff` in
// super/settings and super/flags is a 20x20 TOGGLE KNOB, not a text container.
// A guard that is wrong half the time gets ignored. The discriminator below is
// what separates them, and it is exact on all four known cases: card-like
// containers carry padding/borderRadius and no fixed `width:`; knobs carry
// `width: 20, height: 20`.
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_DIR = join(APP_DIR, 'admin');

/** A bare light background on something container-shaped (not a small decoration). */
function isLightContainerBackground(line: string): boolean {
  if (!/background:\s*['"]#(?:fff|ffffff)['"]/i.test(line)) return false;
  // Fixed pixel width => a knob/dot/decoration, not a surface that wraps text.
  if (/\bwidth:\s*\d+\b/.test(line)) return false;
  return true;
}

describe('admin stays consistently light (no mixed-mode invisible text)', () => {
  const adminFiles = walk(ADMIN_DIR);

  it('finds admin files to check', () => {
    expect(adminFiles.length).toBeGreaterThan(10);
  });

  it('no admin file pairs a hardcoded-light container with adaptive text tokens', () => {
    const offenders: string[] = [];
    for (const file of adminFiles) {
      const src = readFileSync(file, 'utf8');
      if (ALLOW.test(src)) continue;
      const hasAdaptiveText = /color:\s*['"]var\(--t[1-4]\)/.test(src);
      if (!hasAdaptiveText) continue; // consistently hardcoded — fine, stays light
      const bad = src
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => isLightContainerBackground(line));
      for (const { i } of bad) {
        offenders.push(`${file.split(`${sep}app${sep}`)[1]}:${i + 1}`);
      }
    }
    expect(
      offenders,
      'Admin file mixes a hardcoded-light container with adaptive var(--t…) text. ' +
        'In dark mode the text flips to near-white and the container does not, so the ' +
        'content becomes invisible. Either make the container adaptive (var(--s1, #fff)) ' +
        'or pin the text to the light palette so the page stays consistently light:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
