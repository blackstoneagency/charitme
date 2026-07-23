import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
const GUARDED_DIRS = ['dashboard', 'donor', 'profile'].map((d) => join(__dirname, '..', 'app', d));

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
const HARDCODED_BG_WHITE = /background:\s*['"]#(?:fff|ffffff|fefefe|fdfdff|fbfaff|f8f7ff)['"]/i;

// Hardcoded dark ink used as a text color (dark-on-dark in dark mode).
const HARDCODED_DARK_TEXT = /color:\s*['"]#(?:1a1a2e|0f1238|0f172a|101944|0f0f30|26335c|334064|334155|27305d)['"]/i;

// A line with this marker is a deliberate exception (e.g. a white toggle knob).
const ALLOW = /theme-keep/;

// Return the dashboard-relative locations where `re` matches a non-allowlisted line.
function offendingLines(files: string[], re: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (re.test(line) && !ALLOW.test(line)) {
        const idx = f.indexOf(`app${require('node:path').sep}`);
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
    const offenders = offendingLines(files, HARDCODED_BG_WHITE);
    expect(offenders, `Hardcoded white background — replace with a surface token (or mark /* theme-keep */ if intentional):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no component uses a hardcoded dark text color (use var(--t1)/--t2)', () => {
    const offenders = offendingLines(files, HARDCODED_DARK_TEXT);
    expect(offenders, `Hardcoded dark text — replace with a text token:\n${offenders.join('\n')}`).toEqual([]);
  });
});
