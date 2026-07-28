import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ONE_TIME_PAYMENT_METHOD_TYPES } from '../lib/stripe-payment-methods';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// A payment method must not be advertised unless checkout accepts it.
//
// /fees published PayPal at 3.49% + $0.49 and Venmo at 1.9% + $0.10 as
// processing-fee tiers, /transparency said "your card (or bank/PayPal/Venmo) is
// charged", and the money calculator offered both as selectable methods with
// those rates — while `paypal_payments` is NOT active on the Stripe account, so
// ONE_TIME_PAYMENT_METHOD_TYPES omits paypal entirely and POST /api/donations
// normalizes `paypal`/`venmo` to `card`.
//
// The fee angle is what makes it more than stale copy: Venmo's advertised rate
// is CHEAPER than card. A donor sizing their "I'll cover the processing fee"
// contribution off 1.9% + $0.10 is quoted a price they can never be charged at,
// and pays 2.9% + $0.30 instead.
//
// `PaymentMethod` in @shared/fees deliberately still includes paypal/venmo — the
// API accepts and normalizes them so a stale cached client cannot 400 and lose a
// real donation. This pins the *donor-facing* surface, which is the promise.
// ─────────────────────────────────────────────────────────────────────────────

const UNAVAILABLE = ['paypal', 'venmo'] as const;

describe('the public site does not advertise payment methods checkout rejects', () => {
  it('paypal is genuinely not in the accepted set', () => {
    // Guards every assertion below from going stale if the capability is enabled:
    // once paypal is added to ONE_TIME_PAYMENT_METHOD_TYPES this fails, which is
    // the prompt to restore the copy rather than leave it wrong in the other
    // direction.
    expect(ONE_TIME_PAYMENT_METHOD_TYPES).not.toContain('paypal');
  });

  it.each([
    ['app/fees/page.tsx'],
    ['app/transparency/page.tsx'],
    ['app/transparency/MoneyCalculator.tsx'],
  ])('%s does not offer an unavailable method', (path) => {
    const src = read(path);
    for (const method of UNAVAILABLE) {
      // Allow the words inside a comment or an explicit "not accepted" note;
      // disallow them as a selectable option or an advertised rate.
      const offending = src
        .split('\n')
        .filter((line) => new RegExp(method, 'i').test(line))
        .filter((line) => !/^\s*(\/\/|\*|\{\/\*)/.test(line))
        .filter((line) => !/not currently accepted|not active|are not accepted/i.test(line));
      expect(offending, `${path} still offers ${method}`).toEqual([]);
    }
  });

  it('the fee page still documents the methods that DO work', () => {
    // The fix must not become "delete the fee table" — donors need the rates.
    const src = read('app/fees/page.tsx');
    expect(src).toMatch(/2\.9% \+ \$0\.30/);
    expect(src).toMatch(/0\.8%/);
  });
});
