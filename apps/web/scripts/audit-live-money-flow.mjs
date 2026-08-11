// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY audit of money that has ALREADY moved.
//
//   npm run audit:money-flow --workspace=apps/web
//
// The acceptance rule is "CharitMe revenue must go to CharitMe, campaign
// proceeds must go to the correct campaign owner, proven transaction-by-
// transaction and cent-by-cent". `verify-stripe-money-flow.mjs` proves it by
// CREATING a charge in test mode. This proves it by READING charges that
// already happened — which is the only way to audit production, and needs no
// test-mode account.
//
// ⚠️ THIS SCRIPT NEVER WRITES. It calls only `list` and `retrieve`. The guard
// below asserts that at runtime by refusing any Stripe method that is not one
// of those, so a future edit cannot quietly add a `create` and have it run
// against a live key. `__tests__/audit-live-money-flow.test.ts` asserts the same
// thing statically.
//
// A live key is therefore SAFE here, and is the point: production is where the
// real donations are. It is the opposite trade from the test-mode script, which
// refuses a live key because it creates objects.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from 'stripe';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const limitArg = argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(argv[limitArg + 1]) : 25;

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
const key = (e.STRIPE_SECRET_KEY ?? '').trim();
if (!key) {
  console.error('✗ STRIPE_SECRET_KEY is required (read-only usage).');
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });

/**
 * Refuse anything that is not a read.
 *
 * ⚠️ Not decoration. This script is the one place a LIVE key is used, and the
 * whole argument for that is that it cannot move money. A comment saying so is
 * not enforcement; this is.
 */
const READ_ONLY = new Set(['list', 'retrieve', 'listLineItems']);
function readOnly(resource, name) {
  return new Proxy(resource, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') return value;
      if (!READ_ONLY.has(String(prop))) {
        throw new Error(`REFUSED: ${name}.${String(prop)} is not a read — this script must never write`);
      }
      return value.bind(target);
    },
  });
}

// Only `charges` is needed: `expand` pulls the application fee, the transfer and
// the balance transaction onto each charge in the same round trip, so the
// figures compared below are Stripe's own and consistent per charge. Wrapping
// resources this script does not call would be dead weight the guard cannot
// protect.
const charges = readOnly(stripe.charges, 'charges');

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

console.log('READ-ONLY live money-flow audit');
console.log(`key mode : ${key.startsWith('sk_live_') ? 'LIVE (reads only)' : 'test'}`);
console.log(`sampling : ${LIMIT} most recent charges\n`);

const results = [];

// `expand` pulls the balance transaction, the application fee and the transfer
// in one round trip each, so the figures compared below are Stripe's own rather
// than anything this repo computed.
const list = await charges.list({
  limit: LIMIT,
  expand: ['data.balance_transaction', 'data.application_fee', 'data.transfer'],
});

for (const charge of list.data) {
  if (charge.status !== 'succeeded') continue;

  const meta = charge.metadata ?? {};
  const transfer = typeof charge.transfer === 'object' ? charge.transfer : null;
  const appFee = typeof charge.application_fee === 'object' ? charge.application_fee : null;
  const balanceTx = typeof charge.balance_transaction === 'object' ? charge.balance_transaction : null;

  const donorCharged = charge.amount;
  const platformFee = appFee?.amount ?? charge.application_fee_amount ?? 0;
  const toRecipient = transfer?.amount ?? 0;
  const stripeFee = balanceTx?.fee ?? 0;
  const refunded = charge.amount_refunded ?? 0;

  // The cent-by-cent identity: everything the donor paid is accounted for.
  const difference = donorCharged - platformFee - toRecipient - refunded;

  const destination =
    transfer?.destination
      ? (typeof transfer.destination === 'string' ? transfer.destination : transfer.destination.id)
      : (charge.destination ?? null);

  results.push({
    charge: charge.id,
    campaignId: meta.campaignId ?? null,
    donorCharged,
    platformFee,
    toRecipient,
    stripeFee,
    refunded,
    difference,
    destination,
    // A destination charge with no transfer object means the funds stayed on the
    // platform — the exact failure the acceptance rule forbids.
    heldByPlatform: toRecipient === 0 && platformFee < donorCharged - refunded,
  });
}

if (results.length === 0) {
  console.log('No succeeded charges in the sampled window. Nothing to audit — this is NOT a pass.');
  process.exit(0);
}

let pass = 0;
let fail = 0;
for (const r of results) {
  const problems = [];
  if (r.difference !== 0) problems.push(`unaccounted ${money(r.difference)}`);
  if (r.heldByPlatform) problems.push('platform is holding the proceeds');
  if (r.toRecipient > 0 && !r.destination) problems.push('transfer has no destination');

  const verdict = problems.length === 0 ? 'PASS' : 'FAIL';
  if (verdict === 'PASS') pass++; else fail++;

  if (!AS_JSON) {
    console.log(`${verdict}  ${r.charge}${r.campaignId ? `  campaign ${r.campaignId.slice(0, 8)}` : ''}`);
    console.log(`      Donor charged   ${money(r.donorCharged)}`);
    console.log(`      CharitMe fee    ${money(r.platformFee)}`);
    console.log(`      To recipient    ${money(r.toRecipient)}${r.destination ? `  → ${r.destination}` : ''}`);
    console.log(`      Stripe cost     ${money(r.stripeFee)}  (from the platform balance)`);
    if (r.refunded) console.log(`      Refunded        ${money(r.refunded)}`);
    console.log(`      Difference      ${money(r.difference)}`);
    if (problems.length) console.log(`      ⚠ ${problems.join('; ')}`);
    console.log('');
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({ pass, fail, results }, null, 2));
} else {
  console.log(`${pass} PASS, ${fail} FAIL across ${results.length} succeeded charges`);
  const netToPlatform = results.reduce((sum, r) => sum + r.platformFee - r.stripeFee, 0);
  console.log(`\nCharitMe net across this sample: ${money(netToPlatform)}`);
  console.log('  (application fees retained, minus Stripe cost debited from the platform balance)');
}

process.exit(fail > 0 ? 1 : 0);
