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
