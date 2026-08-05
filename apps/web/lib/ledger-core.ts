// ─────────────────────────────────────────────────────────────────────────────
// Financial ledger — pure double-entry logic (no I/O, unit-testable).
// Every event produces a BALANCED set of lines (sum debits === sum credits).
// Data access + persistence live in `ledger.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export type LedgerAccount =
  | 'donor_clearing'
  | 'recipient_payable'
  | 'platform_revenue'
  | 'processor_fees'
  | 'refunds'
  | 'disputes'
  | 'adjustments';

export type LedgerDirection = 'debit' | 'credit';

export interface LedgerLine {
  account: LedgerAccount;
  direction: LedgerDirection;
  amount_cents: number;
}

/** Sum of debit lines minus sum of credit lines (0 when balanced). */
export function imbalance(lines: readonly LedgerLine[]): number {
  return lines.reduce((n, l) => n + (l.direction === 'debit' ? l.amount_cents : -l.amount_cents), 0);
}

export function isBalanced(lines: readonly LedgerLine[]): boolean {
  return imbalance(lines) === 0;
}

export function assertBalanced(lines: readonly LedgerLine[]): void {
  const diff = imbalance(lines);
  if (diff !== 0) {
    throw new Error(`Unbalanced ledger group: debits - credits = ${diff}`);
  }
  assertPostable(lines);
}

/**
 * A balanced group can still be unpostable, and it fails SILENTLY.
 *
 * Idempotency is enforced by a unique index on
 * `(idempotency_key, account, direction)`, and every line in a group shares one
 * key. So two lines in the SAME group with the same account and direction
 * collide with each other on the very first insert — and `postEntryGroup`
 * catches `23505` and reports `{ posted: false }`, which is its signal for "this
 * webhook was already handled". The donation row is written, Stripe gets its
 * 200, and the money never reaches the ledger. No error anywhere.
 *
 * No builder does this today: donation, refund and dispute each emit distinct
 * account/direction pairs. But the invariant lived only in the shape of three
 * literal arrays — adding one plausible line (a second `platform_revenue` credit
 * for a tip, say) is enough to break it, and nothing would have said so.
 *
 * Checked here rather than only in a test because the failure mode is silent
 * money loss. Throwing turns it into a 500, which is this repo's webhook
 * contract — Stripe retries, the failure surfaces — and it can only fire on a
 * code change, never on data.
 */
export function assertPostable(lines: readonly LedgerLine[]): void {
  const seen = new Set<string>();
  for (const l of lines) {
    const slot = `${l.account}:${l.direction}`;
    if (seen.has(slot)) {
      throw new Error(
        `Ledger group posts ${slot} twice. Lines in one group share an idempotency ` +
        'key, and the unique index is (idempotency_key, account, direction) — so the ' +
        'group would collide with itself and be swallowed as an idempotent skip. ' +
        'Net the amounts into a single line instead.',
      );
    }
    seen.add(slot);
  }
}

export interface DonationSplit {
  /** Net donation attributed to the recipient (recipient receives this). */
  donationCents: number;
  /** CharitMe's disclosed fee (application fee / tip). */
  platformFeeCents: number;
  /** Stripe / payment processor fee. */
  processorFeeCents: number;
}

/**
 * Post a captured donation. The donor's gross payment is split three ways:
 *   gross = donation (→ recipient) + platform fee (→ CharitMe) + processor fee (→ Stripe)
 *
 *   Debit  donor_clearing     gross
 *   Credit recipient_payable  donationCents
 *   Credit platform_revenue   platformFeeCents
 *   Credit processor_fees     processorFeeCents
 */
export function buildDonationEntries(split: DonationSplit): LedgerLine[] {
  const { donationCents, platformFeeCents, processorFeeCents } = split;
  if (donationCents < 0 || platformFeeCents < 0 || processorFeeCents < 0) {
    throw new Error('Donation split amounts must be non-negative');
  }
  const gross = donationCents + platformFeeCents + processorFeeCents;
  const all: LedgerLine[] = [
    { account: 'donor_clearing', direction: 'debit', amount_cents: gross },
    { account: 'recipient_payable', direction: 'credit', amount_cents: donationCents },
    { account: 'platform_revenue', direction: 'credit', amount_cents: platformFeeCents },
    { account: 'processor_fees', direction: 'credit', amount_cents: processorFeeCents },
  ];
  const lines = all.filter((l) => l.amount_cents > 0);
  assertBalanced(lines);
  return lines;
}

export interface RefundInput {
  /** Amount of the donation principal being refunded to the donor. */
  refundDonationCents: number;
  /** Platform fee being refunded (0 if CharitMe retains its fee). */
  refundPlatformFeeCents?: number;
}

/**
 * Reverse (part of) a donation on refund. Reverses the recipient payable and any
 * refunded platform fee back out through the donor clearing account.
 *
 *   Debit  recipient_payable  refundDonationCents   (claw back recipient's credit)
 *   Debit  platform_revenue   refundPlatformFee     (if the fee is refunded)
 *   Credit refunds            total refunded        (owed back to the donor)
 */
export function buildRefundEntries(input: RefundInput): LedgerLine[] {
  const donation = input.refundDonationCents;
  const fee = input.refundPlatformFeeCents ?? 0;
  if (donation < 0 || fee < 0) throw new Error('Refund amounts must be non-negative');
  const total = donation + fee;
  const all: LedgerLine[] = [
    { account: 'recipient_payable', direction: 'debit', amount_cents: donation },
    { account: 'platform_revenue', direction: 'debit', amount_cents: fee },
    { account: 'refunds', direction: 'credit', amount_cents: total },
  ];
  const lines = all.filter((l) => l.amount_cents > 0);
  assertBalanced(lines);
  return lines;
}

/**
 * A lost dispute (chargeback) is a forced clawback: the money leaves via the card
 * network, not a refund we initiated. Reverse the recipient payable (and platform
 * fee if we absorb it) into the `disputes` account rather than `refunds`, so the
 * two loss channels stay distinguishable in the books.
 *
 *   Debit  recipient_payable  refundDonationCents
 *   Debit  platform_revenue   refundPlatformFee   (if the fee is also lost)
 *   Credit disputes           total lost
 */
export function buildDisputeLossEntries(input: RefundInput): LedgerLine[] {
  const donation = input.refundDonationCents;
  const fee = input.refundPlatformFeeCents ?? 0;
  if (donation < 0 || fee < 0) throw new Error('Dispute amounts must be non-negative');
  const total = donation + fee;
  const all: LedgerLine[] = [
    { account: 'recipient_payable', direction: 'debit', amount_cents: donation },
    { account: 'platform_revenue', direction: 'debit', amount_cents: fee },
    { account: 'disputes', direction: 'credit', amount_cents: total },
  ];
  const lines = all.filter((l) => l.amount_cents > 0);
  assertBalanced(lines);
  return lines;
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export interface ReconcileResult {
  matched: boolean;
  differenceCents: number;
}

/** Compare an expected (ledger) amount to an actual (Stripe) amount. */
export function reconcileAmounts(expectedCents: number, actualCents: number): ReconcileResult {
  const differenceCents = expectedCents - actualCents;
  return { matched: differenceCents === 0, differenceCents };
}

/**
 * Net amount posted to an account across a set of lines (credits positive for
 * liability/revenue accounts). Used to roll a campaign's recipient payable, etc.
 */
export function accountBalance(lines: readonly LedgerLine[], account: LedgerAccount): number {
  return lines
    .filter((l) => l.account === account)
    .reduce((n, l) => n + (l.direction === 'credit' ? l.amount_cents : -l.amount_cents), 0);
}
