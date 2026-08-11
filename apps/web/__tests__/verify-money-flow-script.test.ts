import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/verify-stripe-money-flow.mjs');
const src = readFileSync(script, 'utf8');

/** Run the script and return { code, output }, never throwing on non-zero. */
function run(env: Record<string, string | undefined>) {
  try {
    const out = execFileSync('node', [script], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, STRIPE_SECRET_KEY: undefined, ...env },
    });
    return { code: 0, output: out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The live money-flow verifier exists because the unit suites can only pin what
// CharitMe SENDS to Stripe; only a real charge shows what Stripe DOES. This
// sandbox has no Stripe credential — measured: zero `STRIPE_*` env vars, no
// `.env`, and a 401 from api.stripe.com, i.e. the network works and the secret
// is simply absent — so the script cannot be executed here.
//
// What CAN be guarded here are its two refusals, and both are load-bearing:
//
//   · Without a key it must FAIL, not skip. A money check that exits 0 having
//     touched nothing reports the guarantees as proven when nothing was proven,
//     which is worse than having no check.
//   · With a LIVE key it must refuse. "Do not use production credentials in
//     tests" cannot live only in a comment when the script creates charges.
// ─────────────────────────────────────────────────────────────────────────────

describe('the verifier refuses to produce a meaningless pass', () => {
  it('exits NON-ZERO when no key is set', () => {
    const { code, output } = run({});
    expect(code, 'a missing key must fail, never skip').not.toBe(0);
    expect(output).toContain('nothing was verified');
  });

  it('says explicitly that it does not fall back to a mock', () => {
    // The failure text is the thing that stops someone "fixing" this by adding
    // a stub, so it is pinned rather than left to prose.
    const { output } = run({});
    expect(output).toMatch(/does NOT fall back to a mock/i);
  });
});

describe('the verifier refuses production credentials, in code', () => {
  it('exits NON-ZERO on a live key', () => {
    const { code, output } = run({ STRIPE_SECRET_KEY: 'sk_live_not_a_real_key' });
    expect(code).not.toBe(0);
    expect(output).toMatch(/not a test key/i);
  });

  it('rejects anything that is not sk_test_, not merely sk_live_', () => {
    // A blocklist of 'sk_live_' would pass a restricted or platform key. The
    // check is an allowlist, and this proves it by using a key that is neither.
    const { code } = run({ STRIPE_SECRET_KEY: 'rk_prod_restricted_key' });
    expect(code).not.toBe(0);
    expect(src).toMatch(/startsWith\('sk_test_'\)/);
  });
});

describe('it asserts what Stripe DID, not what we sent', () => {
  it('reads the transfer amount rather than recomputing it', () => {
    // The whole point: our own arithmetic proves nothing about settlement. The
    // assertions must come off the retrieved charge/transfer.
    expect(src).toMatch(/transfer\?\.amount === DONATION_CENTS/);
    expect(src).toMatch(/charge\.application_fee_amount === SERVICE_FEE_CENTS/);
  });

  it('checks the money adds up, so nothing can be unaccounted for', () => {
    expect(src).toMatch(/Every cent is accounted for/);
  });

  it('uses amounts where no two components collide', () => {
    // If the donation and the fee were equal, an assertion could pass while the
    // two were swapped.
    const donation = /const DONATION_CENTS = ([\d_]+)/.exec(src)?.[1]?.replace(/_/g, '');
    const fee = /const SERVICE_FEE_CENTS = ([\d_]+)/.exec(src)?.[1]?.replace(/_/g, '');
    expect(donation).toBeDefined();
    expect(fee).toBeDefined();
    expect(Number(donation)).not.toBe(Number(fee));
    expect(Number(donation) + Number(fee)).not.toBe(Number(donation));
  });
});
