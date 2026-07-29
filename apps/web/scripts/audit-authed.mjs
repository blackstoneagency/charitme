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
import { resolveBase } from './lib/audit-base.mjs';

// AUDIT_BASE_URL stays as a fallback for CI, but argv parsing is shared so this
// agrees with every sibling audit on what `--base` and a positional URL mean.
const BASE = resolveBase(process.argv, process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000');
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

// Mints a real session with the same password grant the login form uses, then
// writes it as the @supabase/ssr cookie. Returns false when the env has no
// Supabase config, so the caller falls through to the hard exit(3) rather than
// pretending it signed in.
async function injectSession(ctx) {
  const envFile = new URL('../.env.local', import.meta.url);
  const env = {};
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supaUrl || !anon) return false;

  // node's fetch ignores HTTPS_PROXY; without this the grant 401s/hangs in a
  // proxied sandbox and the fallback looks like bad credentials.
  if (process.env.HTTPS_PROXY) {
    try {
      const { ProxyAgent, setGlobalDispatcher } = await import('undici');
      setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
    } catch { /* undici unavailable — direct fetch may still work */ }
  }

  const res = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) return false;
  const s = await res.json();

  const session = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: s.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + s.expires_in,
    token_type: s.token_type,
    user: s.user,
  };
  const ref = new URL(supaUrl).hostname.split('.')[0];
  const raw = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  const CHUNK = 3180; // @supabase/ssr splits above this and reassembles by .N suffix
  const name = `sb-${ref}-auth-token`;
  const parts =
    raw.length <= CHUNK
      ? [{ name, value: raw }]
      : Array.from({ length: Math.ceil(raw.length / CHUNK) }, (_, i) => ({
          name: `${name}.${i}`,
          value: raw.slice(i * CHUNK, (i + 1) * CHUNK),
        }));

  const { hostname, protocol } = new URL(BASE);
  await ctx.addCookies(
    parts.map((c) => ({
      ...c, domain: hostname, path: '/', httpOnly: false,
      secure: protocol === 'https:', sameSite: 'Lax',
    })),
  );
  return true;
}

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
    // Preferred path: drive the real login form, so the sweep exercises what a
    // user exercises. The form calls Supabase from the BROWSER, which needs
    // browser→auth-host egress.
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('button.auth-submit').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !new URL(u).pathname.startsWith('/login'), { timeout: 30_000 }).catch(() => {}),
      page.locator('button.auth-submit').click(),
    ]);

    // Fallback: some sandboxes (this one) allow node→Supabase but NOT
    // browser→Supabase, so the form dies on `Failed to fetch` with zero token
    // calls and nothing gets audited. The session is still real — it is minted
    // by the same password grant the form would have used — and injected as the
    // @supabase/ssr cookie the server already trusts. This audits the
    // SERVER-RENDERED surface, which is the whole point of the sweep.
    //
    // It is a fallback and never the default: when browser egress works, the
    // form path proves login itself works. The chosen path is printed, because
    // a sweep that quietly changed how it authenticated would be reporting on
    // something other than what the reader thinks.
    let usedFallback = false;
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (new URL(page.url()).pathname.startsWith('/login')) {
      const injected = await injectSession(ctx).catch((e) => {
        console.error(`  session injection failed: ${String(e).slice(0, 160)}`);
        return false;
      });
      usedFallback = injected;
    }

    // Prove the login worked before measuring anything. Without this the sweep
    // would audit the login page N times and report it as a clean dashboard.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (new URL(page.url()).pathname.startsWith('/login')) {
      console.error(`✗ Sign-in failed for ${EMAIL} — /dashboard still redirects to /login.`);
      console.error('  Nothing was audited. Check the credentials, or that the account is confirmed.');
      await browser.close();
      process.exit(3);
    }
    console.log(
      `· signed in as ${EMAIL} (${theme})${usedFallback ? ' [via injected session — browser→auth egress blocked]' : ' [via login form]'}`,
    );

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
