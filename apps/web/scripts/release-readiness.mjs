// ─────────────────────────────────────────────────────────────────────────────
// One command that answers "what is actually stopping a release?"
//
//   npm run release:readiness --workspace=apps/web
//   npm run release:readiness --workspace=apps/web -- --json
//
// Two audits converged on the same shape of answer: the code is done and a small
// set of SECRETS is missing. That answer lived in prose across mobileGo.md and
// todo.md, where it goes stale the moment someone sets one of them.
//
// This checks the real environment instead, names what each missing input
// breaks, and exits non-zero while anything blocking is unset — so it can gate a
// release rather than be read and believed.
//
// ⚠️ It reports PRESENT / ABSENT and never prints a value. A readiness report
// that leaks the secret it is checking for is worse than no report.
//
// ⚠️ It also checks Stripe's ACCOUNT STATE, not just the keys, because the two
// fail differently: a key can be present and correct while the platform still
// cannot take a donation, which is exactly the situation this repo is in.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');
const AS_JSON = process.argv.includes('--json');

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
const has = (name) => Boolean((e[name] ?? '').trim());

/**
 * Every input, what it unlocks, and whether its absence blocks a release.
 *
 * `blocking: false` is not "unimportant" — it is "the product works without it,
 * a specific feature does not". Conflating the two is how a release is held for
 * a nice-to-have or shipped without a payout path.
 */
const INPUTS = [
  {
    name: 'STRIPE_SECRET_KEY',
    unlocks: 'Taking donations at all',
    blocking: true,
    note: (v) => (v.startsWith('sk_live_') ? 'LIVE key' : v.startsWith('sk_test_') ? 'test key' : 'unrecognised prefix'),
  },
  { name: 'STRIPE_WEBHOOK_SECRET', unlocks: 'Recording donations (a redirect is never authoritative)', blocking: true },
  { name: 'STRIPE_CONNECT_WEBHOOK_SECRET', unlocks: 'Payout status updates from Connect', blocking: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', unlocks: 'Every server-side read and the webhook writer', blocking: true },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', unlocks: 'All public pages', blocking: true },
  { name: 'RESEND_API_KEY', unlocks: 'Receipts and every outbound email', blocking: true },
  { name: 'CRON_SECRET', unlocks: '/api/cron/* (fails SAFE when unset — locks cron out)', blocking: false },
  { name: 'ACCOUNT_SELF_DELETE_ENABLED', unlocks: 'Self-service deletion — App Store 5.1.1(v)', blocking: false },
  { name: 'VAPID_PUBLIC_KEY', unlocks: 'Donation alerts (push)', blocking: false },
  { name: 'VAPID_PRIVATE_KEY', unlocks: 'Donation alerts (push)', blocking: false },
  { name: 'ANDROID_PACKAGE_NAME', unlocks: 'Play Digital Asset Links', blocking: false },
  { name: 'ANDROID_SHA256_FINGERPRINT', unlocks: 'A TWA without an address bar', blocking: false },
  { name: 'IOS_APP_ID', unlocks: 'iOS universal links', blocking: false },
  { name: 'UNSPLASH_ACCESS_KEY', unlocks: 'Live themed covers (falls back cleanly)', blocking: false },
];

const missingBlocking = [];
const missingOptional = [];

// ⚠️ Name the environment being inspected, every time.
//
// This reads process.env plus .env.local — i.e. wherever it is RUN. Run locally
// it reports the local machine, and this repo deliberately omits live payment
// secrets from .env.local so no local flow can fire a real charge. Without this
// line someone runs it on a laptop, sees STRIPE_WEBHOOK_SECRET absent, and
// concludes production is broken.
const scope = existsSync(join(WEB_ROOT, '.env.local')) ? 'this machine (process.env + .env.local)' : 'process.env only';
if (!AS_JSON) {
  console.log('RELEASE READINESS');
  console.log(`scope: ${scope}`);
  console.log('⚠ Production secrets live in the deploy platform, not here. To judge');
  console.log('  PRODUCTION, run this where the app runs — or compare against its env.\n');
  console.log('Environment');
}
for (const input of INPUTS) {
  const present = has(input.name);
  if (!present) (input.blocking ? missingBlocking : missingOptional).push(input);
  if (!AS_JSON) {
    const mark = present ? '✓' : input.blocking ? '✗' : '·';
    const detail = present && input.note ? `  (${input.note((e[input.name] ?? '').trim())})` : '';
    console.log(`  ${mark} ${input.name.padEnd(32)} ${present ? 'present' : 'ABSENT'}${detail}`);
    if (!present) console.log(`      ${input.blocking ? 'BLOCKS RELEASE' : 'feature off'}: ${input.unlocks}`);
  }
}

// ── Stripe account state ─────────────────────────────────────────────────────
//
// A key can be present and valid while the platform still cannot accept a single
// donation. Checking the key alone would report ready.
const stripeState = { reachable: false, charges: null, connectedAccounts: null, payoutCapable: null };
if (has('STRIPE_SECRET_KEY')) {
  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(e.STRIPE_SECRET_KEY.trim(), { apiVersion: '2025-02-24.acacia' });
    const [charges, accounts] = await Promise.all([
      stripe.charges.list({ limit: 1 }),
      stripe.accounts.list({ limit: 100 }),
    ]);
    stripeState.reachable = true;
    stripeState.charges = charges.data.length;
    stripeState.connectedAccounts = accounts.data.length;
    stripeState.payoutCapable = accounts.data.filter((a) => a.charges_enabled && a.payouts_enabled).length;
  } catch (err) {
    stripeState.error = String(err instanceof Error ? err.message : err).slice(0, 120);
  }
}

if (!AS_JSON) {
  console.log('\nStripe account');
  if (!stripeState.reachable) {
    console.log(`  ✗ unreachable${stripeState.error ? `: ${stripeState.error}` : ' (no key)'}`);
  } else {
    console.log(`  · charges ever processed        ${stripeState.charges === 0 ? '0  ← no money has ever moved' : `${stripeState.charges}+`}`);
    console.log(`  · connected accounts            ${stripeState.connectedAccounts}`);
    console.log(`  ${stripeState.payoutCapable > 0 ? '✓' : '✗'} able to receive a donation     ${stripeState.payoutCapable}`);
    if (stripeState.payoutCapable === 0) {
      console.log('      BLOCKS DONATIONS: no connected account has charges AND payouts enabled,');
      console.log('      so resolvePayoutDestination returns null and every donation 409s.');
    }
  }
}

const donationsPossible = stripeState.reachable && stripeState.payoutCapable > 0;
const blocked = missingBlocking.length > 0 || !donationsPossible;

if (AS_JSON) {
  console.log(JSON.stringify({
    blocked,
    missingBlocking: missingBlocking.map((i) => i.name),
    missingOptional: missingOptional.map((i) => i.name),
    stripe: stripeState,
    scope,
  }, null, 2));
} else {
  console.log('\n───────────────────────────────────────────────────────────────');
  if (!blocked) {
    console.log('✅ READY — every blocking input is set and a payout destination exists.');
  } else {
    console.log(`❌ NOT READY — ${missingBlocking.length} blocking input(s) absent${donationsPossible ? '' : ', and no account can receive a donation'}.`);
    for (const i of missingBlocking) console.log(`   set ${i.name} → ${i.unlocks}`);
    if (!donationsPossible && stripeState.reachable) {
      console.log('   complete Stripe Connect onboarding for at least one campaign owner');
    }
  }
  if (missingOptional.length > 0) {
    console.log(`\n${missingOptional.length} optional feature(s) off: ${missingOptional.map((i) => i.name).join(', ')}`);
  }
}

process.exit(blocked ? 1 : 0);
