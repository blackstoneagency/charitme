export const PLATFORM_FEE_PERCENT = 0;
// Suggested donor "support" (optional tip to CharitMe). Always reducible to 0 —
// see TIP_OPTIONS. This is a suggestion, never a mandatory fee; organizers pay
// 0% platform fee (PLATFORM_FEE_PERCENT). No dark patterns: the reduction
// options are always visible on the donation form.
export const DEFAULT_DONOR_TIP_PERCENT = 15;
export const PROCESSING_FEE_PERCENT = 2.9;
export const PROCESSING_FEE_FIXED_CENTS = 30;
export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 1_000_000_00;

// ── Per-payment-method processing fee config ──────────────────────────────────
// Shared between DonateButton (client) and /api/donations (server) so fees
// shown in the UI exactly match what gets charged at checkout.
export type PaymentMethod = 'stripe' | 'paypal' | 'venmo' | 'gpay' | 'bank' | 'card';

export interface MethodFeeConfig {
  pct:   number;       // percentage rate (e.g. 2.9)
  fixed: number;       // fixed cents per transaction (e.g. 30)
  cap?:  number;       // optional cap in cents (e.g. 500 = $5.00)
  label: string;       // human-readable rate string
}

export const METHOD_FEES: Record<PaymentMethod, MethodFeeConfig> = {
  stripe: { pct: 2.9,  fixed: 30,        label: '2.9% + $0.30'  },
  card:   { pct: 2.9,  fixed: 30,        label: '2.9% + $0.30'  },
  gpay:   { pct: 2.9,  fixed: 30,        label: '2.9% + $0.30'  },
  paypal: { pct: 3.49, fixed: 49,        label: '3.49% + $0.49' },
  venmo:  { pct: 1.9,  fixed: 10,        label: '1.9% + $0.10'  },
  bank:   { pct: 0.8,  fixed: 0, cap: 500, label: '0.8% (max $5)' },
};

/**
 * Calculate the processing fee for a given amount and payment method.
 * This is the fee that goes DIRECTLY TO THE PAYMENT PROCESSOR (Stripe, etc.)
 * and is shown transparently to donors before checkout.
 */
export function methodProcessingFee(amountCents: number, method: PaymentMethod): number {
  const cfg = METHOD_FEES[method];
  const fee = Math.round(amountCents * (cfg.pct / 100)) + cfg.fixed;
  return cfg.cap !== undefined ? Math.min(fee, cfg.cap) : fee;
}

export const CAMPAIGN_CATEGORIES = [
  'Medical',
  'Memorial',
  'Emergency',
  'Nonprofit',
  'Education',
  'Animal',
  'Environment',
  'Business',
  'Community',
  'Competition',
  'Creative',
  'Event',
  'Faith',
  'Family',
  'Sports',
  'Travel',
  'Volunteer',
  'Wishes',
] as const;

export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];

// Selectable support percentages, suggested (15) first. Always includes 0 so a
// donor can opt out entirely with one tap.
export const TIP_OPTIONS = [15, 12, 10, 8, 5, 3, 1, 0] as const;

export function platformFee(_amountCents: number): number {
  return 0;
}

export function processingFee(amountCents: number): number {
  return Math.round(amountCents * (PROCESSING_FEE_PERCENT / 100)) + PROCESSING_FEE_FIXED_CENTS;
}

export function donorTip(amountCents: number, tipPercent = DEFAULT_DONOR_TIP_PERCENT): number {
  return Math.max(0, Math.round(amountCents * (tipPercent / 100)));
}

export function donationTotal(amountCents: number, coverProcessingFee: boolean, tipPercent = DEFAULT_DONOR_TIP_PERCENT): number {
  return amountCents + donorTip(amountCents, tipPercent) + (coverProcessingFee ? processingFee(amountCents) : 0);
}

export function netToFundraiser(amountCents: number): number {
  return amountCents - platformFee(amountCents);
}
