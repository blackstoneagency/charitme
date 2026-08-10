#!/usr/bin/env node
/**
 * Run the contrast sweep over the SIGNED-IN half of the product.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS UNBLOCKS
 *
 * Every sweep in this repo — axe, contrast, responsive, keyboard — has only ever
 * covered public routes. The gated half (10 standalone routes + 68 renderable
 * console routes + 19 [param] templates) had ZERO coverage from any
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
 * run against a server it did not verify, rather than producing a sweep of 97
 * login pages.
 *
 * Usage:
 *   npm run build   # with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *   node scripts/audit-signed-in.mjs [--strict-gradients] [--port 3000]
 *
 * `--mobile` drives scripts/audit-mobile.mjs instead of the contrast sweep, over
 * the same stub session. The overflow and tap-target checks had the identical
 * gap the contrast sweep had — public routes only — and the signed-in half is
 * where the wide data tables live, so it is the half a phone struggles with.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { assertPortAvailable } from './lib/audit-port.mjs';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const APP_PORT = Number(argOf('--port', '3000'));
const STUB_PORT = Number(argOf('--stub-port', '54321'));
const ONLY = argOf('--only', null);
const AS_JSON = argv.includes('--json');
const REUSE_STUB = argv.includes('--reuse-stub');
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const BASE = `http://127.0.0.1:${APP_PORT}`;
// `--no-admin` swaps the fixture user, and it has to: clearing ADMIN_EMAILS is
// NOT enough, because `isAdmin` also consults the profile's `roles` array and the
// default fixture (…0001) carries ['donor','admin','super_admin']. Switching the
// env var alone left the sweep an admin and `/dashboard` still redirecting —
// which is exactly how this hole stayed invisible.
const AS_PUBLIC = argv.includes('--public');
const AS_MEMBER = !AS_PUBLIC && argv.includes('--no-admin');
const USER_ID = AS_MEMBER
  ? '00000000-0000-4000-8000-000000000012'   // organizer fixture: donor + organizer
  : '00000000-0000-4000-8000-000000000001';  // default fixture: admin + super_admin
const USER_EMAIL = AS_MEMBER ? 'organizer-persona@charitme.local' : 'audit-stub@charitme.local';
const USER_NAME = AS_MEMBER ? 'Owen Organizer' : 'Audit Stub';
// The stub resolves the persona from the BEARER TOKEN (PERSONA_BY_TOKEN), so the
// token has to match too — an id and email alone would still resolve to the
// default admin persona and silently undo the switch.
const USER_TOKEN = AS_MEMBER ? 'stub-organizer-access-token' : 'stub-access-token';

if (APP_PORT === STUB_PORT) {
  throw new Error('The Next app and Supabase stub must use different ports.');
}

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
    access_token: USER_TOKEN,
    refresh_token: `${USER_TOKEN}-refresh`,
    token_type: 'bearer',
    expires_in: 31_536_000,
    expires_at: now + 31_536_000,
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: USER_EMAIL,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: USER_NAME },
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
function runChild(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(cmd, args, opts);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with ${code ?? 'no status'}`));
    });
  });
}
function cleanup() {
  for (const c of children) { try { c.kill('SIGTERM'); } catch { /* already gone */ } }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// ─── 1. stub ────────────────────────────────────────────────────────────────
await assertPortAvailable(APP_PORT, 'Next app');
if (!REUSE_STUB) {
  await assertPortAvailable(STUB_PORT, 'Supabase stub');
  spawnChild(process.execPath, ['scripts/supabase-stub.mjs', '--port', String(STUB_PORT)], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
await waitForHttp(`${STUB_URL}/auth/v1/user`, 'supabase-stub');
if (!AS_JSON) console.log(`· supabase-stub up on ${STUB_URL}`);

// ─── 2. app ─────────────────────────────────────────────────────────────────
//
// `--no-admin` runs the fixture user as an ORDINARY member.
//
// ⚠️ This exists because the admin grant below silently hid a whole surface.
// `/dashboard` redirects an admin to `/admin`, so with the grant always on, every
// signed-in sweep reported `/dashboard — REDIRECTED to /admin; not measured` and
// the entire donor/organizer dashboard was never measured by anything: not
// contrast, not overflow, not tap targets. Three routes were quietly exempt from
// every audit in the repo, and the exemption looked like a harness quirk rather
// than a coverage hole.
//
// Both modes are needed. The admin console is only reachable WITH the grant, and
// the member dashboard only WITHOUT it — no single run can cover both.
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: STUB_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service-key',
  NEXT_PUBLIC_APP_URL: BASE,
  // Grants the fixture user the admin console. Without it /admin/* 302s to
  // /admin and the rest of the admin console drop out of the sweep.
  ADMIN_EMAILS: AS_MEMBER ? '' : 'audit-stub@charitme.local',
  // The stub serves the session token verbatim, so it must match the fixture the
  // cookie claims to be.
};
if (argv.includes('--build')) {
  if (!AS_JSON) console.log('Â· building the app against the signed-in Supabase stub');
  await runChild(process.execPath, [nextBin, 'build'], {
    env,
    stdio: AS_JSON ? ['ignore', 'ignore', 'inherit'] : ['ignore', 'inherit', 'inherit'],
  });
}
await assertPortAvailable(APP_PORT, 'Next app');
spawnChild(process.execPath, [nextBin, 'start', '-p', String(APP_PORT)], {
  env,
  stdio: ['ignore', 'ignore', 'inherit'],
});
await waitForHttp(`${BASE}/api/health`, 'next start');
if (!AS_JSON) console.log(`· app up on ${BASE}`);

// ─── 3. prove the build is pointed at the stub ──────────────────────────────
//
// The failure this guards against is specific and has already cost one full run
// elsewhere in this repo: a server left over from a previous build answers on the
// port, the sweep passes, and the numbers describe code that is not on disk.
// Here the stakes are higher — a build made against the REAL Supabase URL cannot
// reach it from the sandbox, so every gated route redirects and the sweep would
// report 97 clean pages that were all /login.
const cookieName = cookieNameFor(STUB_URL);
const cookieValue = sessionCookieValue();
const sessionHeader = `${cookieName}=${cookieValue}`;
// The probe route differs by mode, and each one proves BOTH halves of what we
// need: that the session works, and that the role is the one we asked for.
// `/admin` renders only for an admin; `/dashboard` renders 200 only for a
// non-admin (an admin is redirected to /admin). Probing /admin in member mode
// would fail on a correct build, and probing /dashboard in admin mode would
// pass on a build with no admin grant at all.
const probePath = AS_PUBLIC ? '/' : AS_MEMBER ? '/dashboard' : '/admin';
const probe = await fetch(`${BASE}${probePath}`, {
  headers: AS_PUBLIC ? {} : { cookie: sessionHeader },
  redirect: 'manual',
});
if (probe.status !== 200) {
  console.error(
    `\n✗ ${probePath} answered ${probe.status} with the ${AS_PUBLIC ? 'public' : AS_MEMBER ? 'member' : 'admin'} stub session.\n` +
    '  The build is almost certainly pointed at the real Supabase URL. Rebuild with:\n' +
    `    NEXT_PUBLIC_SUPABASE_URL=${STUB_URL} NEXT_PUBLIC_SUPABASE_ANON_KEY=stub-anon-key \\\n` +
    '    SUPABASE_SERVICE_ROLE_KEY=stub-service-key npm run build --workspace=apps/web\n',
  );
  process.exit(2);
}
if (!AS_JSON) console.log(`· runtime probe: ${probePath} renders (200) as ${AS_PUBLIC ? 'public' : AS_MEMBER ? 'member' : 'admin'}`);

// ─── 4a. content contracts (optional, runs BEFORE the sweep) ────────────────
//
// `--content-contracts` runs scripts/audit-content-contracts.mjs against this
// same server before the main sweep, and fails the whole run if it fails.
//
// ⚠️ It is bolted onto THIS harness rather than given its own CI step for one
// reason: it needs a build pointed at the Supabase stub. The public "Runtime
// audits" step builds against `placeholder.supabase.co`, where every data-backed
// route renders an empty state — the exact condition this audit exists to catch,
// so it would fail 8 of 8 routes there and mean nothing. Giving it its own step
// would mean a second full `next build`, and Actions minutes are the binding
// constraint on this repo. One build, one server, two readers.
//
// The routes it checks are PUBLIC; it does not use the session. It runs here
// only because this is where a stub-backed server exists.
if (argv.includes('--content-contracts')) {
  if (!AS_JSON) console.log('\n· content contracts (public routes, stub-backed data)');
  try {
    await runChild(process.execPath, ['scripts/audit-content-contracts.mjs', '--base', BASE], { env });
  } catch (contractError) {
    console.error(`\n✗ content contracts failed: ${contractError.message}`);
    cleanup();
    process.exit(1);
  }
}

// ─── 4b. sweep ──────────────────────────────────────────────────────────────
const MOBILE = argv.includes('--mobile');
const RESPONSIVE = argv.includes('--responsive');
const PAGE_IMAGES = argv.includes('--page-images');
const CONTRAST = argv.includes('--contrast');
const FOCUS_ORDER = argv.includes('--focus-order');
// `--probe <path> [width]` explains ONE route instead of sweeping all of them:
// the ancestor chain of the widest offender, with the properties that decide
// whether each box can shrink. Reuses this harness because the interesting
// overflows are all behind a session.
const PROBE = argv.includes('--probe') ? argv[argv.indexOf('--probe') + 1] : null;
const sweepArgs = [];
if (PROBE) {
  sweepArgs.push(['scripts/probe-overflow.mjs', BASE, PROBE, ...(argv.includes('--width') ? [argv[argv.indexOf('--width') + 1]] : [])]);
} else {
  if (PAGE_IMAGES) {
    sweepArgs.push([
      'scripts/audit-page-images.mjs', '--base', BASE,
      ...(AS_PUBLIC ? [] : ['--auth']),
      ...(argv.includes('--strict-global') ? ['--strict-global'] : []),
      ...(ONLY ? ['--only', ONLY] : []),
    ]);
  }
  if (MOBILE) {
    sweepArgs.push(['scripts/audit-mobile.mjs', BASE, ...(AS_PUBLIC ? [] : ['--auth']), ...(ONLY ? ['--only', ONLY] : [])]);
  }
  if (RESPONSIVE) {
    sweepArgs.push(['scripts/audit-responsive.mjs', '--base', BASE, ...(AS_PUBLIC ? [] : ['--auth']), ...(ONLY ? ['--only', ONLY] : [])]);
  }
  if (CONTRAST) {
    sweepArgs.push([
      'scripts/audit-contrast.mjs', '--base', BASE,
      ...(AS_PUBLIC ? [] : ['--auth']),
      ...(AS_JSON ? ['--json'] : []),
      ...(ONLY ? ['--only', ONLY] : []),
      ...(argv.includes('--strict-gradients') ? ['--strict-gradients'] : []),
    ]);
  }
  if (FOCUS_ORDER) {
    sweepArgs.push([
      'scripts/audit-focus-order.mjs', '--base', BASE,
      ...(AS_PUBLIC ? [] : ['--auth']),
      ...(ONLY ? ['--only', ONLY] : []),
    ]);
  }
  if (sweepArgs.length === 0) {
    sweepArgs.push([
      'scripts/audit-contrast.mjs',
      '--base', BASE,
      ...(AS_PUBLIC ? [] : ['--auth']),
      ...(AS_JSON ? ['--json'] : []),
      ...(ONLY ? ['--only', ONLY] : []),
      ...(argv.includes('--strict-gradients') ? ['--strict-gradients'] : []),
    ]);
  }
}

const sweepEnv = {
  ...env,
  ...(AS_PUBLIC ? {} : { STUB_SESSION_COOKIE: JSON.stringify({ name: cookieName, value: cookieValue }) }),
  // In member mode the /admin/* routes are legitimately unreachable, so the
  // sweep must SKIP them rather than count ~104 correct redirects as failures.
  // Left as failures the member run could never go green, and an audit that is
  // permanently red is an audit nobody reads — the same lesson this repo has
  // already learned twice.
  AUDIT_SKIP_ADMIN: AS_MEMBER ? '1' : '',
  AUDIT_ONLY_GATED: AS_PUBLIC || argv.includes('--include-public') ? '' : '1',
  AUDIT_SKIP_DASHBOARD_ROOT: AS_PUBLIC || AS_MEMBER ? '' : '1',
};

try {
  for (const args of sweepArgs) await runChild(process.execPath, args, { env: sweepEnv });
  cleanup();
} catch (error) {
  cleanup();
  console.error(error.message);
  process.exit(1);
}
