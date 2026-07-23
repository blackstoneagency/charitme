import { describe, it, expect } from 'vitest';
import {
  nextPaymentMethodTypes,
  ONE_TIME_PAYMENT_METHOD_TYPES,
  RECURRING_PAYMENT_METHOD_TYPES,
  type PaymentMethodType,
} from '../lib/stripe-payment-methods';

const pm = (...m: string[]) => m as PaymentMethodType[];

describe('nextPaymentMethodTypes (checkout retry recovery)', () => {
  const full = pm('card', 'link', 'cashapp', 'us_bank_account', 'amazon_pay', 'klarna', 'afterpay_clearpay');

  it('strips the exact method when Stripe reports an index', () => {
    // payment_method_types[3] === us_bank_account
    expect(nextPaymentMethodTypes(full, 'payment_method_types[3]', 'whatever')).toEqual(
      ['card', 'link', 'cashapp', 'amazon_pay', 'klarna', 'afterpay_clearpay'],
    );
  });

  it('strips only the NAMED method when the param has no index (the real prod case)', () => {
    // This is the bug that collapsed everything to card-only: bare param +
    // method named in the message. Must strip only paypal, keep the rest.
    const withPaypal = pm('card','link','cashapp','paypal','amazon_pay');
    expect(
      nextPaymentMethodTypes(withPaypal, 'payment_method_types', 'The payment method type provided: paypal is invalid. Please ensure the provided type is activated in your dashboard'),
    ).toEqual(['card', 'link', 'cashapp', 'amazon_pay']);
  });

  it('handles the quoted message variant', () => {
    const withPaypal = pm('card','paypal');
    expect(
      nextPaymentMethodTypes(withPaypal, 'payment_method_types', 'The payment method type "paypal" is invalid.'),
    ).toEqual(['card']);
  });

  it('falls back to card-only only when the culprit cannot be identified', () => {
    expect(nextPaymentMethodTypes(pm('card','link','cashapp'), 'payment_method_types', 'some opaque error with no method name')).toEqual(['card']);
  });

  it('never strips card itself', () => {
    expect(nextPaymentMethodTypes(pm('card','link'), 'payment_method_types', 'The payment method type provided: card is invalid')).toEqual(['card']);
  });

  it('returns card-only for an empty list', () => {
    expect(nextPaymentMethodTypes([], 'payment_method_types', 'x')).toEqual(['card']);
  });
});

describe('payment method lists reflect the active Stripe account', () => {
  it('does not offer paypal or affirm (not active on the live account — would collapse the session)', () => {
    expect(ONE_TIME_PAYMENT_METHOD_TYPES).not.toContain('paypal');
    expect(ONE_TIME_PAYMENT_METHOD_TYPES).not.toContain('affirm');
    expect(RECURRING_PAYMENT_METHOD_TYPES).not.toContain('paypal');
  });

  it('offers the 7 verified-active one-time methods incl. card first', () => {
    expect(ONE_TIME_PAYMENT_METHOD_TYPES[0]).toBe('card');
    expect(ONE_TIME_PAYMENT_METHOD_TYPES).toEqual(
      expect.arrayContaining(['card', 'link', 'cashapp', 'us_bank_account', 'amazon_pay', 'klarna', 'afterpay_clearpay']),
    );
  });

  it('recurring methods are all savable for off-session charges', () => {
    expect(RECURRING_PAYMENT_METHOD_TYPES).toEqual(['card', 'link', 'us_bank_account']);
  });
});
