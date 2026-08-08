// ─────────────────────────────────────────────────────────────────────────────
// Steps 9–12 of the donation flow — pure logic, no I/O.
//
// Everything here answers one question: given a donation that has already been
// paid for, what may the post-payment screens SAY about it? The answer is
// narrower than it looks, because after the money has moved a wrong number is no
// longer a rendering bug — it is a receipt that disagrees with the donor's card
// statement.
//
// Companion to `donation-flow-core.ts`, which models steps 1–8.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How complete the record behind a post-payment screen is.
 *
 * `settled` — the donation row exists: everything, including a receipt, is real.
 * `pending` — Stripe says the session is paid but our webhook has not landed
 *   yet. Stripe redirects the browser the instant the payment succeeds, so this
 *   is a genuine few-second race, not an error. The amount is still verified
 *   (it comes from Stripe, server-side), but there is no donation id and
 *   therefore no receipt to link to.
 */
export type OutcomeStatus = 'settled' | 'pending';

export type DonationOutcome = {
  status: OutcomeStatus;
  /** `null` while pending — a receipt cannot be addressed without it. */
  donationId: string | null;
  /** The gift itself, excluding tip and processing fee. */
  amountCents: number;
  tipCents: number;
  processingFeeCents: number;
  currency: string;
  createdAt: string | null;
  /** Stripe payment intent id — what support looks up. `null` if unknown. */
  transactionId: string | null;
  donorName: string | null;
  donorEmail: string | null;
  campaignId: string | null;
  campaignTitle: string;
  campaignSlug: string;
  /** e.g. "Visa •••• 4242", or a plain method name, or `null` if unrecorded. */
  paymentMethodLabel: string | null;
  receiptNumber: string | null;
  /** True ONLY when a `tax_receipts` row exists for this donation. */
  taxDeductible: boolean;
  /** The contribution amount stated by the issued tax receipt, excluding tips and fees. */
  taxReceiptAmountCents: number | null;
  /** Present only when `taxDeductible` — never inferred. */
  nonprofitName: string | null;
  nonprofitEin: string | null;
};

/**
 * A Stripe checkout session id, or `null`.
 *
 * ⚠️ **This value is the authorization for steps 9–12.** Stripe puts it in the
 * `success_url` it redirects to, and nowhere else — possessing it is evidence of
 * having completed that checkout, which is why these screens work for a signed-out
 * donor who will never have an account. That makes the shape check load-bearing:
 * anything that is not a `cs_...` id must be rejected before it reaches a query,
 * so the pages cannot be turned into a lookup tool for arbitrary strings.
 *
 * The length bound is deliberate. Stripe ids are ~66 characters; accepting an
 * unbounded string would let a caller push megabytes into a database filter.
 */
export function parseSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id.startsWith('cs_')) return null;
  if (id.length < 10 || id.length > 200) return null;
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return null;
  return id;
}

/**
 * What the donor's card was actually charged.
 *
 * The gift, the optional tip and the processing fee are three separate line
 * items in Stripe Checkout, so the total on the receipt has to add them back up.
 * Showing `amountCents` alone as "Total" would understate what left the donor's
 * account, which is the one number they can check against their statement.
 */
export function totalChargedCents(o: Pick<DonationOutcome, 'amountCents' | 'tipCents' | 'processingFeeCents'>): number {
  return o.amountCents + o.tipCents + o.processingFeeCents;
}

/**
 * The short reference printed on the receipt and quoted in support email.
 *
 * Derived from the payment intent id rather than invented, so the value on this
 * screen, on the emailed receipt and in the Stripe dashboard are the same
 * string. `null` when there is no intent — an invented reference is worse than
 * none, because support would search for it and find nothing.
 */
export function receiptReference(transactionId: string | null): string | null {
  if (!transactionId) return null;
  const tail = transactionId.slice(-12);
  return tail.length === 12 ? tail.toUpperCase() : null;
}

/** Card brands Stripe reports, in the casing a receipt should show. */
const CARD_BRANDS: Readonly<Record<string, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
  eftpos_au: 'Eftpos Australia',
};

/** Non-card methods, keyed as Stripe reports them. */
const METHOD_LABELS: Readonly<Record<string, string>> = {
  link: 'Link',
  cashapp: 'Cash App Pay',
  us_bank_account: 'Bank transfer',
  amazon_pay: 'Amazon Pay',
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  card: 'Card',
};

/**
 * "Visa •••• 4242", "Cash App Pay", or `null`.
 *
 * Returns `null` rather than a guess when the method is unrecognised: the
 * artwork shows this line on the receipt, and a receipt that names the wrong
 * instrument is a support ticket. An unknown method simply omits the row.
 */
export function paymentMethodLabel(
  input: { type?: string | null; brand?: string | null; last4?: string | null; wallet?: string | null } | null,
): string | null {
  if (!input) return null;

  // A wallet pays THROUGH a card, and Stripe reports both. The donor recognises
  // "Apple Pay", not the funding card they have not seen since setting it up.
  const wallet = input.wallet ? METHOD_LABELS[input.wallet] : null;
  if (wallet) return input.last4 ? `${wallet} •••• ${input.last4}` : wallet;

  const brand = input.brand ? CARD_BRANDS[input.brand.toLowerCase()] : null;
  if (brand) return input.last4 ? `${brand} •••• ${input.last4}` : brand;

  const type = input.type ? METHOD_LABELS[input.type] : null;
  if (type) return input.last4 ? `${type} •••• ${input.last4}` : type;

  return null;
}

/**
 * The message pre-filled on the share step.
 *
 * ⚠️ **It never states an amount.** The artwork's example does not either, and
 * the reason matters: this text goes onto a public timeline. Donors who gave
 * anonymously, and donors who simply do not publish what they give, would be
 * handed a post disclosing it. The share is about the cause, not the sum.
 */
export function shareMessage(campaignTitle: string, url: string): string {
  const title = campaignTitle.trim();
  const lead = title
    ? `I just donated to help "${title}". Join me in making a difference!`
    : 'I just donated to a cause I believe in. Join me in making a difference!';
  return `${lead} ${url}`;
}

/** Share targets on step 11, in the order the artwork shows them. */
export const SHARE_TARGETS = ['facebook', 'twitter', 'linkedin', 'whatsapp', 'link'] as const;
export type ShareTarget = (typeof SHARE_TARGETS)[number];

export function shareHref(target: ShareTarget, url: string, message: string): string | null {
  const u = encodeURIComponent(url);
  const m = encodeURIComponent(message);
  switch (target) {
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'twitter': return `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(message.replace(` ${url}`, ''))}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case 'whatsapp': return `https://wa.me/?text=${m}`;
    // Copy-to-clipboard, handled in the client — not a navigation.
    case 'link': return null;
  }
}
