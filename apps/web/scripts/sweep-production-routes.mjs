#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Does production actually answer, with a real database behind it?
//
// Every other audit in `scripts/` drives a browser against a LOCAL build. That
// build has no Supabase credentials, so `supabaseAdmin` is a Proxy that throws
// on property access and every database path degrades identically. A route that
// 500s *only* when a real query runs is invisible to all of them — which is how
// `/causes/mental-health` reached production as a 500 underneath a passing
// audit suite.
//
// This asks production, over plain HTTP, with no credentials:
//
//   npm run sweep:production --workspace=apps/web
//   node scripts/sweep-production-routes.mjs --base https://www.charitme.com
//
// ⚠️ WHAT A PASS DOES AND DOES NOT MEAN.
//
// A 200 means the handler ran and returned. It does NOT mean the page is
// correct, and for a LIST endpoint it does not even mean the data arrived: a
// read that fails into an empty array still renders 200. `--data` additionally
// asserts that the public list endpoints are non-empty, which is the closest
// this can get to "wired" without credentials. Everything else needs a browser
// or a login.
//
// Route sources, in order of how much they can be trusted:
//   · the live sitemap  — what the site itself says is indexable
//   · the cause slugs   — from lib/causes.ts, so a new cause is swept the day
//                         it is added rather than when someone updates a list
//   · a small explicit list of API routes that read the database unauthenticated
//
// Admin routes are swept too, and the expectation is INVERTED: they must NOT
// answer 200 to an anonymous caller. A 200 there is a security finding, not a
// pass, so it is reported as a failure.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Public JSON routes that read the database without authentication. */
export const PUBLIC_API = [
  '/api/health',
  '/api/campaigns',
  '/api/campaigns/rotator',
  '/api/campaigns/stories',
  '/api/announcements',
  '/api/sponsors',
  '/api/grants',
  '/api/leaderboard/campaigns',
  '/api/leaderboard/donors',
  '/api/volunteers/opportunities',
  '/api/platform-modules',
  '/api/status',
];

/**
 * List endpoints whose payload must be non-empty, with the key holding the list.
 * `/api/health` and `/api/platform-modules` are excluded on purpose — neither
 * returns a list of rows.
 */
export const MUST_HAVE_ROWS = {
  '/api/campaigns': 'campaigns',
  '/api/campaigns/rotator': 'campaigns',
  '/api/leaderboard/campaigns': 'campaigns',
  '/api/leaderboard/donors': 'donors',
  '/api/grants': 'grants',
  '/api/volunteers/opportunities': 'opportunities',
};

/** Anonymous callers must never get 200 from these. */
export const MUST_BE_GATED = [
  '/api/admin/audit',
  '/api/admin/ledger',
  '/api/admin/payouts',
  '/api/admin/refunds',
  '/api/admin/settings',
  '/api/admin/reconciliation',
  '/api/admin/marketing/contacts',
  '/api/cron/reconcile-ledger',
];

function parseArg(argv, flag, fallback) {
  const i = argv.indexOf(flag);
  return (i !== -1 && argv[i + 1]) || fallback;
}

/** Cause slugs, read from the source of truth rather than copied. */
export function causeSlugs() {
  const src = readFileSync(join(HERE, '..', 'lib', 'causes.ts'), 'utf8');
  return [...src.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

async function sitemapPaths(base) {
  const res = await fetch(`${base}/sitemap.xml`);
  if (!res.ok) return [];
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(base, '') || '/');
  // One URL per route SHAPE — sweeping 1,300 seeded campaign pages measures the
  // same handler 500 times and takes 20 minutes.
  const seen = new Map();
  for (const p of paths) {
    const shape = p.replace(/\/[a-z0-9-]*\d[a-z0-9-]*$/, '/:id');
    if (!seen.has(shape)) seen.set(shape, p);
  }
  return [...seen.values()];
}

async function head(base, path) {
  try {
    const res = await fetch(base + path, { redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text };
  } catch (err) {
    return { status: 0, text: String(err?.message ?? err) };
  }
}

async function main() {
  const base = parseArg(process.argv, '--base', process.env.SWEEP_BASE || 'https://www.charitme.com');
  const checkData = process.argv.includes('--data');
  console.log(`Sweeping ${base}\n`);

  const failures = [];
  // Deduped BEFORE the count is taken: reporting a total that does not equal
  // ok + failing is how a sweep quietly stops covering something.
  const pages = [...new Set([
    ...(await sitemapPaths(base)),
    ...causeSlugs().map((s) => `/causes/${s}`),
  ])];

  let ok = 0;
  for (const p of pages) {
    const r = await head(base, p);
    if (r.status >= 500 || r.status === 0) failures.push(`${r.status || 'ERR'}  ${p}`);
    else ok++;
  }
  console.log(`pages          ${ok} ok, ${failures.length} failing (${pages.length} route shapes)`);
  if (ok + failures.length !== pages.length) {
    console.log('   ⚠️ counts do not add up — the sweep skipped something');
    failures.push('internal: page counts do not reconcile');
  }

  let apiOk = 0;
  const apiFail = [];
  for (const p of PUBLIC_API) {
    const r = await head(base, p);
    if (r.status !== 200) { apiFail.push(`${r.status}  ${p}`); continue; }
    if (checkData && p in MUST_HAVE_ROWS) {
      let rows = null;
      try { rows = JSON.parse(r.text)?.[MUST_HAVE_ROWS[p]]; } catch { /* reported below */ }
      if (!Array.isArray(rows) || rows.length === 0) {
        // A 200 with an empty list is what a failed read looks like from outside.
        apiFail.push(`EMPTY ${p} — 200 but "${MUST_HAVE_ROWS[p]}" has no rows`);
        continue;
      }
    }
    apiOk++;
  }
  console.log(`public api     ${apiOk} ok, ${apiFail.length} failing`);

  const leaks = [];
  for (const p of MUST_BE_GATED) {
    const r = await head(base, p);
    // The expectation is inverted here: 200 is the failure.
    if (r.status === 200) leaks.push(`200  ${p}  ← answers an ANONYMOUS caller`);
  }
  console.log(`gated api      ${MUST_BE_GATED.length - leaks.length}/${MUST_BE_GATED.length} correctly refuse anonymous callers`);

  const all = [...failures, ...apiFail, ...leaks];
  if (all.length) {
    console.log('\n── FAILURES ──');
    for (const f of all) console.log(`   ${f}`);
  } else {
    console.log('\nNo 5xx, no empty public list, no admin route answering anonymously.');
  }

  console.log(
    '\n⚠️ A pass means the handlers ran. It does not mean a page is CORRECT — that\n' +
    '   needs the browser audits — and it cannot see anything behind a login.',
  );
  process.exit(all.length ? 1 : 0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => { console.error('sweep failed:', err?.message ?? err); process.exit(1); });
}
