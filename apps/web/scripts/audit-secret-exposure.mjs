#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Are any secret VALUES reachable by a browser?
//
// Two surfaces, both checked here:
//   1. the client bundles in `.next/static` — anything shipped there is public
//      no matter what the file is named;
//   2. API response bodies — an error message that echoes a driver error can
//      carry a connection string or a key.
//
// ⚠️ IT SEARCHES FOR VALUES, NOT NAMES. Grepping for `STRIPE_SECRET_KEY` finds
// three legitimate hits in this repo and zero problems:
//   • `app/create` ships the copy "Ensure STRIPE_SECRET_KEY is set in Vercel",
//     an operator hint shown when Connect onboarding fails;
//   • `admin/users` and `admin/super/roles` ship a permissions matrix whose rows
//     describe CRON_SECRET behaviour.
// All three are the NAME in user-facing text. A check that flagged them would be
// noise, and noise is how a real hit gets waved through.
//
//   npm run build && node scripts/audit-secret-exposure.mjs [--base http://127.0.0.1:4200]
//
// The API sweep is skipped unless a server answers; the bundle scan always runs.
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBase } from './lib/audit-base.mjs';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = join(WEB_ROOT, '.next', 'static');
const API_ROOT = join(WEB_ROOT, 'app', 'api');

/** Env vars whose VALUE must never reach a browser. */
const SECRET_ENV = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'OPENAI_API_KEY',
  'CRON_SECRET',
  'GITHUB_TOKEN',
  'GITHUB_PAT',
  'OPENCORPORATES_API_TOKEN',
  'SUPABASE_ACCESS_TOKEN',
];

/**
 * Shapes that are secret whatever the variable is called — so a key hardcoded
 * into a file, or pasted into a comment, is caught even though it is in no env
 * var this process can see.
 *
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_…`) is deliberately absent: it is
 * public by design and belongs in the bundle.
 */
const SECRET_SHAPES = [
  [/\bsk_live_[A-Za-z0-9]{10,}/g, 'Stripe live secret key'],
  [/\bsk_test_[A-Za-z0-9]{10,}/g, 'Stripe test secret key'],
  [/\brk_live_[A-Za-z0-9]{10,}/g, 'Stripe restricted key'],
  [/\bwhsec_[A-Za-z0-9]{16,}/g, 'Stripe webhook signing secret'],
  [/\bre_[A-Za-z0-9]{16,}/g, 'Resend API key'],
  [/\bsk-proj-[A-Za-z0-9_-]{20,}/g, 'OpenAI project key'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, 'GitHub token'],
];

/** Values pulled from the environment this build ran with, if any are set. */
function envSecrets() {
  return SECRET_ENV.flatMap((name) => {
    const v = process.env[name];
    // Short values produce false positives against minified code; a real secret
    // is never 8 characters.
    return v && v.length >= 12 ? [{ name, value: v }] : [];
  });
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function scanBundles() {
  const files = walk(STATIC_DIR).filter((f) => /\.(js|css|map|json)$/.test(f));
  const secrets = envSecrets();
  const findings = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const { name, value } of secrets) {
      if (src.includes(value)) {
        findings.push({ file: relative(WEB_ROOT, file), what: `VALUE of ${name}` });
      }
    }
    for (const [re, label] of SECRET_SHAPES) {
      const m = src.match(re);
      if (m) findings.push({ file: relative(WEB_ROOT, file), what: `${label} (${m[0].slice(0, 12)}…)` });
    }
  }
  return { scanned: files.length, findings };
}

function apiRoutes() {
  const out = [];
  const walkApi = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { walkApi(p); continue; }
      if (n !== 'route.ts') continue;
      const src = readFileSync(p, 'utf8');
      const url =
        '/api/' +
        relative(API_ROOT, dir).split('\\').join('/').split('/').filter(Boolean)
          .map((s) => (s.startsWith('[') ? (s.startsWith('[...') ? 'x' : '00000000-0000-0000-0000-000000000000') : s))
          .join('/');
      for (const m of src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)) {
        out.push({ method: m[1], url });
      }
    }
  };
  walkApi(API_ROOT);
  return out;
}

async function scanResponses(base) {
  const secrets = envSecrets();
  const findings = [];
  let swept = 0;

  for (const r of apiRoutes()) {
    let text = '';
    try {
      const res = await fetch(base + r.url, {
        method: r.method,
        headers: { 'content-type': 'application/json' },
        ...(r.method === 'GET' ? {} : { body: '{}' }),
      });
      text = (await res.text()).slice(0, 8000);
    } catch { continue; }
    swept++;

    for (const { name, value } of secrets) {
      if (text.includes(value)) findings.push({ where: `${r.method} ${r.url}`, what: `VALUE of ${name}` });
    }
    for (const [re, label] of SECRET_SHAPES) {
      if (re.test(text)) findings.push({ where: `${r.method} ${r.url}`, what: label });
      re.lastIndex = 0;
    }
    // Internals that are not secrets but hand an attacker the shape of the system.
    for (const [re, label] of [
      [/\bat [A-Za-z_$][\w$]* \(/, 'stack frame'],
      [/\/home\/[a-z]+\//, 'filesystem path'],
      [/webpack-internal/, 'webpack internal path'],
      [/\bPGRST\d{3}\b/, 'raw PostgREST error code'],
    ]) {
      if (re.test(text)) findings.push({ where: `${r.method} ${r.url}`, what: label });
    }
  }
  return { swept, findings };
}

async function main() {
  const base = resolveBase(process.argv, 'http://127.0.0.1:4200');
  const known = envSecrets();

  console.log('Secret-exposure audit\n');
  console.log(
    `Secret values visible to this process: ${known.length}` +
      (known.length ? ` (${known.map((s) => s.name).join(', ')})` : ''),
  );
  if (known.length === 0) {
    console.log('⚠️  none set here, so only the SHAPE patterns can fire — a leaked value of an\n' +
                '    unset variable is invisible to this run. Run it where the build had its env.');
  }

  const bundles = scanBundles();
  console.log(`\nBundles scanned: ${bundles.scanned} files under .next/static`);

  let live = { swept: 0, findings: [] };
  try {
    const probe = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (probe.ok) live = await scanResponses(base);
    else console.log(`API sweep skipped — ${base}/api/health answered ${probe.status}`);
  } catch {
    console.log(`API sweep skipped — nothing answering at ${base}`);
  }
  if (live.swept) console.log(`API responses scanned: ${live.swept}`);

  const all = [
    ...bundles.findings.map((f) => `${f.what}  →  ${f.file}`),
    ...live.findings.map((f) => `${f.what}  →  ${f.where}`),
  ];

  if (all.length === 0) {
    console.log('\n✅ no secret values and no internals in any bundle or response');
    process.exit(0);
  }
  console.log(`\n🚨 ${all.length} finding(s):`);
  for (const f of all) console.log(`   ${f}`);
  process.exit(1);
}

main().catch((err) => {
  console.error('audit failed:', err?.message ?? err);
  process.exit(2);
});
