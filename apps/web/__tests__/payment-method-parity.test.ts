import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { METHOD_FEES } from '@shared/fees';
import { ONE_TIME_PAYMENT_METHOD_TYPES } from '../lib/stripe-payment-methods';

// Guard against a real bug we shipped once: the donate form offered PayPal and
// Venmo (each with its own processing-fee rate) while Stripe Checkout could only
// fulfil card/link/cashapp/us_bank_account/amazon_pay/klarna/afterpay. Donors were
// quoted a fee for a method they could never use — and Venmo's lower rate
// under-collected the real card cost, which the platform absorbed.
//
// Every method the donor can pick must map to something Checkout actually offers.
const UI_METHOD_TO_CHECKOUT: Record<string, string> = {
  stripe: 'card',            // generic card rail
  card: 'card',
  gpay: 'card',              // Google Pay is a wallet surfaced under `card`
  bank: 'us_bank_account',   // ACH
};

function uiOptionIds(): string[] {
  const src = readFileSync(join(__dirname, '../app/campaigns/[slug]/DonateButton.tsx'), 'utf8');
  const block = src.slice(src.indexOf('const PAY_OPTIONS'), src.indexOf('];', src.indexOf('const PAY_OPTIONS')));
  return [...block.matchAll(/id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('donor payment-method parity with Stripe Checkout', () => {
  it('offers at least one method', () => {
    expect(uiOptionIds().length).toBeGreaterThan(0);
  });

  it('every offered method maps to an enabled Checkout payment type', () => {
    for (const id of uiOptionIds()) {
      const mapped = UI_METHOD_TO_CHECKOUT[id];
      expect(mapped, `donate form offers "${id}" with no Checkout mapping — donors would be quoted a fee for a method they cannot use`).toBeDefined();
      expect(ONE_TIME_PAYMENT_METHOD_TYPES as readonly string[], `"${id}" maps to "${mapped}", which Checkout does not enable`).toContain(mapped);
    }
  });

  it('every offered method has a fee config', () => {
    for (const id of uiOptionIds()) {
      expect(METHOD_FEES[id as keyof typeof METHOD_FEES], `no METHOD_FEES entry for "${id}"`).toBeDefined();
    }
  });

  it('card-rail methods quote the true card rate (no under/over-collection)', () => {
    const card = METHOD_FEES.card;
    for (const id of uiOptionIds()) {
      if (UI_METHOD_TO_CHECKOUT[id] !== 'card') continue;
      const fee = METHOD_FEES[id as keyof typeof METHOD_FEES];
      expect(fee.pct, `"${id}" settles as a card payment but quotes ${fee.pct}% instead of ${card.pct}%`).toBe(card.pct);
      expect(fee.fixed, `"${id}" settles as a card payment but quotes ${fee.fixed}c fixed instead of ${card.fixed}c`).toBe(card.fixed);
    }
  });

  it('does not offer PayPal or Venmo (not fulfillable by Checkout here)', () => {
    const ids = uiOptionIds();
    expect(ids).not.toContain('paypal');
    expect(ids).not.toContain('venmo');
  });
});
