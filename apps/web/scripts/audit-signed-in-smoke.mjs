#!/usr/bin/env node
/**
 * Does every signed-in route actually RENDER? A crash smoke test.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS SEPARATE FROM audit-signed-in.mjs
 *
 * That script measures CONTRAST. A page that has crashed to an error boundary
 * still has contrast — the boundary's own text — so it reports a small number of
 * findings and moves on. `/admin/super` crashed on every visit for an unknown
 * length of time and the contrast sweep's only symptom was an entry in its
 * "fewer than 15 text elements" footnote. It took reading that footnote to
 * notice. A crash deserves to be the headline, not a footnote.
 *
 * This asserts the thing the contrast sweep assumes: the page rendered.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT CATCHES AND WHAT IT CANNOT
 *
 * Catches: non-200 responses, Next error boundaries, and server-side exception
 * digests — i.e. the page is broken for everyone, regardless of data.
 *
 * Does NOT catch: wrong numbers, wrong rows, RLS mistakes. The stub has no RLS
 * and no query planner. A green run here means "renders", not "works" — the same
 * caveat audit-signed-in.mjs states about itself, and it is worth restating
 * because a green smoke suite is exactly the kind of result that gets
 * over-read.
 *
 * ⚠️ A CRASH HERE IS NOT AUTOMATICALLY A PRODUCT BUG. Three of the four crashes
 * found on the first run were STUB FIXTURE bugs — a fixture column that did not
 * match supabase/schema.sql, on a column the schema declares NOT NULL, so the
 * value can never be absent in production. Check the schema before filing.
 *
 * Requires the app to be BUILT against the stub URL — see audit-signed-in.mjs.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 … npm run build
 *   node scripts/audit-signed-in-smoke.mjs [--port 4150] [--stub-port 54321]
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const APP_PORT = Number(argOf('--port', '4150'));
const STUB_PORT = Number(argOf('--stub-port', '54321'));
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const USER_ID = '00000000-0000-4000-8000-000000000001';

const routesDoc = JSON.parse(readFileSync(path.join(WEB_ROOT, 'e2e', 'public-routes.json'), 'utf8'));
const ROUTES = [
  ...routesDoc.authGated.routes,
  ...routesDoc.authGated.consoles,
  ...routesDoc.authGated.dynamicSamples,
];

/** Same cookie shape @supabase/ssr writes — see audit-signed-in.mjs. */
function sessionCookie() {
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
  const name = `sb-${new URL(BASE).hostname.split('.')[0]}-auth-token`;
  return `${name}=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

function spawnChild(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', cwd: WEB_ROOT, ...opts });
  process.on('exit', () => child.kill());
  return child;
}

async function waitForHttp(url, label, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${label} never came up at ${url}`);
}

spawnChild(process.execPath, ['scripts/supabase-stub.mjs', '--port', String(STUB_PORT)], { stdio: 'ignore' });
await waitForHttp(`${STUB_URL}/auth/v1/user`, 'supabase-stub');

spawnChild('npx', ['next', 'start', '-p', String(APP_PORT)], {
  stdio: 'ignore',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: STUB_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'stub-service-key',
    ADMIN_EMAILS: 'audit-stub@charitme.local',
  },
});
await waitForHttp(`${BASE}/api/health`, 'app');

const cookie = sessionCookie();

// Prove the session is accepted before trusting a single result. Without this a
// rejected cookie makes every route redirect to /login, which follows to a 200
// and reports a clean sweep of the login page 106 times.
const probe = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: 'manual' });
if (probe.status !== 200) {
  console.error(
    `\n✗ /dashboard answered ${probe.status} with a stub session — the build is not ` +
      `pointed at ${STUB_URL}, or the cookie was rejected. Refusing to report a sweep ` +
      `of login pages as a pass.\n`,
  );
  process.exit(2);
}
console.log(`· signed-in probe OK — sweeping ${ROUTES.length} routes\n`);

const ERROR_MARKERS = [
  'Application error: a server-side exception has occurred',
  'Application error: a client-side exception has occurred',
  'This page could not be found',
];

const broken = [];
for (const route of ROUTES) {
  let status = 0;
  let marker = null;
  let chars = 0;
  try {
    const res = await fetch(BASE + route, { headers: { cookie }, redirect: 'manual' });
    status = res.status;
    const html = await res.text();
    chars = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
    marker = ERROR_MARKERS.find((m) => html.includes(m)) ?? null;
    // A Next server exception leaves a digest in the streamed payload even when
    // the shell already committed a 200.
    if (!marker && /"digest"\s*:\s*"\d+"/.test(html)) marker = 'server exception digest';
  } catch (e) {
    marker = `fetch failed: ${String(e).split('\n')[0]}`;
  }

  const bad = status !== 200 || marker;
  if (bad) broken.push({ route, status, marker, chars });
  console.log(`${bad ? '✗' : '·'} ${String(status).padEnd(3)} ${route}${marker ? `  ← ${marker}` : ''}`);
}

console.log(`\n${'─'.repeat(60)}`);
if (broken.length === 0) {
  console.log(`✓ all ${ROUTES.length} signed-in routes rendered`);
  console.log('  (renders — NOT "works". No RLS, no query planner behind this.)');
  process.exit(0);
}
console.log(`❌ ${broken.length} of ${ROUTES.length} signed-in routes did not render:\n`);
for (const b of broken) console.log(`  ${b.route}\n    status ${b.status} · ${b.marker} · ${b.chars} visible chars`);
console.log('\nBefore filing any of these: check supabase/schema.sql. Most crashes found');
console.log('this way have been stub fixture columns that do not match the schema.');
process.exit(1);
