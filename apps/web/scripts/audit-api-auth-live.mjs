#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Audit: does every protected API route actually reject an anonymous caller?
//
// `__tests__/api-auth-coverage.test.ts` proves each handler CONTAINS a guard by
// scanning source. `e2e/auth-gates.spec.ts` proves two endpoints behave. Neither
// proves the other ~156 behave — and "contains a guard" and "denies access" are
// different claims (a guard after the read, a guard on the wrong branch, or a
// redirect instead of a 401 all pass the source scan).
//
// GET only: idempotent, so this is safe to run against a live database.
// A 405 means the route exists but does not take GET — not a finding.
//
//   node scripts/audit-api-auth-live.mjs --base http://127.0.0.1:3101
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBase } from './lib/audit-base.mjs';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = join(WEB_ROOT, 'app', 'api');
const BASE = resolveBase(process.argv);

try {
  const probe = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(10_000) });
  if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
} catch (e) {
  console.error(`✗ Nothing usable on ${BASE} (${e.message}). Start the app or pass --base <url>.`);
  process.exit(2);
}

// Routes that are public BY DESIGN. Anything else must deny an anonymous caller.
const INTENTIONALLY_PUBLIC = new Set([
  '/api/health', '/api/campaigns', '/api/donations', '/api/stripe/webhook',
  '/api/auth/callback', '/api/contact', '/api/support-tickets', '/api/newsletter',
  '/api/platform-modules', '/api/matching/programs', '/api/volunteers/opportunities',
  '/api/sponsorships/opportunities', '/api/grants', '/api/events', '/api/search',
  '/api/campaigns/rotator', '/api/notifications/count', '/api/og', '/api/sitemap',
]);

const routes = [];
(function walk(dir, url) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { walk(p, `${url}/${entry}`); continue; }
    if (entry !== 'route.ts' && entry !== 'route.tsx') continue;
    const src = readFileSync(p, 'utf8');
    if (!/export\s+(async\s+)?function\s+GET/.test(src)) continue;   // GET-only sweep
    // Substitute a syntactically valid, certainly-absent id for dynamic segments.
    const concrete = url.replace(/\[\[?\.{3}?(\w+)\]?\]/g, '00000000-0000-0000-0000-000000000000')
                        .replace(/\[(\w+)\]/g, '00000000-0000-0000-0000-000000000000');
    routes.push({ url, concrete });
  }
})(API_DIR, '/api');

const leaks = [], redirects = [], denied = [], other = [];
for (const r of routes) {
  if (INTENTIONALLY_PUBLIC.has(r.url)) continue;
  try {
    const res = await fetch(BASE + r.concrete, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    const s = res.status;
    if (s === 401 || s === 403) denied.push(r.url);
    else if (s >= 300 && s < 400) redirects.push({ ...r, status: s, to: res.headers.get('location') });
    else if (s === 200) leaks.push({ ...r, status: s });
    else other.push({ ...r, status: s });
  } catch (e) {
    other.push({ ...r, status: `ERR ${e.message.slice(0, 40)}` });
  }
}

console.log(`\nProbed ${routes.length} GET API routes on ${BASE} (${INTENTIONALLY_PUBLIC.size} allow-listed as public).`);
console.log(`  denied 401/403 : ${denied.length}`);
console.log(`  redirected 3xx : ${redirects.length}`);
console.log(`  returned 200   : ${leaks.length}`);
console.log(`  other          : ${other.length}`);

if (redirects.length > 0) {
  console.log('\n⚠ Redirect instead of 401 — a fetch caller gets HTML and res.json() throws:');
  for (const r of redirects) console.log(`  ${r.url} → ${r.status} ${r.to ?? ''}`);
}
if (leaks.length > 0) {
  console.log('\n🔴 200 to an ANONYMOUS caller — verify each is meant to be public:');
  for (const r of leaks) console.log(`  ${r.url}`);
}
if (other.length > 0) {
  console.log('\n· Other (405 = no GET handler, 404 = id not found after auth passed, etc.):');
  for (const r of other.slice(0, 25)) console.log(`  ${String(r.status).padEnd(6)} ${r.url}`);
}
process.exit(leaks.length > 0 ? 1 : 0);
