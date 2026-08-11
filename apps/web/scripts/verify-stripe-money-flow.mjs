// ─────────────────────────────────────────────────────────────────────────────
// LIVE verification of the three money promises, against real Stripe.
//
//   1. CharitMe never holds donation funds.
//   2. CharitMe's account is paid the service fee.
//   3. The recipient receives 100% of the donation.
//
//   npm run verify:money-flow --workspace=apps/web
//
// The unit suites (`donation-money-flow`, `recurring-money-flow`) pin the params
// CharitMe SENDS. This asserts what Stripe actually DOES with them — the balance
// transaction, the application fee, and the transfer — which is the only thing
// that can prove the promises rather than the intent.
//
// ⚠️ WHY THIS EXISTS AS A SCRIPT RATHER THAN A TEST. It needs a Stripe key, and
// this repo's sandbox has none: measured 2026-08-11, zero `STRIPE_*` environment
// variables and no `.env` file, while `curl https://api.stripe.com/v1/charges`
// answers 401 — the network works and Stripe answers; only the credential is
// absent. So the gap was never something a bot could close by trying harder. It
// needed a key, and this makes claiming it a single command once one exists.
//
// ⚠️ IT REFUSES A LIVE KEY, IN CODE. "Do not use production credentials in
// tests" is a rule that has to be enforced somewhere other than a comment: this
// script exits non-zero on any key that is not `sk_test_`. Running it cannot
// move real money even by accident.
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from 'stripe';

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');

/** Fail loudly and specifically — a vague failure here is a failure to verify. */
function fail(message, detail) {
  console.error(`\n❌ ${message}`);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

function ok(message) {
  if (!AS_JSON) console.log(`✅ ${message}`);
}

// ── 1. Credential gate ───────────────────────────────────────────────────────
const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key) {
  fail(
    'STRIPE_SECRET_KEY is not set — nothing was verified.',
    'This script deliberately does NOT fall back to a mock. A money-flow check\n'
    + 'that "passes" without touching Stripe is worse than no check at all: it\n'
    + 'reports the promises as proven when nothing was proven.\n\n'
    + 'Provide a TEST key from a staging environment:\n'
    + '  STRIPE_SECRET_KEY=sk_test_... npm run verify:money-flow --workspace=apps/web',
  );
}
if (!key.startsWith('sk_test_')) {
  fail(
    'Refusing to run: STRIPE_SECRET_KEY is not a test key.',
    'This script creates charges. Pointing it at a live key would move real\n'
    + "money belonging to real donors and organizers. Only `sk_test_` is accepted,\n"
    + 'and that rule is enforced here rather than left to the operator.',
  );
}

const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });

// Amounts chosen so every component is distinguishable in the assertions below:
// no two of donation / fee / total share a value.
const DONATION_CENTS = 5_000;   // $50.00 — must reach the recipient intact
const SERVICE_FEE_CENTS = 733;  // $7.33 — must reach CharitMe, and nothing else
const TOTAL_CENTS = DONATION_CENTS + SERVICE_FEE_CENTS;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  if (pass) ok(`${name}${detail ? ` — ${detail}` : ''}`);
  else console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // ── 2. A connected account to be the "campaign organizer" ──────────────────
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    capabilities: { transfers: { requested: true } },
  });
  ok(`created test connected account ${account.id}`);

  // ── 3. The charge, built exactly as /api/donations builds it ───────────────
  //
  // If this shape drifts from the route, this script stops proving anything
  // about production — so it is written to mirror `sessionParams` there:
  // a destination charge whose application_fee_amount is the service fee.
  const intent = await stripe.paymentIntents.create({
    amount: TOTAL_CENTS,
    currency: 'usd',
    payment_method_types: ['card'],
    application_fee_amount: SERVICE_FEE_CENTS,
    transfer_data: { destination: account.id },
    confirm: true,
    payment_method: 'pm_card_visa',
  });

  if (intent.status !== 'succeeded') {
    fail(`payment intent did not succeed (status: ${intent.status})`, intent.last_payment_error);
  }
  ok(`charge succeeded (${intent.id})`);

  const charge = await stripe.charges.retrieve(
    typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id,
    { expand: ['balance_transaction', 'transfer'] },
  );

  // ── 4. THE THREE PROMISES ──────────────────────────────────────────────────

  // (1) Never holds funds: a transfer to the connected account must exist, and
  //     it must have happened as part of the charge, not as a later payout.
  const transfer = charge.transfer;
  record(
    'CharitMe never holds the funds',
    Boolean(transfer) && transfer.destination === account.id,
    transfer ? `transfer ${transfer.id} → ${transfer.destination}` : 'NO TRANSFER — the charge landed on the platform',
  );

  // (3) The recipient receives 100% of the donation. Asserted on the TRANSFER
  //     amount, which is what actually arrives, not on our arithmetic.
  record(
    'Recipient receives the full donation',
    transfer?.amount === DONATION_CENTS,
    `transferred ${transfer?.amount} of ${DONATION_CENTS} expected`,
  );

  // (2) CharitMe is paid the service fee — and ONLY the service fee.
  record(
    'CharitMe is paid exactly the service fee',
    charge.application_fee_amount === SERVICE_FEE_CENTS,
    `application fee ${charge.application_fee_amount} of ${SERVICE_FEE_CENTS} expected`,
  );

  // And the arithmetic closes: nothing is unaccounted for.
  const accounted = (transfer?.amount ?? 0) + (charge.application_fee_amount ?? 0);
  record(
    'Every cent is accounted for',
    accounted === TOTAL_CENTS,
    `${accounted} accounted of ${TOTAL_CENTS} charged`,
  );

  // ── 5. Clean up so a staging account does not accumulate fixtures ──────────
  try {
    await stripe.accounts.del(account.id);
    ok(`cleaned up ${account.id}`);
  } catch {
    console.warn(`⚠️  could not delete test account ${account.id} — delete it manually`);
  }

  const failed = results.filter((r) => !r.pass);
  if (AS_JSON) console.log(JSON.stringify({ results, failed: failed.length }, null, 2));

  if (failed.length) {
    fail(`${failed.length} of ${results.length} money guarantees FAILED against real Stripe.`);
  }
  console.log(`\n✅ All ${results.length} money guarantees verified against real Stripe (test mode).`);
}

main().catch((err) => fail('verification could not complete', err instanceof Error ? err.stack : err));
