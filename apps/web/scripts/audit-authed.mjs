// Browser audit of the AUTH-GATED surface (dashboard + donor + profile + create)
// — axe WCAG 2.0/2.1 A/AA plus horizontal-overflow at 390px, in BOTH themes.
//
// Why this exists: every browser sweep in this repo covers PUBLIC routes only,
// because the authenticated pages 307 to /login without a session. So the whole
// logged-in surface — the product's primary screens — had never been audited by
// anything but the static theme-token guard.
//
// ⚠️ RUNNING THIS NEEDS A LOGIN, AND THERE IS NO SAFE ONE YET.
// The 120 seeded users deliberately have no password, so obtaining a session
// means writing to PRODUCTION auth (1,133 real profiles). That is an owner
// decision — see "Authorise ONE throwaway QA login" in todo.md. Do not create an
// account here on your own initiative; point the script at a staging project, or
// get the owner's go-ahead first and delete the account afterwards.
//
// Strictly read-only: navigates and measures, never submits a form.
//
// Usage:
//   AUDIT_EMAIL=… AUDIT_PASSWORD=… BASE=http://localhost:4123 \
//     node scripts/audit-authed.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = process.env.BASE || 'http://localhost:4123';
const OUT = process.env.OUT || 'authed-audit.json';
// Credentials come from the environment, never from a file in the repo.
const email = process.env.AUDIT_EMAIL;
const pw = process.env.AUDIT_PASSWORD;
if (!email || !pw) {
  console.error('Set AUDIT_EMAIL and AUDIT_PASSWORD to a throwaway account. See the header comment.');
  process.exit(2);
}
// axe-core hoists to the workspace root in this monorepo.
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// The single source of truth is e2e/public-routes.json — the same file the
// public sweeps read, under its `authGated` key. Hardcoding a second copy here
// is what route-list-single-source.test.ts exists to prevent, and it caught
// exactly that on the first draft of this script.
const ROUTES = JSON.parse(
  readFileSync(new URL('../e2e/public-routes.json', import.meta.url), 'utf8'),
).authGated.routes;

const VIEWPORTS = [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const THEMES = ['light', 'dark'];


// ─────────────────────────────────────────────────────────────────────────────
// Establish the session WITHOUT driving the login form.
//
// The sandbox's browser cannot reach Supabase directly (the agent proxy resets
// external connections from Chromium, though node's fetch gets through), so
// `signInWithPassword` from the page always fails with "Failed to fetch". The
// session is therefore minted here in node and injected as the cookie that
// @supabase/ssr would have written. The Next server reads it exactly the same
// way — it is the same session, just obtained over a route that works here.
// ─────────────────────────────────────────────────────────────────────────────
async function authCookies() {
  const envPath = new URL('../.env.local', import.meta.url);
  const raw = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const fromFile = (k) => (raw.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fromFile('NEXT_PUBLIC_SUPABASE_URL');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fromFile('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  });
  if (!res.ok) throw new Error('token grant failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const session = await res.json();

  const ref = new URL(url).hostname.split('.')[0];
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
  const host = new URL(BASE).hostname;
  // @supabase/ssr chunks the cookie at ~3180 chars into `<name>.0`, `<name>.1`, …
  const CHUNK = 3180;
  const base = { domain: host, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' };
  if (value.length <= CHUNK) return [{ name: `sb-${ref}-auth-token`, value, ...base }];
  const out = [];
  for (let i = 0; i * CHUNK < value.length; i++) {
    out.push({ name: `sb-${ref}-auth-token.${i}`, value: value.slice(i * CHUNK, (i + 1) * CHUNK), ...base });
  }
  return out;
}

const results = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[1] });
  // Seed the theme BEFORE any script runs — the app's inline theme script reads
  // localStorage on boot and overwrites anything set afterwards.
  await ctx.addInitScript(`try{localStorage.setItem('charitme-theme-v2', ${JSON.stringify(theme)})}catch(e){}`);
  await ctx.addCookies(await authCookies());
  const page = await ctx.newPage();

  const probe = await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  const landed = new URL(page.url()).pathname;
  console.log(`[${theme}] session -> ${landed} (${probe?.status()})`);
  if (landed.startsWith('/login')) {
    console.log(`[${theme}] SESSION NOT ACCEPTED — cookie format or token rejected`);
    await ctx.close();
    continue;
  }

  for (const route of ROUTES) {
    const row = { theme, route };
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      row.status = resp?.status();
      row.finalPath = new URL(page.url()).pathname;
      await page.waitForTimeout(1200);

      // Redirected back to login => the route is not actually reachable for this role.
      if (row.finalPath.startsWith('/login')) { row.note = 'redirected to login'; results.push(row); continue; }

      await page.addScriptTag({ content: AXE });
      const axeRes = await page.evaluate(async () => await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      }));
      row.violations = axeRes.violations.map((v) => ({
        id: v.id, impact: v.impact, n: v.nodes.length,
        nodes: v.nodes.slice(0, 25).map((n) => ({
          target: n.target.join(' ').slice(0, 160),
          why: n.failureSummary?.split('\n').slice(1).join(' ').slice(0, 220),
          html: n.html?.slice(0, 160),
        })),
      }));

      // Horizontal overflow at phone width.
      await page.setViewportSize(VIEWPORTS[0]);
      await page.waitForTimeout(500);
      row.overflow = await page.evaluate(() => {
        const d = document.documentElement;
        const over = d.scrollWidth - d.clientWidth;
        if (over <= 1) return null;
        const culprits = [...document.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1)
          .slice(0, 4)
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')}`);
        return { px: over, scrollWidth: d.scrollWidth, culprits };
      });
      await page.setViewportSize(VIEWPORTS[1]);
    } catch (e) {
      row.error = String(e).split('\n')[0].slice(0, 160);
    }
    results.push(row);
    const v = row.violations?.length ?? 0;
    console.log(`[${theme}] ${route} ${row.status ?? '-'} ${row.finalPath !== route ? '->' + row.finalPath : ''} axe:${v} overflow:${row.overflow ? row.overflow.px + 'px' : 'ok'} ${row.error || row.note || ''}`);
  }
  await ctx.close();
}

await browser.close();
writeFileSync(OUT, JSON.stringify(results, null, 2));

console.log('\n===== SUMMARY =====');
const byId = new Map();
for (const r of results) for (const v of r.violations ?? []) {
  const k = `${v.id}`;
  byId.set(k, (byId.get(k) ?? []).concat(`${r.theme}${r.route}(${v.n})`));
}
for (const [id, hits] of [...byId].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${id}: ${hits.length} page-renders -> ${hits.slice(0, 6).join(', ')}${hits.length > 6 ? ' …' : ''}`);
}
console.log('\noverflow:', results.filter((r) => r.overflow).map((r) => `${r.theme}${r.route} +${r.overflow.px}px ${r.overflow.culprits.join(',')}`).join('\n         ') || 'none');
console.log('\nerrors:', results.filter((r) => r.error).map((r) => `${r.theme}${r.route} ${r.error}`).join('\n        ') || 'none');
console.log('\nredirected:', results.filter((r) => r.note).map((r) => `${r.theme}${r.route}`).join(', ') || 'none');
