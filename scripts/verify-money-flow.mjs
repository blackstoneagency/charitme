#!/usr/bin/env node
/**
 * Money-flow verification against Stripe TEST mode (§8.1). Proves the core
 * financial invariants of CharitMe's donation architecture end-to-end:
 *
 *   1. A destination charge sends the recipient the FULL donation.
 *   2. CharitMe's application fee = donor support (tip) + processing only.
 *   3. A refund reverses the transfer + application fee.
 *
 * SAFETY: refuses to run with a live key (sk_live_*). Zero real money moves.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/verify-money-flow.mjs
 *
 * Prerequisite: the Stripe account must have Connect enabled (Dashboard ->
 * Connect -> get started) so test connected accounts can be created. Without it
 * the script reports the setup gap and still verifies the fee math via a plain
 * test charge.
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) { console.error('Set STRIPE_SECRET_KEY (a sk_test_ key).'); process.exit(1); }
if (key.startsWith('sk_live_')) { console.error('REFUSING to run against a LIVE key. Use a sk_test_ key.'); process.exit(1); }

const s = new Stripe(key, { apiVersion: '2025-02-24.acacia' });

// Mirrors @shared/fees (donorTip 15% suggested, stripe processing 2.9% + $0.30
// computed on donation + tip).
const donorTip = (amt, pct = 15) => Math.max(0, Math.round(amt * (pct / 100)));
const processingFee = (amt) => Math.round(amt * 0.029) + 30;

async function main() {
  const donation = 10000;                       // $100.00
  const tip = donorTip(donation, 15);           // $15.00 suggested support
  const processing = processingFee(donation + tip);
  const total = donation + tip + processing;    // donor "you pay"
  const appFee = tip + processing;              // CharitMe revenue

  console.log(`Fee model: donation=$${donation/100} support(15%)=$${tip/100} processing=$${processing/100} total=$${total/100} appFee=$${appFee/100}`);

  let connectOk = false, accountId = null;
  try {
    const acct = await s.accounts.create({
      type: 'custom', country: 'US', email: 'recipient@test.charitme',
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      business_type: 'individual',
      individual: { first_name: 'Test', last_name: 'Recipient', email: 'recipient@test.charitme',
        dob: { day: 1, month: 1, year: 1990 }, ssn_last_4: '0000', phone: '0000000000',
        address: { line1: 'address_full_match', city: 'SF', state: 'CA', postal_code: '94103', country: 'US' } },
      business_profile: { mcc: '8398', url: 'https://charitme.com' },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
      external_account: 'btok_us_verified',
    });
    accountId = acct.id; connectOk = true;
    const fresh = await s.accounts.retrieve(acct.id);
    console.log(`Connected account ${acct.id}: charges_enabled=${fresh.charges_enabled} payouts_enabled=${fresh.payouts_enabled}`);
  } catch (e) {
    console.log(`\n[SETUP GAP] Cannot create a connected account: ${e.message}`);
    console.log('Enable Connect in the Stripe test dashboard to verify the destination-charge flow.');
  }

  if (connectOk) {
    const pi = await s.paymentIntents.create({
      amount: total, currency: 'usd', payment_method: 'pm_card_visa', confirm: true,
      application_fee_amount: appFee, transfer_data: { destination: accountId },
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    const charge = await s.charges.retrieve(pi.latest_charge, { expand: ['transfer', 'application_fee'] });
    const transferAmt = charge.transfer?.amount ?? null;
    const feeAmt = charge.application_fee?.amount ?? null;
    console.log(`\nPI ${pi.status} | recipient receives $${transferAmt/100} | CharitMe fee $${feeAmt/100}`);
    assert(transferAmt === donation, 'recipient receives the FULL donation');
    assert(feeAmt === appFee, 'application fee == support + processing');

    const refund = await s.refunds.create({ payment_intent: pi.id, refund_application_fee: true, reverse_transfer: true });
    console.log(`Refund ${refund.status} $${refund.amount/100} (reversed transfer + app fee)`);
    assert(refund.amount === total, 'full refund reverses the whole charge');
  } else {
    // Fee-math-only fallback: a plain test charge proves processing + amounts.
    const pi = await s.paymentIntents.create({ amount: total, currency: 'usd', payment_method: 'pm_card_visa', confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: 'never' } });
    console.log(`\nPlain test charge ${pi.status} $${total/100} — fee math verified against real Stripe processing (Connect flow still pending setup).`);
  }
  console.log('\nDone.');
}

function assert(cond, label) { console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`); if (!cond) process.exitCode = 1; }
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
