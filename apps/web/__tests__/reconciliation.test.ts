import { describe, expect, it } from 'vitest';
import {
  reconcileDonation,
  reconcileDonations,
  observeLedger,
  canTransitionException,
  isTerminalException,
  EXCEPTION_STATUSES,
  type DonationToReconcile,
  type ExceptionStatus,
} from '../lib/reconciliation-core';
import { buildDonationEntries } from '../lib/ledger-core';

// ─────────────────────────────────────────────────────────────────────────────
// Daily reconciliation: every captured donation must be mirrored by exactly one
// balanced ledger group whose credits match the disclosed split. These tests
// pin the detection logic for missing / duplicated / unbalanced / mis-split
// ledger footprints. See docs — reconciliation-core.ts.
// ─────────────────────────────────────────────────────────────────────────────

const expected = { donationCents: 9500, platformFeeCents: 500, processorFeeCents: 320 };

/** Build the exact ledger observation a correct donation posting would produce. */
function correctLedger(group = 'g1') {
  const lines = buildDonationEntries(expected).map((l) => ({ ...l, entry_group_id: group }));
  return observeLedger(lines);
}

function item(overrides: Partial<DonationToReconcile> = {}): DonationToReconcile {
  return {
    donationId: 'don_1',
    campaignId: 'camp_1',
    expected,
    ledger: correctLedger(),
    ...overrides,
  };
}

describe('observeLedger', () => {
  it('folds real donation lines into a balanced single-group observation', () => {
    const obs = correctLedger();
    expect(obs).toEqual({
      groupCount: 1,
      recipientPayableCents: 9500,
      platformRevenueCents: 500,
      processorFeesCents: 320,
      balanced: true,
    });
  });

  it('counts distinct entry groups', () => {
    const g1 = buildDonationEntries(expected).map((l) => ({ ...l, entry_group_id: 'g1' }));
    const g2 = buildDonationEntries(expected).map((l) => ({ ...l, entry_group_id: 'g2' }));
    expect(observeLedger([...g1, ...g2]).groupCount).toBe(2);
  });

  it('flags an unbalanced set of lines', () => {
    const obs = observeLedger([
      { account: 'donor_clearing', direction: 'debit', amount_cents: 1000, entry_group_id: 'g1' },
      { account: 'recipient_payable', direction: 'credit', amount_cents: 900, entry_group_id: 'g1' },
    ]);
    expect(obs.balanced).toBe(false);
  });
});

describe('reconcileDonation', () => {
  it('returns no findings when the ledger matches exactly', () => {
    expect(reconcileDonation(item())).toEqual([]);
  });

  it('flags a completely missing ledger group and stops there', () => {
    const findings = reconcileDonation(
      item({ ledger: { groupCount: 0, recipientPayableCents: 0, platformRevenueCents: 0, processorFeesCents: 0, balanced: true } }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('missing_ledger');
    expect(findings[0].expectedCents).toBe(9500 + 500 + 320);
  });

  it('flags a double-posted donation', () => {
    const dup = { ...correctLedger(), groupCount: 2 };
    const findings = reconcileDonation(item({ ledger: dup }));
    expect(findings.map((f) => f.kind)).toContain('duplicate');
  });

  it('flags an unbalanced group', () => {
    const findings = reconcileDonation(item({ ledger: { ...correctLedger(), balanced: false } }));
    expect(findings.map((f) => f.kind)).toContain('unbalanced_group');
  });

  it('flags a recipient-payable amount mismatch', () => {
    const findings = reconcileDonation(
      item({ ledger: { ...correctLedger(), recipientPayableCents: 9000 } }),
    );
    const amt = findings.find((f) => f.kind === 'amount_mismatch');
    expect(amt).toBeTruthy();
    expect(amt!.expectedCents).toBe(9500);
    expect(amt!.actualCents).toBe(9000);
  });

  it('flags platform and processor fee mismatches independently', () => {
    const platform = reconcileDonation(
      item({ ledger: { ...correctLedger(), platformRevenueCents: 400 } }),
    );
    expect(platform.filter((f) => f.kind === 'fee_mismatch')).toHaveLength(1);

    const processor = reconcileDonation(
      item({ ledger: { ...correctLedger(), processorFeesCents: 999 } }),
    );
    expect(processor.filter((f) => f.kind === 'fee_mismatch')).toHaveLength(1);
  });
});

describe('reconcileDonations (batch)', () => {
  it('summarizes clean vs. exception rows and rolls up counts by kind', () => {
    const summary = reconcileDonations([
      item({ donationId: 'ok_1' }),
      item({ donationId: 'ok_2' }),
      item({
        donationId: 'bad_1',
        ledger: { groupCount: 0, recipientPayableCents: 0, platformRevenueCents: 0, processorFeesCents: 0, balanced: true },
      }),
      item({ donationId: 'bad_2', ledger: { ...correctLedger(), recipientPayableCents: 1 } }),
    ]);
    expect(summary.checked).toBe(4);
    expect(summary.clean).toBe(2);
    expect(summary.byKind.missing_ledger).toBe(1);
    expect(summary.byKind.amount_mismatch).toBe(1);
    expect(summary.findings).toHaveLength(2);
  });

  it('a real buildDonationEntries posting reconciles clean end-to-end', () => {
    const summary = reconcileDonations([item()]);
    expect(summary.clean).toBe(1);
    expect(summary.findings).toEqual([]);
  });
});

describe('exception workflow state machine', () => {
  it('open can be claimed, resolved, or ignored — but not stay nowhere', () => {
    expect(canTransitionException('open', 'assigned')).toBe(true);
    expect(canTransitionException('open', 'resolved')).toBe(true);
    expect(canTransitionException('open', 'ignored')).toBe(true);
  });

  it('assigned can be resolved, ignored, or handed back to open', () => {
    expect(canTransitionException('assigned', 'resolved')).toBe(true);
    expect(canTransitionException('assigned', 'ignored')).toBe(true);
    expect(canTransitionException('assigned', 'open')).toBe(true);
  });

  it('terminal states can only be re-opened', () => {
    expect(canTransitionException('resolved', 'open')).toBe(true);
    expect(canTransitionException('ignored', 'open')).toBe(true);
    expect(canTransitionException('resolved', 'assigned')).toBe(false);
    expect(canTransitionException('ignored', 'resolved')).toBe(false);
  });

  it('same-state is a no-op (allowed)', () => {
    for (const s of EXCEPTION_STATUSES) {
      expect(canTransitionException(s as ExceptionStatus, s as ExceptionStatus)).toBe(true);
    }
  });

  it('flags resolved and ignored as terminal', () => {
    expect(isTerminalException('resolved')).toBe(true);
    expect(isTerminalException('ignored')).toBe(true);
    expect(isTerminalException('open')).toBe(false);
    expect(isTerminalException('assigned')).toBe(false);
  });
});
