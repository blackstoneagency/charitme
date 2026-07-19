// ─────────────────────────────────────────────────────────────────────────────
// Daily reconciliation — pure logic (no I/O, unit-testable).
//
// Every captured donation must be mirrored by exactly one BALANCED ledger group
// whose credits match the donation's disclosed split:
//   recipient_payable == donation.amount_cents   (net to the recipient)
//   platform_revenue   == donation.platform_fee  (CharitMe's fee / tip)
//   processor_fees      == donation.processor_fee (Stripe's fee)
//
// This module compares the recorded donation to the ledger it produced and emits
// reconciliation exceptions for anything that does not line up. Persistence and
// the Stripe-side comparison live in `reconciliation.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export type ReconciliationKind =
  | 'amount_mismatch'
  | 'missing_ledger'
  | 'missing_stripe'
  | 'unbalanced_group'
  | 'duplicate'
  | 'fee_mismatch'
  | 'payout_mismatch'
  | 'other';

export interface ReconciliationFinding {
  kind: ReconciliationKind;
  donationId: string;
  campaignId?: string | null;
  description: string;
  expectedCents?: number | null;
  actualCents?: number | null;
}

/** What the donation record says the money should have been split into. */
export interface ExpectedSplit {
  donationCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
}

/** What the ledger actually recorded for this donation (net per account). */
export interface LedgerObservation {
  /** How many balanced donation groups reference this donation (should be 1). */
  groupCount: number;
  recipientPayableCents: number;
  platformRevenueCents: number;
  processorFeesCents: number;
  /** True when every group referencing this donation summed to zero. */
  balanced: boolean;
}

export interface DonationToReconcile {
  donationId: string;
  campaignId?: string | null;
  expected: ExpectedSplit;
  ledger: LedgerObservation;
}

/**
 * Reconcile one donation against its ledger footprint. Returns every finding
 * (usually none). The checks are ordered most-fundamental first so a completely
 * missing ledger doesn't also spam per-account mismatches.
 */
export function reconcileDonation(input: DonationToReconcile): ReconciliationFinding[] {
  const { donationId, campaignId, expected, ledger } = input;
  const findings: ReconciliationFinding[] = [];
  const base = { donationId, campaignId: campaignId ?? null };

  // 1) No ledger group at all — the donation was captured but never posted.
  if (ledger.groupCount === 0) {
    const gross = expected.donationCents + expected.platformFeeCents + expected.processorFeeCents;
    findings.push({
      ...base,
      kind: 'missing_ledger',
      description: 'Captured donation has no ledger entry group.',
      expectedCents: gross,
      actualCents: 0,
    });
    return findings; // nothing else is meaningful without a group
  }

  // 2) More than one group for the same donation — double-posted.
  if (ledger.groupCount > 1) {
    findings.push({
      ...base,
      kind: 'duplicate',
      description: `Donation is posted ${ledger.groupCount} times in the ledger (expected 1).`,
      expectedCents: 1,
      actualCents: ledger.groupCount,
    });
  }

  // 3) The group(s) must be internally balanced (debits === credits).
  if (!ledger.balanced) {
    findings.push({
      ...base,
      kind: 'unbalanced_group',
      description: 'Ledger group for this donation does not balance (debits != credits).',
    });
  }

  // 4) Recipient payable must equal the net donation, to the cent.
  if (ledger.recipientPayableCents !== expected.donationCents) {
    findings.push({
      ...base,
      kind: 'amount_mismatch',
      description: 'Ledger recipient payable does not match the donation amount.',
      expectedCents: expected.donationCents,
      actualCents: ledger.recipientPayableCents,
    });
  }

  // 5) Fees must match the disclosed split (platform + processor).
  if (ledger.platformRevenueCents !== expected.platformFeeCents) {
    findings.push({
      ...base,
      kind: 'fee_mismatch',
      description: 'Ledger platform revenue does not match the disclosed platform fee.',
      expectedCents: expected.platformFeeCents,
      actualCents: ledger.platformRevenueCents,
    });
  }
  if (ledger.processorFeesCents !== expected.processorFeeCents) {
    findings.push({
      ...base,
      kind: 'fee_mismatch',
      description: 'Ledger processor fees do not match the disclosed processor fee.',
      expectedCents: expected.processorFeeCents,
      actualCents: ledger.processorFeesCents,
    });
  }

  return findings;
}

export interface ReconciliationSummary {
  checked: number;
  clean: number;
  findings: ReconciliationFinding[];
  byKind: Record<string, number>;
}

/** Reconcile a batch and roll findings up into a summary. */
export function reconcileDonations(items: readonly DonationToReconcile[]): ReconciliationSummary {
  const findings: ReconciliationFinding[] = [];
  let clean = 0;
  for (const item of items) {
    const f = reconcileDonation(item);
    if (f.length === 0) clean += 1;
    findings.push(...f);
  }
  const byKind: Record<string, number> = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  return { checked: items.length, clean, findings, byKind };
}

/**
 * Fold raw ledger lines (as returned from the DB for one donation) into a single
 * observation. Credits are positive for the liability/revenue/fee accounts we
 * track here; the group is "balanced" when signed debits and credits cancel.
 */
export function observeLedger(
  lines: readonly { account: string; direction: string; amount_cents: number; entry_group_id: string }[],
): LedgerObservation {
  const groups = new Set<string>();
  let recipientPayableCents = 0;
  let platformRevenueCents = 0;
  let processorFeesCents = 0;
  let signedTotal = 0; // debits(+) - credits(-); balanced when 0
  for (const l of lines) {
    groups.add(l.entry_group_id);
    signedTotal += l.direction === 'debit' ? l.amount_cents : -l.amount_cents;
    const credit = l.direction === 'credit' ? l.amount_cents : -l.amount_cents;
    if (l.account === 'recipient_payable') recipientPayableCents += credit;
    else if (l.account === 'platform_revenue') platformRevenueCents += credit;
    else if (l.account === 'processor_fees') processorFeesCents += credit;
  }
  return {
    groupCount: groups.size,
    recipientPayableCents,
    platformRevenueCents,
    processorFeesCents,
    balanced: signedTotal === 0,
  };
}
