export const PLATFORM_FEE_PERCENT = 0;
// ── Donor support (optional "tip") ────────────────────────────────────────────
// CharitMe charges organizers a 0% platform fee and is funded primarily by
// OPTIONAL donor support. The support is always reducible — including to 0% —
// with no dark patterns. 10% is merely the suggested default.
export const SUGGESTED_SUPPORT_PERCENT = 10;
/** Quick-select ladder shown to donors, highest → zero. Support is never forced. */
export const SUPPORT_TIER_PERCENTS = [15, 12, 10, 8, 5, 3, 1, 0] as const;
/** Back-compat alias — the initial/fallback support percent. */
export const DEFAULT_DONOR_TIP_PERCENT = SUGGESTED_SUPPORT_PERCENT;
export const PROCESSING_FEE_PERCENT = 2.9;
export const PROCESSING_FEE_FIXED_CENTS = 30;
export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 1_000_000_00;
export const DONATION_AMOUNT_PRESET_CENTS = [2_500, 5_000, 7_500, 10_000, 15_000, 25_000] as const;
export const POPULAR_DONATION_AMOUNT_CENTS = 5_000;

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

export const CHECKOUT_PAYMENT_METHODS = ['stripe', 'gpay', 'bank', 'card'] as const;
export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

export type DonationCheckoutSettings = {
  amountPresetsCents: number[];
  popularAmountCents: number;
  supportTierPercents: number[];
  defaultSupportPercent: number;
  methodFees: Record<CheckoutPaymentMethod, MethodFeeConfig>;
};

export const DEFAULT_DONATION_CHECKOUT_SETTINGS: DonationCheckoutSettings = {
  amountPresetsCents: [...DONATION_AMOUNT_PRESET_CENTS],
  popularAmountCents: POPULAR_DONATION_AMOUNT_CENTS,
  supportTierPercents: [...SUPPORT_TIER_PERCENTS],
  defaultSupportPercent: SUGGESTED_SUPPORT_PERCENT,
  methodFees: {
    stripe: { ...METHOD_FEES.stripe },
    gpay: { ...METHOD_FEES.gpay },
    bank: { ...METHOD_FEES.bank },
    card: { ...METHOD_FEES.card },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function normalizeMethodFee(value: unknown, fallback: MethodFeeConfig): MethodFeeConfig {
  const raw = asRecord(value);
  const pct = boundedNumber(raw.pct, fallback.pct, 0, 20);
  const fixed = Math.round(boundedNumber(raw.fixed, fallback.fixed, 0, 10_000));
  const parsedCap = raw.cap === null || raw.cap === undefined
    ? fallback.cap
    : Math.round(boundedNumber(raw.cap, fallback.cap ?? 0, 0, 100_000));
  return {
    pct,
    fixed,
    ...(parsedCap !== undefined ? { cap: parsedCap } : {}),
    label: methodFeeLabel({ pct, fixed, ...(parsedCap !== undefined ? { cap: parsedCap } : {}) }),
  };
}

function validUniqueArray(
  value: unknown,
  length: number,
  min: number,
  max: number,
  integer: boolean,
): number[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  const numbers = value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
  if (numbers.length !== length) return null;
  if (numbers.some((entry) => entry < min || entry > max || (integer && !Number.isInteger(entry)))) return null;
  if (new Set(numbers).size !== numbers.length) return null;
  return numbers;
}

export function methodFeeLabel(config: Pick<MethodFeeConfig, 'pct' | 'fixed' | 'cap'>): string {
  const percent = Number.isInteger(config.pct) ? String(config.pct) : String(Number(config.pct.toFixed(2)));
  const fixed = config.fixed > 0 ? ` + $${(config.fixed / 100).toFixed(2)}` : '';
  const cap = config.cap !== undefined ? ` (max $${(config.cap / 100).toFixed(2).replace(/\.00$/, '')})` : '';
  return `${percent}%${fixed}${cap}`;
}

export function normalizeDonationCheckoutSettings(value: unknown): DonationCheckoutSettings {
  const raw = asRecord(value);
  const fallback = DEFAULT_DONATION_CHECKOUT_SETTINGS;
  const amountPresets = validUniqueArray(
    raw.amountPresetsCents,
    fallback.amountPresetsCents.length,
    MIN_DONATION_CENTS,
    MAX_DONATION_CENTS,
    true,
  );
  const amountPresetsCents = amountPresets
    ? [...amountPresets].sort((a, b) => a - b)
    : [...fallback.amountPresetsCents];

  const supportTiers = validUniqueArray(
    raw.supportTierPercents,
    fallback.supportTierPercents.length,
    0,
    100,
    false,
  );
  const supportTierPercents = supportTiers && supportTiers.includes(0)
    ? [...supportTiers].sort((a, b) => b - a)
    : [...fallback.supportTierPercents];

  const configuredPopular = Math.round(boundedNumber(
    raw.popularAmountCents,
    fallback.popularAmountCents,
    MIN_DONATION_CENTS,
    MAX_DONATION_CENTS,
  ));
  const popularAmountCents = amountPresetsCents.includes(configuredPopular)
    ? configuredPopular
    : (amountPresetsCents[1] ?? amountPresetsCents[0] ?? fallback.popularAmountCents);

  const configuredSupport = boundedNumber(
    raw.defaultSupportPercent,
    fallback.defaultSupportPercent,
    0,
    100,
  );
  // ⚠️ When the configured value is not on the ladder, fall back to the
  // platform's SUGGESTED rate before the ladder's first entry.
  //
  // This used to go straight to `supportTierPercents[0]`. The ladder is sorted
  // high → low, so entry 0 is the LARGEST tier: a malformed or out-of-range
  // setting silently preselected the biggest optional fee a donor could pay.
  // That was invisible while the suggested rate and the top of the ladder were
  // both 15% and they are no longer the same number. Defaulting a donor into
  // the maximum on a bad config is the sort of dark pattern this file's own
  // comments rule out.
  const defaultSupportPercent = supportTierPercents.includes(configuredSupport)
    ? configuredSupport
    : supportTierPercents.includes(fallback.defaultSupportPercent)
      ? fallback.defaultSupportPercent
      : (supportTierPercents[0] ?? fallback.defaultSupportPercent);
  const methods = asRecord(raw.methodFees);

  return {
    amountPresetsCents,
    popularAmountCents,
    supportTierPercents,
    defaultSupportPercent,
    methodFees: {
      stripe: normalizeMethodFee(methods.stripe, fallback.methodFees.stripe),
      gpay: normalizeMethodFee(methods.gpay, fallback.methodFees.gpay),
      bank: normalizeMethodFee(methods.bank, fallback.methodFees.bank),
      card: normalizeMethodFee(methods.card, fallback.methodFees.card),
    },
  };
}

/**
 * Calculate the processing fee for a given amount and payment method.
 * This is the fee that goes DIRECTLY TO THE PAYMENT PROCESSOR (Stripe, etc.)
 * and is shown transparently to donors before checkout.
 */
export function methodProcessingFee(
  amountCents: number,
  method: PaymentMethod,
  methodFees: Partial<Record<PaymentMethod, MethodFeeConfig>> = METHOD_FEES,
): number {
  const cfg = methodFees[method] ?? METHOD_FEES[method];
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
  /**
   * An EXACT support amount in cents, chosen by the donor via "Enter custom
   * amount". When present it wins over `supportPercent`, because a custom figure
   * must be charged to the cent — deriving it from a rounded percentage would
   * make the amount shown differ from the amount charged. `supportPercent` in
   * the result is then the (possibly fractional) equivalent, for display only.
   */
  supportCentsOverride?: number;
  /** Payment method (drives the processor fee). Defaults to card/stripe. */
  method?: PaymentMethod;
  /** Runtime fee configuration loaded from platform_settings. */
  methodFees?: Partial<Record<PaymentMethod, MethodFeeConfig>>;
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

/**
 * The support percentage a custom cents amount represents, rounded to a tenth.
 * Display-only: never feed this back into a charge, or rounding would make the
 * amount charged drift from the amount the donor typed. Returns 0 for a zero
 * gift (no divide-by-zero).
 */
export function supportPercentFromCents(donationCents: number, supportCents: number): number {
  if (!donationCents || donationCents <= 0) return 0;
  return Math.round((supportCents / donationCents) * 1000) / 10;
}

export function donationBreakdown(input: DonationBreakdownInput): DonationBreakdown {
  const donationCents = Math.max(0, Math.round(input.amountCents));
  const supportPercent = Math.max(0, Math.min(100, input.supportPercent ?? SUGGESTED_SUPPORT_PERCENT));
  const method = input.method ?? 'card';
  const coverProcessing = input.coverProcessing ?? true;

  // A donor-entered custom amount is authoritative to the cent; the tier
  // percentage is only a shortcut for picking one.
  const hasOverride =
    input.supportCentsOverride != null && Number.isFinite(input.supportCentsOverride);
  const supportCents = hasOverride
    ? Math.max(0, Math.round(input.supportCentsOverride as number))
    : donorTip(donationCents, supportPercent);
  const processingCents = methodProcessingFee(donationCents + supportCents, method, input.methodFees);

  const totalChargedCents = donationCents + supportCents + (coverProcessing ? processingCents : 0);
  const netToRecipientCents = coverProcessing ? donationCents : Math.max(0, donationCents - processingCents);
  const recipientPercent =
    donationCents > 0 ? Math.round((netToRecipientCents / donationCents) * 1000) / 10 : 0;

  return {
    donationCents,
    // With a custom amount, report the equivalent percentage (to a tenth) so the
    // UI can label it honestly instead of echoing a tier the donor didn't pick.
    supportPercent: hasOverride ? supportPercentFromCents(donationCents, supportCents) : supportPercent,
    supportCents,
    processingCents,
    donorCoversProcessing: coverProcessing,
    totalChargedCents,
    netToRecipientCents,
    recipientPercent,
  };
}
