#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
/**
 * Deploy/CI preflight: validate environment variables and print a readable
 * report. Exits non-zero when there are blocking errors so it can gate a
 * deploy. Add `--production` to enforce prod-only requirements regardless of
 * NODE_ENV.
 *
 * This intentionally re-implements the schema check in plain JS (no TS build
 * step) so it can run in a bare Node context (CI, Docker entrypoint). It is
 * kept aligned with lib/env.ts; lib/env.ts remains the source of truth that the
 * app + unit tests use.
 */

const FORCE_PROD = process.argv.includes('--production') || process.env.NODE_ENV === 'production';

function loadLocalEnvForDevelopment() {
  if (FORCE_PROD) return;
  const file = resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match || process.env[match[1]]) continue;
    const rawValue = match[2];
    const quoted = rawValue.length >= 2 && ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'")));
    process.env[match[1]] = quoted ? rawValue.slice(1, -1) : rawValue;
  }
}

loadLocalEnvForDevelopment();

const PROD = FORCE_PROD;

const HARD_REQUIRED = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'url'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'str'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'str'],
];
const PROD_REQUIRED = ['NEXT_PUBLIC_APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];

const errors = [];
const warnings = [];
const present = (k) => (process.env[k] ?? '').toString().trim().length > 0;

for (const [key, kind] of HARD_REQUIRED) {
  if (!present(key)) { errors.push(`${key} is required`); continue; }
  if (kind === 'url') {
    try { new URL(process.env[key]); } catch { errors.push(`${key} must be a valid URL`); }
  }
}
for (const key of PROD_REQUIRED) {
  if (present(key)) continue;
  (PROD ? errors : warnings).push(`${key} is required in production`);
}

console.log(`Environment preflight (${PROD ? 'production' : 'non-production'})`);
console.log('─────────────────────────────────────────────');
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  • ${w}`);
}
if (errors.length) {
  console.log(`\nFAILURES (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log('\nEnvironment preflight FAILED.');
  process.exit(1);
}
console.log('Environment preflight PASSED.');
