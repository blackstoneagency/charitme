#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Does every mutating API route ACTUALLY refuse an anonymous caller?
//
// `__tests__/api-auth-coverage.test.ts` answers this by regex: it looks for
// `requireUser`, `auth.getUser()` and friends anywhere in the file. That guard
// is worth keeping — it is fast and it catches a forgotten import — but it
// cannot tell the difference between
//
//     const { data: { user } } = await supabase.auth.getUser();
//     if (!user) return 401;                       // ← a gate
//
// and
//
//     const { data: { user } } = await supabase.auth.getUser();
//     if (user) { /* also save it for them */ }    // ← personalisation
//
// Both contain the same token. `app/api/ai/grant-match/route.ts` is the second
// kind: a deliberately public endpoint whose `getUser()` only decides whether to
// persist the result. The regex read it as guarded, so it never had to be
// justified in the allow-list — which is the one thing the allow-list exists for.
//
// ── Relationship to `audit-api-auth-live.mjs` ───────────────────────────────
// That script asks the same question with **GET only**, deliberately, because
// GET is idempotent and it is therefore safe to point at a live database. That
// safety is exactly why it cannot cover POST/PATCH/PUT/DELETE — which is where
// an unguarded route actually does damage. This is the mutating counterpart, and
// the reason it refuses to run against production below.
//
// This asks the running server instead. Start a production build, then:
//
//   npx next start -p 4200 &
//   node scripts/audit-route-auth.mjs --base http://127.0.0.1:4200
//
// ⚠️ POINT THIS AT A LOCAL BUILD, NEVER AT PRODUCTION. It sends unauthenticated
// POSTs to every mutating route. If a guard IS missing — the case this exists to
// find — the request goes through and performs the mutation for real. Against a
// local build with placeholder Supabase credentials there is no database to
// mutate, so the sweep is inert.
//
// HOW TO READ THE RESULT
//
//   401 / 403  enforced. Proof: the handler ran and refused.
//   2xx        public. Must appear in DECLARED_PUBLIC with a reason, or this
//              exits non-zero.
//   400        INCONCLUSIVE, not a pass — the route validated the empty body and
//              returned before reaching any auth check. A real body might well
//              be refused. These are reported separately and never counted as
//              enforced, because counting them would be the same false
//              confidence this script exists to remove.
//   5xx        reported. Usually the absent database in a placeholder build.
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBase } from './lib/audit-base.mjs';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = join(WEB_ROOT, 'app', 'api');
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Routes that answer an anonymous caller on purpose. Each needs a reason — that
 * is the entire point, and it is why `ai/grant-match` being absent mattered.
 */
const DECLARED_PUBLIC = {
  'auth/signout': 'clearing your own session cannot require a session',
  'trust-score': 'public trust-score calculator; no persistence',
  'ai/grant-match':
    'public grant matcher over public grant columns; its getUser() only decides ' +
    'whether to persist matches for a signed-in user, and does not gate the read',
};

function routeFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

function mutatingRoutes() {
  return routeFiles(API_ROOT)
    .map((file) => {
      const src = readFileSync(file, 'utf8');
      const m = src.match(/export async function (POST|PATCH|PUT|DELETE)/);
      if (!m) return null;
      const id = relative(API_ROOT, dirname(file)).split('\\').join('/');
      const url =
        '/api/' +
        id
          .split('/')
          .map((seg) => (seg.startsWith('[') ? (seg.startsWith('[...') ? 'x' : NIL_UUID) : seg))
          .join('/');
      return { id, url, method: m[1] };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function main() {
  // Shared resolver, so `--base <url>` and a bare positional URL both work —
  // hand-rolled parsing here is what `__tests__/audit-base-resolution.test.ts`
  // exists to prevent, and it caught this script on its first run.
  const base = resolveBase(process.argv, 'http://127.0.0.1:4200');
  if (/charitme\.com/i.test(base)) {
    console.error('refusing to sweep production — see the warning at the top of this file');
    process.exit(2);
  }

  const routes = mutatingRoutes();
  console.log(`Sweeping ${routes.length} mutating routes at ${base}, unauthenticated\n`);

  const enforced = [];
  const publicOk = [];
  const undeclared = [];
  const inconclusive = [];
  const errored = [];

  for (const r of routes) {
    let status = 0;
    try {
      const res = await fetch(base + r.url, {
        method: r.method,
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      status = res.status;
    } catch (err) {
      errored.push({ ...r, status: `network: ${err?.message ?? err}` });
      continue;
    }

    if (status === 401 || status === 403) enforced.push(r);
    else if (status >= 200 && status < 300) {
      (r.id in DECLARED_PUBLIC ? publicOk : undeclared).push({ ...r, status });
    } else if (status === 400) inconclusive.push({ ...r, status });
    else errored.push({ ...r, status });
  }

  console.log(`✅ enforced (401/403)          ${enforced.length}`);
  console.log(`🔓 public, declared            ${publicOk.length}`);
  console.log(`❔ inconclusive (400 on {})    ${inconclusive.length}  — validated before authenticating; NOT a pass`);
  console.log(`⚠️  other status               ${errored.length}`);
  console.log(`🚨 public, UNDECLARED          ${undeclared.length}`);

  if (inconclusive.length) {
    console.log('\nInconclusive — an empty body was rejected before any auth check ran:');
    for (const r of inconclusive) console.log(`   ${r.status} ${r.method} ${r.url}`);
  }
  if (errored.length) {
    console.log('\nOther statuses (a placeholder build has no database, so 5xx is expected here):');
    for (const r of errored) console.log(`   ${r.status} ${r.method} ${r.url}`);
  }
  if (undeclared.length) {
    console.log('\n🚨 These answered an anonymous caller and are not declared public:');
    for (const r of undeclared) console.log(`   ${r.status} ${r.method} ${r.url}   (id: ${r.id})`);
    console.log('\nEither add the guard, or add the id to DECLARED_PUBLIC with a reason.');
  }

  process.exit(undeclared.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('sweep failed:', err?.message ?? err);
  process.exit(2);
});
