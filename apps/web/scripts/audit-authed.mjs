#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Accessibility sweep of the SIGNED-IN surface.
//
// Why this exists: `npm run audit:a11y` reports 0 violations across 38 routes,
// and that is true — but it only reaches public pages. Almost every form on this
// platform lives behind auth, and an anonymous crawler gets a redirect to
// /login. "0 axe violations" and "147 unlabelled form controls" were both true
// at the same time. That gap was closed by a static guard
// (__tests__/a11y-form-labels.test.ts); this closes the LIVE half.
//
//   npm run audit:authed -- http://127.0.0.1:3000
//   QA_EMAIL=… QA_PASSWORD=… npm run audit:authed
//
// It needs a real login. There is deliberately no fallback: a sweep that
// silently measures the /login page instead of the dashboard would report a
// clean run having audited nothing, which is the exact failure this whole file
// is written against.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';

const argBase = process.argv.find((a) => a.startsWith('http'));
const BASE = argBase ?? process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.QA_EMAIL ?? '';
const PASSWORD = process.env.QA_PASSWORD ?? '';

const EXECUTABLE = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  chromium.executablePath(),
  process.env.PROGRAMFILES
    ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`
    : null,
  process.env['PROGRAMFILES(X86)']
    ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
    : null,
  process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    : null,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));

// The signed-in surface, read from the shared list rather than duplicated here.
// e2e/authed-routes.json is deliberately separate from public-routes.json: that
// file is the anonymous surface, this one is asserted to redirect when signed
// out, and a single file could not state both properties.
const ROUTES = JSON.parse(
  readFileSync(new URL('../e2e/authed-routes.json', import.meta.url), 'utf8'),
).groups;

if (!EMAIL || !PASSWORD) {
  console.error(
    '✗ QA_EMAIL and QA_PASSWORD are required.\n' +
      '  This sweep audits pages that only exist behind a login, so there is nothing\n' +
      '  it can usefully do without one. It exits 2 rather than sweeping /login and\n' +
      '  reporting a clean run.\n\n' +
      '  Needs one throwaway account. Grant it admin to include the /admin group;\n' +
      '  without admin those routes redirect and are reported as SKIPPED, not clean.',
  );
  process.exit(2);
}

const browser = await chromium.launch({
  ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
  args: ['--no-sandbox'],
});

let total = 0;
let swept = 0;
let skipped = 0;
let errors = 0;
const byRule = new Map();

try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('charitme-theme-v2', t); } catch { /* ignore */ }
    }, theme);
    const page = await ctx.newPage();

    // ── Sign in ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !new URL(u).pathname.startsWith('/login'), { timeout: 30_000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    // Prove the login worked before measuring anything. Without this the sweep
    // would audit the login page N times and report it as a clean dashboard.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (new URL(page.url()).pathname.startsWith('/login')) {
      console.error(`✗ Sign-in failed for ${EMAIL} — /dashboard still redirects to /login.`);
      console.error('  Nothing was audited. Check the credentials, or that the account is confirmed.');
      await browser.close();
      process.exit(3);
    }
    console.log(`· signed in as ${EMAIL} (${theme})`);

    for (const [group, paths] of Object.entries(ROUTES)) {
      for (const path of paths) {
        try {
          const response = await page.goto(BASE + path, {
            waitUntil: 'domcontentloaded',
            timeout: 30_000,
          });
          if (!response || response.status() >= 400) {
            errors++;
            console.log(
              `! ${theme} ${path} [${group}] - HTTP ${response?.status() ?? 'NO_RESPONSE'}`,
            );
            continue;
          }
          await page.waitForLoadState('load', { timeout: 8_000 }).catch(() => {});
          await page.waitForTimeout(400);

          // A redirect means this account cannot see the page. Report it as
          // SKIPPED — counting it clean would overstate the coverage.
          const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
          const asked = path.replace(/\/$/, '') || '/';
          if (landed !== asked) {
            skipped++;
            console.log(`- ${theme} ${path} — SKIPPED (redirected to ${landed}; insufficient role?)`);
            continue;
          }

          const activeTheme = await page.evaluate(
            () => document.documentElement.getAttribute('data-theme'),
          );
          if (activeTheme !== theme) {
            errors++;
            console.log(
              `! ${theme} ${path} [${group}] - theme reverted to "${activeTheme}"`,
            );
            continue;
          }

          const res = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          swept++;
          for (const v of res.violations) {
            total += v.nodes.length;
            byRule.set(v.id, (byRule.get(v.id) ?? 0) + v.nodes.length);
            console.log(`✗ ${theme} ${path} — ${v.id} (${v.impact}) ×${v.nodes.length}`);
          }
        } catch (e) {
          errors++;
          const message = e instanceof Error ? e.message : String(e);
          console.log(`! ${theme} ${path} [${group}] - ERROR ${message.slice(0, 70)}`);
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\nswept ${swept} page loads, skipped ${skipped}, errors ${errors}`);
if (swept === 0) {
  // Zero violations across zero pages is not a pass.
  console.error('✗ Nothing was audited — every route was skipped or errored.');
  process.exit(4);
}
if (errors > 0) {
  console.error(`\u2717 ${errors} page load or theme error(s); the audit is incomplete.`);
  process.exit(5);
}
console.log(
  total === 0
    ? `✅ 0 axe violations across ${swept} signed-in page loads`
    : `\n${total} violation node(s):\n` + [...byRule].map(([k, v]) => `   ${k}: ${v}`).join('\n'),
);
process.exit(total === 0 ? 0 : 1);
