// ─────────────────────────────────────────────────────────────────────────────
// Stop 375 fictional Stripe accounts from claiming they can receive money.
//
//   node scripts/fix-seeded-connected-accounts.mjs            # report
//   node scripts/fix-seeded-connected-accounts.mjs --commit   # correct them
//
// MEASURED 2026-08-11: `connected_accounts` holds 501 rows. Five hundred carry a
// fabricated id of the form `acct_<16 lowercase hex>` — MD5 prefixes written by a
// seed script (`acct_c4ca4238a0b92382` is md5("1")). 375 of those are flagged
// `verification_status='verified'` with charges_enabled and payouts_enabled true.
// Live Stripe has exactly ONE connected account, and its charges are disabled.
//
// `lib/payout-destination.ts` now refuses these ids before consulting the flags,
// so no donation can be routed to one. This corrects the DATA, which is still
// telling every admin screen and every readiness check that reads the columns
// directly that 375 campaigns are ready to be paid.
//
// ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: it does not delete rows. A connected
// account row is the link between a campaign owner and their payout setup, and
// deleting it would destroy the record that onboarding was ever attempted. The
// flags are corrected; the history stays.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');
const COMMIT = process.argv.includes('--commit');

/** The seeder's signature. A real id is acct_ + 16 MIXED-CASE alphanumerics. */
const SEEDED = /^acct_[0-9a-f]{16}$/;

function env() {
  const merged = { ...process.env };
  const file = join(WEB_ROOT, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue;
      const key = line.slice(0, line.indexOf('=')).trim();
      if (!merged[key]) merged[key] = line.slice(line.indexOf('=') + 1).trim();
    }
  }
  return merged;
}

const e = env();
if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb
  .from('connected_accounts')
  .select('id, stripe_account_id, verification_status, charges_enabled, payouts_enabled, details_submitted')
  .limit(2000);
if (error) {
  console.error(`✗ could not read connected_accounts: ${error.message}`);
  process.exit(1);
}

const rows = data ?? [];
const seeded = rows.filter((r) => SEEDED.test(r.stripe_account_id ?? ''));
const claiming = seeded.filter(
  (r) => r.charges_enabled || r.payouts_enabled || r.details_submitted || r.verification_status === 'verified',
);
const real = rows.filter((r) => !SEEDED.test(r.stripe_account_id ?? ''));

console.log(`connected_accounts rows        : ${rows.length}`);
console.log(`  fabricated (acct_<16 hex>)   : ${seeded.length}`);
console.log(`  ...claiming payout readiness : ${claiming.length}`);
console.log(`  genuine-looking ids          : ${real.length}`);
for (const r of real) {
  console.log(`      ${r.stripe_account_id}  verified=${r.verification_status} charges=${r.charges_enabled} payouts=${r.payouts_enabled}`);
}

if (claiming.length === 0) {
  console.log('\nNothing to correct.');
  process.exit(0);
}

if (!COMMIT) {
  console.log(`\nDry run. ${claiming.length} rows would be corrected to: verification_status='pending',`);
  console.log("charges_enabled=false, payouts_enabled=false, details_submitted=false.");
  console.log('Re-run with --commit to apply. No row is deleted.');
  process.exit(0);
}

// Chunked: a 375-id `.in()` builds a very long URL, and PostgREST rejects one
// past its limit — which would look like a failed correction rather than a
// request that was too big.
const CHUNK = 50;
const ids = claiming.map((r) => r.id);
let corrected = 0;
for (let i = 0; i < ids.length; i += CHUNK) {
  const slice = ids.slice(i, i + CHUNK);
  const { error: updateError } = await sb
    .from('connected_accounts')
    .update({
      // ⚠️ 'pending', not 'unverified'. The check constraint on this column
      // rejects 'unverified' — the first run failed on it — and the values
      // actually in use are 'verified' and 'pending'. 'pending' is also the
      // honest state and the one the single genuine account is already in:
      // onboarding has not been completed.
      verification_status: 'pending',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    })
    .in('id', slice);
  if (updateError) {
    console.error(`✗ chunk ${i / CHUNK + 1} failed: ${updateError.message}`);
    process.exit(1);
  }
  corrected += slice.length;
}

// Verify by re-reading rather than trusting the writes.
const { data: after } = await sb
  .from('connected_accounts')
  .select('stripe_account_id, verification_status, charges_enabled, payouts_enabled, details_submitted')
  .limit(2000);
const stillClaiming = (after ?? []).filter(
  (r) =>
    SEEDED.test(r.stripe_account_id ?? '') &&
    (r.charges_enabled || r.payouts_enabled || r.details_submitted || r.verification_status === 'verified'),
);

console.log(`\n✓ corrected ${corrected} rows`);
console.log(`  fabricated rows still claiming readiness: ${stillClaiming.length}`);
if (stillClaiming.length > 0) {
  console.error('✗ some rows did not take the correction — investigate before relying on this');
  process.exit(1);
}
