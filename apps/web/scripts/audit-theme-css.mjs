#!/usr/bin/env node
/**
 * Finds CSS rules that pin a LIGHT background while using an ADAPTIVE text
 * token — the mixed-mode bug, at its actual source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * `__tests__/theme-tokens.test.ts` already guards this shape, but only in `.tsx`
 * inline styles. It never reads globals.css. So a rule like
 *
 *     .cr2-field input { color: var(--t1); background: #fff; }
 *
 * sails through — and in dark mode `--t1` is `#e2e8f8`, a near-white, on a white
 * surface. The signed-in contrast sweep measured 18 such instances across 17
 * routes at roughly 1.2:1, i.e. unreadable, while the guard reported clean.
 *
 * The guard was trusted to cover this. It did not, because the bug lives in the
 * stylesheet rather than in a component.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SCRIPT AND NOT A TEST — READ BEFORE "PROMOTING" IT
 *
 * There are 15 pre-existing violations. Adding a failing test today means either
 * breaking the build for everyone or shipping a baseline of allowed exceptions —
 * and this repo has repeatedly recorded that a baselined guard is how a real
 * regression gets waved through. So it reports, and the moment the 15 are fixed
 * this should become an assertion in theme-tokens.test.ts with NO exception list.
 *
 * Usage: node scripts/audit-theme-css.mjs [--ci]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'app',
  'globals.css',
);
const css = readFileSync(CSS_PATH, 'utf8');

// A background light enough that near-white dark-mode ink disappears on it.
const LIGHT_BG =
  /background(?:-color)?:\s*(#fff\b|#ffffff\b|white\b|#f[0-9a-f]{2}[0-9a-f]{3}\b|#fa[0-9a-f]{4}\b)/i;

// Text tokens that FLIP between themes. --t3/--t4 are muted and flip too, but
// they are deliberately mid-tone and do not vanish, so they are not the
// invisible-text class this hunts.
const ADAPTIVE_TEXT = /color:\s*var\(--(t1|t2|ink)\b/;

// What each token becomes under [data-theme="dark"] — quoted so the report says
// what the text ACTUALLY turns into, rather than naming one token for all three.
const DARK_VALUE = { t1: '#e2e8f8', t2: '#b8c2de', ink: '#e2e8f8' };

// A rule that already scopes itself to a theme is doing the right thing.
const THEME_SCOPED = /\[data-theme/;

const findings = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().split('\n').pop().trim();
  const body = m[2];
  if (THEME_SCOPED.test(selector)) continue;
  if (!LIGHT_BG.test(body) || !ADAPTIVE_TEXT.test(body)) continue;
  const line = css.slice(0, m.index).split('\n').length;
  const bg = LIGHT_BG.exec(body)[1];
  const token = ADAPTIVE_TEXT.exec(body)[1];
  findings.push({ line, selector, bg, token });
}

console.log(`globals.css rules pinning a light background with adaptive text: ${findings.length}\n`);
for (const f of findings) {
  console.log(`  globals.css:${f.line}  ${f.selector}`);
  console.log(
    `      color: var(--${f.token}) on ${f.bg}  →  in dark mode --${f.token} is ` +
      `${DARK_VALUE[f.token]}, so this renders light-on-light`,
  );
}

if (findings.length) {
  console.log(
    '\nFix by giving the rule a dark variant, or by pinning the text to the light\n' +
      'palette so the rule stays consistently light. Do NOT silence this by\n' +
      'switching the text to --t3: that trades invisible for merely illegible.',
  );
}

if (process.argv.includes('--ci') && findings.length) process.exit(1);
