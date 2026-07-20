#!/usr/bin/env node
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

const PROD = process.argv.includes('--production') || process.env.NODE_ENV === 'production';

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
