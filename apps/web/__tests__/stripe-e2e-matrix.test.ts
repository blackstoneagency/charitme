import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// §10 requires a twelve-scenario Stripe test-mode matrix. The matrix CREATES
// charges, refunds, disputes and connected accounts — against a live key that is
// real money and a real dispute fee.
//
// So the two things worth guarding without a key are: it refuses a live key, and
// it actually covers the twelve scenarios rather than a convincing subset.
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT = path.join(__dirname, '..', 'scripts', 'stripe-e2e-matrix.mjs');
const source = readFileSync(SCRIPT, 'utf8');

function run(key: string): { status: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT], {
      encoding: 'utf8',
      env: { ...process.env, STRIPE_SECRET_KEY: key },
      timeout: 20_000,
    });
    return { status: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('it cannot be pointed at production', () => {
  it('refuses a live key', () => {
    const { status, out } = run('sk_live_exampleexampleexample');
    expect(out).toMatch(/requires a TEST key/i);
    expect(status).not.toBe(0);
  });

  it('refuses an unset key', () => {
    const { status, out } = run('');
    expect(out).toMatch(/requires a TEST key/i);
    expect(status).not.toBe(0);
  });

  it('gates before constructing the client', () => {
    // ⚠️ The check must precede `new Stripe(...)` and any call. A gate placed
    // after the first request has already touched the live account.
    const gate = source.indexOf('/^(?:sk|rk)_test_/');
    const client = source.indexOf('new Stripe(');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(client);
  });
});

describe('it covers the twelve scenarios the audit names', () => {
  const REQUIRED = [
    'Successful donation',
    'Failed payment',
    'Duplicate checkout',
    'Campaign A vs Campaign B routing',
    'CharitMe fee allocation',
    'Full refund',
    'Partial refund',
    'Dispute',
    'Restricted owner',
    'Failed transfer',
    'Simultaneous donations',
    'Duplicate webhook',
  ];

  for (const scenario of REQUIRED) {
    it(`includes: ${scenario}`, () => {
      expect(source).toContain(scenario);
    });
  }

  it('prints every figure the audit asks for', () => {
    for (const label of [
      'Donor Charged',
      'CharitMe Fee',
      'Campaign Allocation',
      'Stripe Fee',
      'Refund/Adjustment',
      'Difference',
    ]) {
      expect(source, `${label} missing from the output`).toContain(label);
    }
  });
});

describe('the figures come from Stripe, not from our arithmetic', () => {
  it('reads the fee off the balance transaction', () => {
    // Restating what we SENT would prove nothing about what Stripe DID.
    expect(source).toContain('balanceTransaction?.fee');
  });

  it('reads the allocation off the transfer', () => {
    expect(source).toContain('transfer.amount - transfer.amount_reversed');
  });

  it('reads the platform fee off the application fee object', () => {
    expect(source).toContain('applicationFee.amount - applicationFee.amount_refunded');
  });

  it('computes the difference and fails the run when it is not zero', () => {
    // ⚠️ The identity was WRONG in the first version and real Stripe objects
    // exposed it. A destination charge transfers the GROSS amount and the
    // application fee is debited back from the connected account, so
    // `charged - fee - allocation` reported -$11.43 on seven correctly-routed
    // scenarios — accusing working code, with real evidence, which is the most
    // convincing way to be wrong. What holds is:
    //   charged        = allocation + adjustment
    //   netToRecipient = allocation - fee
    expect(source).toContain('const difference = charge.amount - adjustment - campaignNet - platformNet - stripeFee');
    expect(source).toContain('const platformNet = applicationFeeRemaining - stripeFee');
    expect(source).toMatch(/do not reconcile/);
  });
});

describe('duplicate webhook evidence is executable', () => {
  it('runs the webhook replay test and gates the scenario on its exit status', () => {
    // That idempotency is OURS, in record_donation keyed on p_stripe_event_id,
    // and needs the app plus Supabase running. Silently marking it PASS here
    // would be inventing evidence.
    expect(source).toContain('runWebhookReplayTest()');
    expect(source).toContain('webhookReplay.status === 0');
    expect(source).not.toMatch(/not re-proved here/);
  });
});
