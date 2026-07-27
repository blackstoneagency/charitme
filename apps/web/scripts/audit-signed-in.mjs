#!/usr/bin/env node
/**
 * Run the contrast sweep over the SIGNED-IN half of the product.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS UNBLOCKS
 *
 * Every sweep in this repo — axe, contrast, responsive, keyboard — has only ever
 * covered public routes. The gated half (13 standalone routes + 75 static
 * /dashboard and /admin routes + 16 [param] templates) had ZERO coverage from any
 * of them, and the tracker attributed that to firewalled egress: the sandbox
 * cannot reach `*.supabase.co`, so no session, so no signed-in page.
 *
 * That inference had a hole in it. The sweeps do not need production data; they
 * need a host that answers `/auth/v1/user` and `/rest/v1/<table>`. That is a
 * ~200-line stub, not an owner action. See scripts/supabase-stub.mjs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A GREEN RUN HERE DOES AND DOES NOT MEAN
 *
 * Means:     these pages are legible in both themes at this viewport.
 * Does NOT mean: the queries are right, RLS admits the right rows, the numbers
 *                are correct, or the feature works.
 *
 * The stub has no RLS and no query planner. Writing up a green run as "the admin
 * console works" would be the same category of overclaim as the earlier "0 axe
 * violations" that was measured against pages whose data half never rendered.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT REQUIRES ITS OWN BUILD
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so the app must be BUILT against the
 * stub URL — a running server started with different env vars is not enough, and
 * silently keeps talking to the real (unreachable) host. This script refuses to
 * run against a server it did not verify, rather than producing a sweep of 104
 * login pages.
 *
 * Usage:
 *   npm run build   # with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   node scripts/audit-signed-in.mjs [--strict-gradients] [--port 3000]
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const APP_PORT = Number(argOf('--port', '3000'));
const STUB_PORT = Number(argOf('--stub-port', '54321'));
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const USER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * supabase-js derives the storage key from the first dot-separated label of the
 * URL hostname: `sb-${hostname.split('.')[0]}-auth-token`. For 127.0.0.1 that is
 * "127". Hardcoding "sb-127-auth-token" would break the moment someone points the
 * stub at a different host, so it is derived the same way the library does it.
 */
function cookieNameFor(url) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/**
 * @supabase/ssr 0.5.x stores the session as `base64-` + base64url(JSON). Anything
 * else is treated as a legacy plain-JSON cookie and, if it fails to parse, is
 * discarded silently — which presents as "the sweep is signed out" with no error.
 */
function sessionCookieValue() {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: 'stub-access-token',
    refresh_token: 'stub-refresh-token',
    token_type: 'bearer',
    expires_in: 31_536_000,
    expires_at: now + 31_536_000,
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'audit-stub@charitme.local',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Audit Stub' },
    },
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

async function waitForHttp(url, label, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`${label} never became reachable at ${url}`);
}

const children = [];
function spawnChild(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}
function cleanup() {
  for (const c of children) { try { c.kill('SIGTERM'); } catch { /* already gone */ } }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// ─── 1. stub ────────────────────────────────────────────────────────────────
spawnChild(process.execPath, ['scripts/supabase-stub.mjs', '--port', String(STUB_PORT)], {
  stdio: ['ignore', 'ignore', 'inherit'],
});
await waitForHttp(`${STUB_URL}/auth/v1/user`, 'supabase-stub');
console.log(`· supabase-stub up on ${STUB_URL}`);

// ─── 2. app ─────────────────────────────────────────────────────────────────
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: STUB_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service-key',
  // Grants the fixture user the admin console. Without it /admin/* 302s to
  // /dashboard and 53 routes drop out of the sweep with no visible reason.
  ADMIN_EMAILS: 'audit-stub@charitme.local',
};
spawnChild('npx', ['next', 'start', '-p', String(APP_PORT)], {
  env,
  stdio: ['ignore', 'ignore', 'inherit'],
});
await waitForHttp(`${BASE}/api/health`, 'next start');
console.log(`· app up on ${BASE}`);

// ─── 3. prove the build is pointed at the stub ──────────────────────────────
//
// The failure this guards against is specific and has already cost one full run
// elsewhere in this repo: a server left over from a previous build answers on the
// port, the sweep passes, and the numbers describe code that is not on disk.
// Here the stakes are higher — a build made against the REAL Supabase URL cannot
// reach it from the sandbox, so every gated route redirects and the sweep would
// report 104 clean pages that were all /login.
const cookieName = cookieNameFor(STUB_URL);
const probe = await fetch(`${BASE}/dashboard`, {
  headers: { cookie: `${cookieName}=${sessionCookieValue()}` },
  redirect: 'manual',
});
if (probe.status !== 200) {
  console.error(
    `\n✗ /dashboard answered ${probe.status} with a stub session.\n` +
    '  The build is almost certainly pointed at the real Supabase URL. Rebuild with:\n' +
    `    NEXT_PUBLIC_SUPABASE_URL=${STUB_URL} NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key \\\n` +
    '    SUPABASE_SERVICE_ROLE_KEY=stub-service-key npm run build --workspace=apps/web\n',
  );
  process.exit(2);
}
console.log('· signed-in probe: /dashboard renders (200)');

// ─── 4. sweep ───────────────────────────────────────────────────────────────
const sweep = spawnChild(process.execPath, [
  'scripts/audit-contrast.mjs',
  '--base', BASE,
  '--auth',
  ...(argv.includes('--strict-gradients') ? ['--strict-gradients'] : []),
], {
  env: {
    ...env,
    STUB_SESSION_COOKIE: JSON.stringify({ name: cookieName, value: sessionCookieValue() }),
  },
});

sweep.on('exit', (code) => { cleanup(); process.exit(code ?? 1); });
