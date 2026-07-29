import { describe, it, expect } from 'vitest';
import {
  nextPaymentMethodTypes,
  ONE_TIME_PAYMENT_METHOD_TYPES,
  RECURRING_PAYMENT_METHOD_TYPES,
  reconcilePaymentMethods,
  METHOD_CAPABILITY,
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

// ─────────────────────────────────────────────────────────────────────────────
// The declared payment-method list is hand-maintained, and its own comment
// records a one-off check ("Verified against the live account 2026-07-23").
// Nothing re-verified it, and the failure mode is silent: Stripe rejects the
// WHOLE Checkout session when it names an inactive method — often without
// saying which — so one deactivation in the Dashboard collapses every donation
// to card-only. Donors stop being offered Cash App, Klarna and bank debit, and
// nothing errors.
//
// reconcilePaymentMethods is what /api/health?details=1 uses to catch that.
// ─────────────────────────────────────────────────────────────────────────────
describe('reconciling declared payment methods against account capabilities', () => {
  const allActive = {
    card_payments: 'active',
    link_payments: 'active',
    cashapp_payments: 'active',
    us_bank_account_ach_payments: 'active',
    amazon_pay_payments: 'active',
    klarna_payments: 'active',
    afterpay_clearpay_payments: 'active',
  };

  it('reports every declared method active when the account has them', () => {
    const r = reconcilePaymentMethods(ONE_TIME_PAYMENT_METHOD_TYPES, allActive);
    expect(r.inactive).toEqual([]);
    expect(r.unmapped).toEqual([]);
    expect(r.active).toEqual([...ONE_TIME_PAYMENT_METHOD_TYPES]);
  });

  it('flags a method that has been deactivated in the Dashboard', () => {
    const r = reconcilePaymentMethods(ONE_TIME_PAYMENT_METHOD_TYPES, {
      ...allActive,
      klarna_payments: 'inactive',
    });
    expect(r.inactive).toEqual([{ method: 'klarna', status: 'inactive' }]);
    expect(r.active).not.toContain('klarna');
  });

  it('treats a pending capability as not usable', () => {
    const r = reconcilePaymentMethods(['cashapp'], { cashapp_payments: 'pending' });
    expect(r.inactive).toEqual([{ method: 'cashapp', status: 'pending' }]);
  });

  it('treats an ABSENT capability as broken, never as fine', () => {
    // An absent capability is exactly the state that breaks checkout, so
    // "Stripe did not mention it" must not read as healthy.
    const r = reconcilePaymentMethods(['klarna'], {});
    expect(r.inactive).toEqual([{ method: 'klarna', status: 'not_present' }]);
  });

  it('does not assume anything when capabilities could not be read at all', () => {
    for (const caps of [null, undefined]) {
      const r = reconcilePaymentMethods(['card', 'link'], caps);
      expect(r.active, String(caps)).toEqual([]);
      expect(r.inactive.map((i) => i.method)).toEqual(['card', 'link']);
    }
  });

  it('reports an unmapped method as unknown rather than active', () => {
    const r = reconcilePaymentMethods(['some_new_method'], allActive);
    expect(r.unmapped).toEqual(['some_new_method']);
    expect(r.active).toEqual([]);
  });

  it('maps every declared method, so none can silently go unchecked', () => {
    for (const m of [...ONE_TIME_PAYMENT_METHOD_TYPES, ...RECURRING_PAYMENT_METHOD_TYPES]) {
      expect(METHOD_CAPABILITY[m], `"${m}" has no capability mapping`).toBeTruthy();
    }
  });

  it('knows the two methods deliberately omitted, for when they are activated', () => {
    expect(METHOD_CAPABILITY.paypal).toBe('paypal_payments');
    expect(METHOD_CAPABILITY.affirm).toBe('affirm_payments');
    expect(ONE_TIME_PAYMENT_METHOD_TYPES as readonly string[]).not.toContain('paypal');
  });
});
