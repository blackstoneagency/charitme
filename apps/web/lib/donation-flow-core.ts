/**
 * The 12-step donation flow — pure model.
 *
 * ⚠️ **Steps 4 and 5 are NOT ours to render, and that is deliberate.**
 *
 * The reference artwork shows "Select Payment Method" and then an "Enter Card
 * Details" form with raw card-number, expiry and CVC inputs. Building that would
 * put this site directly in PCI-DSS scope and route real card numbers through
 * our own server — a serious regression from the current design, which hands off
 * to **Stripe Checkout** on Stripe's own domain and never sees a PAN.
 *
 * So this model marks those two steps `hostedByStripe`. They still happen, and
 * the donor still sees exactly the choices in the artwork (card, Apple Pay,
 * Google Pay, PayPal, bank transfer) — Stripe Checkout renders them, with the
 * available methods driven by the account's own configuration.
 */

export const DONATION_STEPS = [
  'campaign',
  'amount',
  'details',
  'dedicate',
  'review',
  'payment-method',
  'payment-details',
  'confirm',
  'success',
  'receipt',
  'share',
  'return',
] as const;

export type DonationStep = (typeof DONATION_STEPS)[number];

export type StepMeta = {
  id: DonationStep;
  title: string;
  /** Rendered by Stripe Checkout, not by us — see the module note. */
  hostedByStripe: boolean;
  /** Steps after the money has moved; they must never re-collect input. */
  postPayment: boolean;
};

export const DONATION_STEP_META: Readonly<Record<DonationStep, StepMeta>> = {
  campaign: { id: 'campaign', title: 'Choose a campaign', hostedByStripe: false, postPayment: false },
  amount: { id: 'amount', title: 'Choose an amount', hostedByStripe: false, postPayment: false },
  details: { id: 'details', title: 'Your details', hostedByStripe: false, postPayment: false },
  dedicate: { id: 'dedicate', title: 'Dedicate this donation', hostedByStripe: false, postPayment: false },
  review: { id: 'review', title: 'Review your donation', hostedByStripe: false, postPayment: false },
  'payment-method': { id: 'payment-method', title: 'Payment method', hostedByStripe: true, postPayment: false },
  'payment-details': { id: 'payment-details', title: 'Payment details', hostedByStripe: true, postPayment: false },
  confirm: { id: 'confirm', title: 'Confirm & donate', hostedByStripe: true, postPayment: false },
  success: { id: 'success', title: 'Donation successful', hostedByStripe: false, postPayment: true },
  receipt: { id: 'receipt', title: 'Your receipt', hostedByStripe: false, postPayment: true },
  share: { id: 'share', title: 'Share your support', hostedByStripe: false, postPayment: true },
  return: { id: 'return', title: 'Back to the campaign', hostedByStripe: false, postPayment: true },
};

/** The steps this application actually renders. */
export function ownedSteps(): DonationStep[] {
  return DONATION_STEPS.filter((s) => !DONATION_STEP_META[s].hostedByStripe);
}

/** "Step 3 of 12" — 1-based, because it is announced to screen readers. */
export function stepPosition(step: DonationStep): { index: number; total: number } {
  return { index: DONATION_STEPS.indexOf(step) + 1, total: DONATION_STEPS.length };
}

export function nextStep(step: DonationStep): DonationStep | null {
  const i = DONATION_STEPS.indexOf(step);
  return i >= 0 && i < DONATION_STEPS.length - 1 ? DONATION_STEPS[i + 1]! : null;
}

export function previousStep(step: DonationStep): DonationStep | null {
  const i = DONATION_STEPS.indexOf(step);
  return i > 0 ? DONATION_STEPS[i - 1]! : null;
}

/**
 * Whether a donor may still go BACK from this step.
 *
 * Once the money has moved, "Back" must not reopen the form: it would invite a
 * second charge for a donation already made. The artwork shows a Back button on
 * every pre-payment screen and none after step 9, which is the correct rule.
 */
export function canGoBack(step: DonationStep): boolean {
  if (DONATION_STEP_META[step].postPayment) return false;
  return previousStep(step) !== null;
}

// ── Dedication ───────────────────────────────────────────────────────────────

export const DEDICATION_KINDS = ['honor', 'memory', 'occasion'] as const;
export type DedicationKind = (typeof DEDICATION_KINDS)[number];

export function isDedicationKind(value: unknown): value is DedicationKind {
  return typeof value === 'string' && (DEDICATION_KINDS as readonly string[]).includes(value);
}

export const DEDICATION_PREFIX: Readonly<Record<DedicationKind, string>> = {
  honor: 'In honour of',
  memory: 'In memory of',
  occasion: 'For a special occasion:',
};

export type Dedication = {
  kind: DedicationKind;
  honoreeName: string;
  personalMessage?: string;
};

export const DEDICATION_NAME_MAX = 80;
export const DONATION_MESSAGE_MAX = 500;

/**
 * Fold a dedication into the donation message.
 *
 * ⚠️ **There is no dedication table and no honoree columns** — `donations` has
 * exactly `message` and `anonymous`. Rendering separate honoree fields that were
 * then dropped on the floor would be a form that lies, so the dedication is
 * composed INTO the message that really is stored and really is shown on the
 * donor wall.
 *
 * The artwork's "notify the honoree by email" is therefore **not offered**: there
 * is nowhere to store an honoree address and no sending path, and a tick-box that
 * silently notifies nobody is worse than its absence.
 */
export function composeDedicatedMessage(
  dedication: Dedication | null,
  message: string | undefined,
): string {
  const own = (message ?? '').trim();
  if (!dedication) return own.slice(0, DONATION_MESSAGE_MAX);

  const name = dedication.honoreeName.trim();
  if (!name) return own.slice(0, DONATION_MESSAGE_MAX);

  const line = `${DEDICATION_PREFIX[dedication.kind]} ${name}`;
  const combined = own ? `${line}. ${own}` : line;
  // Truncated at the column's own limit rather than letting the write fail: a
  // long personal note must not lose the dedication that prompted it, so the
  // dedication goes FIRST.
  return combined.slice(0, DONATION_MESSAGE_MAX);
}

export function isValidDedication(dedication: Dedication): boolean {
  const name = dedication.honoreeName.trim();
  return name.length > 0 && name.length <= DEDICATION_NAME_MAX;
}

// ── Amount ───────────────────────────────────────────────────────────────────

/** The presets in the artwork, in cents. */
export const AMOUNT_PRESETS_CENTS = [1_000, 2_500, 5_000, 10_000, 25_000, 50_000] as const;

export type Frequency = 'once' | 'monthly';

/**
 * Validate a chosen amount against the shared minimum.
 *
 * Returns a reason rather than a boolean so the step can say WHY, which is the
 * difference between a disabled button and one a donor can act on.
 */
export function validateAmountCents(
  cents: number,
  minCents: number,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(cents) || Number.isNaN(cents)) {
    return { ok: false, reason: 'Enter an amount to donate.' };
  }
  if (!Number.isInteger(cents)) {
    // Cents are integers; a fractional value means the caller multiplied a
    // float and picked up a rounding error, which Stripe would reject.
    return { ok: false, reason: 'That amount is not a whole number of cents.' };
  }
  if (cents < minCents) {
    return { ok: false, reason: `The minimum donation is $${(minCents / 100).toFixed(2)}.` };
  }
  return { ok: true };
}
