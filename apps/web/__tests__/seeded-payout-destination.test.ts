import { describe, expect, it } from 'vitest';
import { accountIsPayoutReady, isSeededAccountId } from '../lib/payout-destination';

// ─────────────────────────────────────────────────────────────────────────────
// MEASURED IN PRODUCTION, 2026-08-11, against the live Stripe account and the
// live database:
//
//   Stripe charges / PaymentIntents / transfers : 0
//   Stripe connected accounts                   : 1  (charges_enabled = false)
//   DB connected_accounts rows                  : 501
//   ...with a fabricated `acct_<16 lowercase hex>` id : 500
//   ...of those, flagged verified + charges + payouts : 375
//   DB donations                                : 740 rows, $189,250
//
// The ids are MD5 prefixes — `acct_c4ca4238a0b92382` is md5("1") — written by a
// seed script. `accountIsPayoutReady` trusted the database's own flags, so 375
// fictional accounts were declared ready to receive other people's money. A real
// donation to any of those campaigns would have been built as a destination
// charge to a Stripe account that does not exist.
//
// The rejection is the fix, and its direction matters: being wrong here blocks a
// donation rather than misrouting one.
// ─────────────────────────────────────────────────────────────────────────────

const READY = {
  stripe_account_id: 'acct_1U0scbB26VOPUk5O',
  details_submitted: true,
  payouts_enabled: true,
  charges_enabled: true,
};

describe('recognising a seeded id', () => {
  it('flags the real fabricated ids found in production', () => {
    // md5("1"), md5("2"), md5("3"), md5("9") — verbatim from the live table.
    for (const id of [
      'acct_c4ca4238a0b92382',
      'acct_c81e728d9d4c2f63',
      'acct_eccbc87e4b5ce2fe',
      'acct_45c48cce2e2d7fbd',
    ]) {
      expect(isSeededAccountId(id), id).toBe(true);
    }
  });

  it('does NOT flag the real Stripe account on this platform', () => {
    // The other direction, and the one that matters: a guard that rejected
    // everything would block every genuine donation while passing every test
    // above.
    expect(isSeededAccountId('acct_1U0scbB26VOPUk5O')).toBe(false);
  });

  it('does not flag other genuine Stripe id shapes', () => {
    for (const id of ['acct_1AbCdEfGhIjKlMnO', 'acct_1032D82eZvKYlo2C', 'acct_19XJJ02eZvKYlo2C']) {
      expect(isSeededAccountId(id), id).toBe(false);
    }
  });

  it('is not fooled by length or by a non-account id', () => {
    expect(isSeededAccountId('acct_c4ca4238a0b923')).toBe(false);   // 14 chars
    expect(isSeededAccountId('acct_c4ca4238a0b9238201')).toBe(false); // 18 chars
    expect(isSeededAccountId('cus_c4ca4238a0b92382')).toBe(false);
    expect(isSeededAccountId(null)).toBe(false);
    expect(isSeededAccountId(undefined)).toBe(false);
  });
});

describe('payout readiness', () => {
  it('refuses a seeded account even when every flag says ready', () => {
    // ⚠️ This is the production state of 375 rows: verified, charges_enabled,
    // payouts_enabled, details_submitted — all true, all meaningless, because
    // the account does not exist at Stripe.
    expect(
      accountIsPayoutReady({
        stripe_account_id: 'acct_c4ca4238a0b92382',
        details_submitted: true,
        payouts_enabled: true,
        charges_enabled: true,
      }),
    ).toBe(false);
  });

  it('still accepts a genuine, fully onboarded account', () => {
    expect(accountIsPayoutReady(READY)).toBe(true);
  });

  it('still enforces every original condition', () => {
    // The seeded check is added to the existing rules, not substituted for them.
    expect(accountIsPayoutReady({ ...READY, details_submitted: false })).toBe(false);
    expect(accountIsPayoutReady({ ...READY, payouts_enabled: false })).toBe(false);
    expect(accountIsPayoutReady({ ...READY, charges_enabled: false })).toBe(false);
    expect(accountIsPayoutReady({ ...READY, stripe_account_id: null })).toBe(false);
    expect(accountIsPayoutReady(null)).toBe(false);
  });
});
