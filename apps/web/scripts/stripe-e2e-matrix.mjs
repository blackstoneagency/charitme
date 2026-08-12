import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';

const stdinKey = process.argv.includes('--key-stdin') ? readFileSync(0, 'utf8').trim() : '';
const key = (process.env.STRIPE_SECRET_KEY ?? stdinKey).trim();
if (!/^(?:sk|rk)_test_/.test(key)) {
  console.error(
    '\nThis script creates charges, refunds, disputes, connected accounts, and payouts. ' +
    'It requires a TEST key.\n',
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
const DONATION = 10_000;
const TIP = 800;
const PROCESSING = processorCostCoverage(DONATION + TIP);
const TOTAL = DONATION + TIP + PROCESSING;
const APPLICATION_FEE = TIP + PROCESSING;
const rows = [];
const evidence = {
  generatedAt: new Date().toISOString(),
  stripeAccountId: null,
  architecture: 'destination_charges',
  constants: { donationCents: DONATION, tipCents: TIP, processingCents: PROCESSING, totalCents: TOTAL },
  scenarios: [],
};

function processorCost(amountCents) {
  return Math.round(amountCents * 0.029) + 30;
}

function processorCostCoverage(baseCents) {
  let coverage = processorCost(baseCents);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const next = processorCost(baseCents + coverage);
    if (next === coverage) return coverage;
    coverage = next;
  }
  throw new Error('Processing coverage did not converge');
}

function money(cents) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptySnapshot() {
  return {
    charged: 0,
    platformNet: 0,
    campaignNet: 0,
    stripeFee: 0,
    adjustment: 0,
    difference: 0,
    objectIds: {},
  };
}

function combineSnapshots(...snapshots) {
  const combined = emptySnapshot();
  for (const snapshot of snapshots) {
    combined.charged += snapshot.charged;
    combined.platformNet += snapshot.platformNet;
    combined.campaignNet += snapshot.campaignNet;
    combined.stripeFee += snapshot.stripeFee;
    combined.adjustment += snapshot.adjustment;
    combined.difference += snapshot.difference;
  }
  combined.objectIds = { combinedCharges: snapshots.map((snapshot) => snapshot.objectIds.chargeId) };
  return combined;
}

function record(name, snapshot, passed, note, extraEvidence = {}) {
  const finalPass = Boolean(passed) && snapshot.difference === 0;
  const row = { name, ...snapshot, passed: finalPass, note };
  rows.push(row);
  evidence.scenarios.push({ ...row, ...extraEvidence });
  console.log(`\n${finalPass ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`   Donor Charged       ${money(snapshot.charged)}`);
  console.log(`   CharitMe Fee        ${money(snapshot.platformNet)}`);
  console.log(`   Campaign Allocation${money(snapshot.campaignNet).padStart(12)}`);
  console.log(`   Stripe Fee          ${money(snapshot.stripeFee)}`);
  console.log(`   Refund/Adjustment   ${money(snapshot.adjustment)}`);
  console.log(`   Difference          ${money(snapshot.difference)}`);
  if (note) console.log(`   ${note}`);
}

async function organizer(label, accountNumber = '000123456789') {
  return stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email: `${label}@charitme.invalid`,
    capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    business_type: 'individual',
    individual: {
      first_name: 'Jenny',
      last_name: 'Rosen',
      email: `${label}@charitme.invalid`,
      phone: '+15555555555',
      dob: { day: 1, month: 1, year: 1901 },
      address: {
        line1: 'address_full_match',
        city: 'South San Francisco',
        state: 'CA',
        postal_code: '94080',
        country: 'US',
      },
      ssn_last_4: '0000',
      id_number: '000000000',
    },
    business_profile: {
      mcc: '8398',
      url: 'https://www.charitme.com',
      product_description: 'Fundraising campaign payouts',
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '8.8.8.8' },
    external_account: {
      object: 'bank_account',
      country: 'US',
      currency: 'usd',
      routing_number: '110000000',
      account_number: accountNumber,
    },
    metadata: { audit: 'stripe-funds-flow', scenario: label },
  });
}

async function donate(destination, { paymentMethod = 'pm_card_visa', idempotencyKey } = {}) {
  return stripe.paymentIntents.create(
    {
      amount: TOTAL,
      currency: 'usd',
      payment_method_types: ['card'],
      application_fee_amount: APPLICATION_FEE,
      transfer_data: { destination },
      confirm: true,
      payment_method: paymentMethod,
      metadata: {
        audit: 'stripe-funds-flow',
        donationAmountCents: String(DONATION),
        tipCents: String(TIP),
        processingFeeCents: String(PROCESSING),
        ownerNetCents: String(DONATION),
        connectedAccountId: destination,
      },
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}

async function chargeOf(intent) {
  const chargeId = typeof intent.latest_charge === 'string'
    ? intent.latest_charge
    : intent.latest_charge?.id;
  if (!chargeId) throw new Error(`PaymentIntent ${intent.id} has no charge`);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.balance_transaction && charge.application_fee && charge.transfer) return charge;
    await sleep(500);
  }
  throw new Error(`Charge ${chargeId} never exposed its fee, transfer, and balance transaction`);
}

async function expandedSnapshot(charge) {
  const balanceTransactionId = typeof charge.balance_transaction === 'string'
    ? charge.balance_transaction
    : charge.balance_transaction?.id;
  const applicationFeeId = typeof charge.application_fee === 'string'
    ? charge.application_fee
    : charge.application_fee?.id;
  const transferId = typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.id;

  const [balanceTransaction, applicationFee, transfer] = await Promise.all([
    balanceTransactionId ? stripe.balanceTransactions.retrieve(balanceTransactionId) : null,
    applicationFeeId ? stripe.applicationFees.retrieve(applicationFeeId) : null,
    transferId ? stripe.transfers.retrieve(transferId) : null,
  ]);

  const applicationFeeRemaining = applicationFee
    ? applicationFee.amount - applicationFee.amount_refunded
    : 0;
  const transferRemaining = transfer ? transfer.amount - transfer.amount_reversed : 0;
  const stripeFee = balanceTransaction?.fee ?? 0;
  const platformNet = applicationFeeRemaining - stripeFee;
  const campaignNet = transferRemaining - applicationFeeRemaining;
  const adjustment = charge.amount_refunded ?? 0;
  const difference = charge.amount - adjustment - campaignNet - platformNet - stripeFee;

  return {
    charged: charge.amount,
    platformNet,
    campaignNet,
    stripeFee,
    adjustment,
    difference,
    objectIds: {
      paymentIntentId: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id,
      chargeId: charge.id,
      balanceTransactionId,
      applicationFeeId,
      transferId,
      destinationAccountId: typeof transfer?.destination === 'string' ? transfer.destination : transfer?.destination?.id,
    },
    applicationFee,
    transfer,
    balanceTransaction,
  };
}

async function pollPayout(payoutId, stripeAccountId, expectedStatuses, timeoutMs = 90_000) {
  const started = Date.now();
  let payout = await stripe.payouts.retrieve(payoutId, {}, { stripeAccount: stripeAccountId });
  while (!expectedStatuses.includes(payout.status) && Date.now() - started < timeoutMs) {
    await sleep(2_000);
    payout = await stripe.payouts.retrieve(payoutId, {}, { stripeAccount: stripeAccountId });
  }
  return payout;
}

async function waitForAvailableBalance(stripeAccountId, amountCents) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const balance = await stripe.balance.retrieve({}, { stripeAccount: stripeAccountId });
    const available = balance.available.find((entry) => entry.currency === 'usd')?.amount ?? 0;
    if (available >= amountCents) return available;
    await sleep(1_000);
  }
  throw new Error(`Connected account ${stripeAccountId} never reached an available balance of ${amountCents}`);
}

function runWebhookReplayTest() {
  const vitestEntry = fileURLToPath(new URL('./vitest.mjs', import.meta.resolve('vitest/package.json')));
  const webRoot = fileURLToPath(new URL('..', import.meta.url));
  return spawnSync(
    process.execPath,
    [vitestEntry, 'run', '__tests__/stripe-webhook-behaviour.test.ts', '--reporter=dot'],
    { cwd: webRoot, encoding: 'utf8', env: process.env },
  );
}

async function main() {
  const account = await stripe.accounts.retrieve();
  evidence.stripeAccountId = account.id;
  console.log(`Stripe test account: ${account.id}`);
  console.log(`Fee fixture: ${money(DONATION)} donation + ${money(TIP)} tip + ${money(PROCESSING)} processing = ${money(TOTAL)}`);

  const acctA = await organizer(`campaign-a-${Date.now()}`);
  const intentA = await donate(acctA.id);
  const chargeA = await chargeOf(intentA);
  const snapshotA = await expandedSnapshot(chargeA);
  record(
    '1. Successful donation',
    snapshotA,
    snapshotA.campaignNet === DONATION
      && snapshotA.platformNet === TIP
      && snapshotA.stripeFee === PROCESSING
      && snapshotA.objectIds.destinationAccountId === acctA.id,
    `PaymentIntent ${intentA.id}; Charge ${chargeA.id}; Transfer ${snapshotA.objectIds.transferId}; destination ${acctA.id}`,
  );

  let declined = null;
  try {
    await donate(acctA.id, { paymentMethod: 'pm_card_chargeDeclined' });
  } catch (error) {
    declined = error;
  }
  record(
    '2. Failed payment',
    emptySnapshot(),
    Boolean(declined),
    declined ? `Declined without a transfer: ${declined.code ?? declined.type ?? 'card_error'}` : 'Card was not declined',
  );

  const duplicateKey = `matrix-duplicate-${Date.now()}`;
  const duplicateOne = await donate(acctA.id, { idempotencyKey: duplicateKey });
  const duplicateTwo = await donate(acctA.id, { idempotencyKey: duplicateKey });
  const duplicateCharge = await chargeOf(duplicateOne);
  const duplicateSnapshot = await expandedSnapshot(duplicateCharge);
  record(
    '3. Duplicate checkout',
    duplicateSnapshot,
    duplicateOne.id === duplicateTwo.id,
    `One PaymentIntent ${duplicateOne.id} returned for both submissions`,
  );

  const acctB = await organizer(`campaign-b-${Date.now()}`);
  const intentB = await donate(acctB.id);
  const chargeB = await chargeOf(intentB);
  const snapshotB = await expandedSnapshot(chargeB);
  record(
    '4. Campaign A vs Campaign B routing',
    snapshotB,
    snapshotA.objectIds.destinationAccountId === acctA.id
      && snapshotB.objectIds.destinationAccountId === acctB.id
      && snapshotB.objectIds.destinationAccountId !== acctA.id,
    `Campaign A -> ${snapshotA.objectIds.destinationAccountId}; Campaign B -> ${snapshotB.objectIds.destinationAccountId}`,
  );

  record(
    '5. CharitMe fee allocation',
    snapshotA,
    snapshotA.applicationFee?.amount === APPLICATION_FEE
      && snapshotA.platformNet === TIP
      && snapshotA.stripeFee === PROCESSING,
    `Application Fee ${snapshotA.objectIds.applicationFeeId} gross ${money(APPLICATION_FEE)}; CharitMe net ${money(TIP)}`,
  );

  const fullIntent = await donate(acctA.id);
  const fullCharge = await chargeOf(fullIntent);
  const fullRefund = await stripe.refunds.create({
    charge: fullCharge.id,
    reverse_transfer: true,
    refund_application_fee: true,
    metadata: { donation_principal_cents: String(DONATION), audit: 'stripe-funds-flow' },
  });
  const fullAfter = await chargeOf(fullIntent);
  const fullSnapshot = await expandedSnapshot(fullAfter);
  record(
    '6. Full refund',
    fullSnapshot,
    fullRefund.status === 'succeeded'
      && fullSnapshot.adjustment === TOTAL
      && fullSnapshot.campaignNet === 0,
    `Refund ${fullRefund.id}; transfer reversed ${money(fullSnapshot.transfer?.amount_reversed ?? 0)}`,
    { refundId: fullRefund.id },
  );

  const partialIntent = await donate(acctA.id);
  const partialCharge = await chargeOf(partialIntent);
  const principalHalf = Math.floor(DONATION / 2);
  const partialGross = Math.round((principalHalf * TOTAL) / DONATION);
  const partialRefund = await stripe.refunds.create({
    charge: partialCharge.id,
    amount: partialGross,
    reverse_transfer: true,
    refund_application_fee: true,
    metadata: { donation_principal_cents: String(principalHalf), audit: 'stripe-funds-flow' },
  });
  const partialAfter = await chargeOf(partialIntent);
  const partialSnapshot = await expandedSnapshot(partialAfter);
  record(
    '7. Partial refund',
    partialSnapshot,
    partialRefund.status === 'succeeded'
      && partialSnapshot.adjustment === partialGross
      && Math.abs(partialSnapshot.campaignNet - principalHalf) <= 1,
    `Refund ${partialRefund.id}; requested principal ${money(principalHalf)}; donor adjustment ${money(partialGross)}`,
    { refundId: partialRefund.id, requestedPrincipalCents: principalHalf },
  );

  const disputeIntent = await donate(acctA.id, { paymentMethod: 'pm_card_createDispute' });
  const disputeCharge = await chargeOf(disputeIntent);
  let dispute = null;
  for (let attempt = 0; attempt < 30 && !dispute; attempt += 1) {
    const list = await stripe.disputes.list({ charge: disputeCharge.id, limit: 1 });
    dispute = list.data[0] ?? null;
    if (!dispute) await sleep(1_000);
  }
  const disputeSnapshot = await expandedSnapshot(disputeCharge);
  record(
    '8. Dispute',
    disputeSnapshot,
    Boolean(dispute),
    dispute ? `Dispute ${dispute.id}; status ${dispute.status}; amount ${money(dispute.amount)}` : 'No dispute was created',
    { disputeId: dispute?.id ?? null },
  );

  const restricted = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    metadata: { audit: 'stripe-funds-flow', scenario: 'restricted-owner' },
  });
  let restrictedError = null;
  try {
    await donate(restricted.id);
  } catch (error) {
    restrictedError = error;
  }
  record(
    '9. Restricted owner',
    emptySnapshot(),
    Boolean(restrictedError),
    restrictedError ? `Charge refused for restricted account ${restricted.id}` : 'Charge unexpectedly succeeded',
    { restrictedAccountId: restricted.id },
  );

  const failedPayoutAccount = await organizer(`failed-payout-${Date.now()}`, '000111111116');
  const failedPayoutIntent = await donate(failedPayoutAccount.id, { paymentMethod: 'pm_card_bypassPending' });
  const failedPayoutCharge = await chargeOf(failedPayoutIntent);
  const failedPayoutSnapshot = await expandedSnapshot(failedPayoutCharge);
  await waitForAvailableBalance(failedPayoutAccount.id, DONATION);
  const createdFailedPayout = await stripe.payouts.create(
    { amount: DONATION, currency: 'usd', method: 'standard', metadata: { audit: 'stripe-funds-flow' } },
    { stripeAccount: failedPayoutAccount.id },
  );
  const failedPayout = await pollPayout(createdFailedPayout.id, failedPayoutAccount.id, ['failed', 'canceled']);
  record(
    '10. Failed transfer/payout',
    failedPayoutSnapshot,
    failedPayout.status === 'failed' || failedPayout.status === 'canceled',
    `Payout ${failedPayout.id}; status ${failedPayout.status}; failure ${failedPayout.failure_code ?? 'none'}`,
    { payoutId: failedPayout.id, connectedAccountId: failedPayoutAccount.id, payoutStatus: failedPayout.status },
  );

  const [simA, simB] = await Promise.all([
    donate(acctA.id, { idempotencyKey: `sim-a-${Date.now()}` }),
    donate(acctB.id, { idempotencyKey: `sim-b-${Date.now()}` }),
  ]);
  const [simChargeA, simChargeB] = await Promise.all([chargeOf(simA), chargeOf(simB)]);
  const [simSnapshotA, simSnapshotB] = await Promise.all([
    expandedSnapshot(simChargeA),
    expandedSnapshot(simChargeB),
  ]);
  const simultaneousSnapshot = combineSnapshots(simSnapshotA, simSnapshotB);
  record(
    '11. Simultaneous donations',
    simultaneousSnapshot,
    simSnapshotA.objectIds.destinationAccountId === acctA.id
      && simSnapshotB.objectIds.destinationAccountId === acctB.id,
    `A ${simA.id} -> ${acctA.id}; B ${simB.id} -> ${acctB.id}`,
  );

  const webhookReplay = runWebhookReplayTest();
  record(
    '12. Duplicate webhook',
    emptySnapshot(),
    webhookReplay.status === 0,
    webhookReplay.status === 0
      ? 'Executable webhook replay test passed in this run; the duplicate event produced one donation write'
      : `Webhook replay test failed: ${(webhookReplay.stderr || webhookReplay.stdout || '').slice(0, 200)}`,
  );

  const payoutAccount = await organizer(`paid-payout-${Date.now()}`);
  const payoutIntent = await donate(payoutAccount.id, { paymentMethod: 'pm_card_bypassPending' });
  const payoutCharge = await chargeOf(payoutIntent);
  const payoutSnapshot = await expandedSnapshot(payoutCharge);
  await waitForAvailableBalance(payoutAccount.id, DONATION);
  const createdPayout = await stripe.payouts.create(
    { amount: DONATION, currency: 'usd', method: 'standard', metadata: { audit: 'stripe-funds-flow' } },
    { stripeAccount: payoutAccount.id },
  );
  const paidPayout = await pollPayout(createdPayout.id, payoutAccount.id, ['paid', 'failed', 'canceled']);
  evidence.bankPayoutProof = {
    connectedAccountId: payoutAccount.id,
    paymentIntentId: payoutIntent.id,
    chargeId: payoutCharge.id,
    transferId: payoutSnapshot.objectIds.transferId,
    payoutId: paidPayout.id,
    status: paidPayout.status,
    amountCents: paidPayout.amount,
  };

  const failures = rows.filter((row) => !row.passed);
  const unbalanced = rows.filter((row) => row.difference !== 0);
  evidence.summary = {
    passed: rows.length - failures.length,
    total: rows.length,
    allDifferencesZero: unbalanced.length === 0,
    bankPayoutPaid: paidPayout.status === 'paid',
  };
  const evidencePath = fileURLToPath(new URL('../../../docs/payments/stripe-test-evidence.latest.json', import.meta.url));
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  console.log('\n------------------------------------------------------------');
  console.log(`${rows.length - failures.length}/${rows.length} scenarios PASS`);
  console.log(unbalanced.length === 0 ? 'Every scenario reconciles to $0.00.' : `${unbalanced.length} scenario(s) do not reconcile.`);
  console.log(`Bank payout proof: ${paidPayout.id} status=${paidPayout.status} amount=${money(paidPayout.amount)}`);
  console.log(`Evidence: ${evidencePath}`);
  if (failures.length > 0 || unbalanced.length > 0 || paidPayout.status !== 'paid') process.exit(1);
}

main().catch((error) => {
  console.error(`\nMatrix aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
