export const PLATFORM_FEE_PERCENT = 0;
// ── Donor support (optional "tip") ────────────────────────────────────────────
// CharitMe charges organizers a 0% platform fee and is funded primarily by
// OPTIONAL donor support. The support is always reducible — including to 0% —
// with no dark patterns. 15% is merely the suggested default.
export const SUGGESTED_SUPPORT_PERCENT = 15;
/** Quick-select ladder shown to donors, highest → zero. Support is never forced. */
export const SUPPORT_TIER_PERCENTS = [15, 12, 10, 8, 5, 3, 1, 0] as const;
/** Back-compat alias — the initial/fallback support percent. */
export const DEFAULT_DONOR_TIP_PERCENT = SUGGESTED_SUPPORT_PERCENT;
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

export const TIP_OPTIONS = SUPPORT_TIER_PERCENTS;

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

// ── Single source of truth: the full donation breakdown ───────────────────────
// Used by the donate form, the live calculator, and the "Where your money goes"
// view so every surface shows identical numbers. CharitMe's model: the recipient
// receives 100% of the gift when the donor covers processing; if they don't, the
// processor fee is the only thing that comes out of the gift. Optional support
// and the platform's 0% fee never reduce what the recipient receives.

export interface DonationBreakdownInput {
  /** The gift the donor intends for the recipient, in cents. */
  amountCents: number;
  /** Optional donor support percent (0–100). Defaults to the suggested tier. */
  supportPercent?: number;
  /** Payment method (drives the processor fee). Defaults to card/stripe. */
  method?: PaymentMethod;
  /** Whether the donor adds the processing fee on top (true = recipient gets 100%). */
  coverProcessing?: boolean;
}

export interface DonationBreakdown {
  donationCents: number;
  supportPercent: number;
  supportCents: number;
  processingCents: number;
  donorCoversProcessing: boolean;
  /** What the donor's card is actually charged. */
  totalChargedCents: number;
  /** What lands with the recipient. */
  netToRecipientCents: number;
  /** netToRecipient / donation, 0–100, rounded to a tenth. */
  recipientPercent: number;
}

export function donationBreakdown(input: DonationBreakdownInput): DonationBreakdown {
  const donationCents = Math.max(0, Math.round(input.amountCents));
  const supportPercent = Math.max(0, Math.min(100, input.supportPercent ?? SUGGESTED_SUPPORT_PERCENT));
  const method = input.method ?? 'card';
  const coverProcessing = input.coverProcessing ?? true;

  const supportCents = donorTip(donationCents, supportPercent);
  const processingCents = methodProcessingFee(donationCents + supportCents, method);

  const totalChargedCents = donationCents + supportCents + (coverProcessing ? processingCents : 0);
  const netToRecipientCents = coverProcessing ? donationCents : Math.max(0, donationCents - processingCents);
  const recipientPercent =
    donationCents > 0 ? Math.round((netToRecipientCents / donationCents) * 1000) / 10 : 0;

  return {
    donationCents,
    supportPercent,
    supportCents,
    processingCents,
    donorCoversProcessing: coverProcessing,
    totalChargedCents,
    netToRecipientCents,
    recipientPercent,
  };
}
