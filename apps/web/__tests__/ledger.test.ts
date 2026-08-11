import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  imbalance,
  isBalanced,
  assertBalanced,
  buildDonationEntries,
  buildRefundEntries,
  buildDisputeLossEntries,
  reconcileAmounts,
  accountBalance,
  type LedgerLine,
} from '../lib/ledger-core';

// ─────────────────────────────────────────────────────────────────────────────
// Immutable double-entry ledger (spec §1.7). The ledger is the auditable record
// of every monetary event: every event MUST post a balanced group (debits ===
// credits), the ledger is append-only, and reconciliation compares the ledger
// to Stripe. These tests pin the pure accounting logic; the append-only + RLS
// guarantees are asserted by parsing the real migration SQL.
// ─────────────────────────────────────────────────────────────────────────────

describe('balance primitives', () => {
  it('imbalance is zero for an empty group', () => {
    expect(imbalance([])).toBe(0);
    expect(isBalanced([])).toBe(true);
  });

  it('imbalance = sum(debits) - sum(credits)', () => {
    const lines: LedgerLine[] = [
      { account: 'donor_clearing', direction: 'debit', amount_cents: 1000 },
      { account: 'recipient_payable', direction: 'credit', amount_cents: 600 },
      { account: 'platform_revenue', direction: 'credit', amount_cents: 400 },
    ];
    expect(imbalance(lines)).toBe(0);
    expect(isBalanced(lines)).toBe(true);
  });

  it('detects an unbalanced group', () => {
    const lines: LedgerLine[] = [
      { account: 'donor_clearing', direction: 'debit', amount_cents: 1000 },
      { account: 'recipient_payable', direction: 'credit', amount_cents: 900 },
    ];
    expect(imbalance(lines)).toBe(100);
    expect(isBalanced(lines)).toBe(false);
    expect(() => assertBalanced(lines)).toThrow(/unbalanced/i);
  });
});

describe('buildDonationEntries', () => {
  it('splits gross three ways and stays balanced', () => {
    const lines = buildDonationEntries({
      donationCents: 9500,
      platformFeeCents: 500,
      processorFeeCents: 320,
    });
    expect(isBalanced(lines)).toBe(true);

    // Donor is debited the full gross the card was charged.
    const gross = 9500 + 500 + 320;
    const debit = lines.find((l) => l.account === 'donor_clearing');
    expect(debit).toEqual({ account: 'donor_clearing', direction: 'debit', amount_cents: gross });

    // The recipient is only ever credited the net donation — never the fees.
    expect(accountBalance(lines, 'recipient_payable')).toBe(9500);
    expect(accountBalance(lines, 'platform_revenue')).toBe(500);
    expect(accountBalance(lines, 'processor_fees')).toBe(320);
  });

  it('omits zero-amount lines but stays balanced (no platform fee)', () => {
    const lines = buildDonationEntries({
      donationCents: 5000,
      platformFeeCents: 0,
      processorFeeCents: 175,
    });
    expect(isBalanced(lines)).toBe(true);
    expect(lines.some((l) => l.account === 'platform_revenue')).toBe(false);
    expect(accountBalance(lines, 'recipient_payable')).toBe(5000);
  });

  it('rejects negative split amounts', () => {
    expect(() =>
      buildDonationEntries({ donationCents: -1, platformFeeCents: 0, processorFeeCents: 0 }),
    ).toThrow(/non-negative/i);
  });
});

describe('buildRefundEntries', () => {
  it('claws back only the recipient payable on a fee-retained refund', () => {
    const lines = buildRefundEntries({ refundDonationCents: 9500 });
    expect(isBalanced(lines)).toBe(true);
    // recipient payable is debited (reversed), refunds credited the same total.
    expect(accountBalance(lines, 'recipient_payable')).toBe(-9500);
    expect(lines.some((l) => l.account === 'platform_revenue')).toBe(false);
    const refund = lines.find((l) => l.account === 'refunds');
    expect(refund).toEqual({ account: 'refunds', direction: 'credit', amount_cents: 9500 });
  });

  it('also reverses the platform fee on a full refund and stays balanced', () => {
    const lines = buildRefundEntries({ refundDonationCents: 9500, refundPlatformFeeCents: 500 });
    expect(isBalanced(lines)).toBe(true);
    expect(accountBalance(lines, 'recipient_payable')).toBe(-9500);
    expect(accountBalance(lines, 'platform_revenue')).toBe(-500);
    expect(accountBalance(lines, 'refunds')).toBe(10000);
  });

  it('records returned processing coverage as a platform adjustment', () => {
    const lines = buildRefundEntries({
      refundDonationCents: 10000,
      refundPlatformFeeCents: 800,
      refundProcessingCoverageCents: 353,
    });
    expect(accountBalance(lines, 'adjustments')).toBe(-353);
    expect(accountBalance(lines, 'refunds')).toBe(11153);
    expect(isBalanced(lines)).toBe(true);
  });

  it('separates recipient loss when campaign proceeds originally covered processing', () => {
    const lines = buildRefundEntries({
      refundDonationCents: 4828,
      refundPlatformFeeCents: 400,
      refundProcessingCoverageCents: 172,
    });
    expect(accountBalance(lines, 'recipient_payable')).toBe(-4828);
    expect(accountBalance(lines, 'platform_revenue')).toBe(-400);
    expect(accountBalance(lines, 'adjustments')).toBe(-172);
    expect(accountBalance(lines, 'refunds')).toBe(5400);
    expect(isBalanced(lines)).toBe(true);
  });

  it('rejects negative refund amounts', () => {
    expect(() => buildRefundEntries({ refundDonationCents: -100 })).toThrow(/non-negative/i);
  });
});

describe('buildDisputeLossEntries', () => {
  it('reverses recipient payable + fee into the disputes account (not refunds)', () => {
    const lines = buildDisputeLossEntries({ refundDonationCents: 9500, refundPlatformFeeCents: 500 });
    expect(isBalanced(lines)).toBe(true);
    expect(accountBalance(lines, 'recipient_payable')).toBe(-9500);
    expect(accountBalance(lines, 'platform_revenue')).toBe(-500);
    expect(accountBalance(lines, 'disputes')).toBe(10000);
    expect(lines.some((l) => l.account === 'refunds')).toBe(false);
  });

  it('keeps the loss channel distinct from a refund of the same amount', () => {
    const dispute = buildDisputeLossEntries({ refundDonationCents: 9500 });
    const refund = buildRefundEntries({ refundDonationCents: 9500 });
    expect(dispute.some((l) => l.account === 'disputes')).toBe(true);
    expect(refund.some((l) => l.account === 'refunds')).toBe(true);
    expect(accountBalance(dispute, 'recipient_payable')).toBe(accountBalance(refund, 'recipient_payable'));
  });

  it('rejects negative dispute amounts', () => {
    expect(() => buildDisputeLossEntries({ refundDonationCents: -1 })).toThrow(/non-negative/i);
  });

  it('balances a lost dispute including returned processing coverage', () => {
    const lines = buildDisputeLossEntries({
      refundDonationCents: 10000,
      refundPlatformFeeCents: 800,
      refundProcessingCoverageCents: 353,
    });
    expect(accountBalance(lines, 'adjustments')).toBe(-353);
    expect(accountBalance(lines, 'disputes')).toBe(11153);
    expect(isBalanced(lines)).toBe(true);
  });
});

describe('reconcileAmounts', () => {
  it('matches when ledger equals Stripe', () => {
    expect(reconcileAmounts(10000, 10000)).toEqual({ matched: true, differenceCents: 0 });
  });

  it('reports a signed difference when they diverge', () => {
    expect(reconcileAmounts(10000, 9990)).toEqual({ matched: false, differenceCents: 10 });
    expect(reconcileAmounts(9990, 10000)).toEqual({ matched: false, differenceCents: -10 });
  });
});

describe('round-trip: donation then full refund nets to zero', () => {
  it('recipient payable returns to zero after refund', () => {
    const donation = buildDonationEntries({
      donationCents: 9500,
      platformFeeCents: 500,
      processorFeeCents: 320,
    });
    const refund = buildRefundEntries({ refundDonationCents: 9500, refundPlatformFeeCents: 500 });
    const all = [...donation, ...refund];
    expect(accountBalance(all, 'recipient_payable')).toBe(0);
    expect(accountBalance(all, 'platform_revenue')).toBe(0);
  });
});

// ── Append-only + RLS guarantees, asserted against the real migration SQL ──────
describe('ledger migration hardening', () => {
  const sql = readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../supabase/migrations/20260723001000_financial_ledger.sql',
    ),
    'utf8',
  ).toLowerCase();

  it('blocks UPDATE and DELETE on ledger_entries (append-only)', () => {
    expect(sql).toMatch(/prevent_ledger_mutation/);
    expect(sql).toMatch(/before update on ledger_entries/);
    expect(sql).toMatch(/before delete on ledger_entries/);
  });

  it('enforces idempotency with a unique index', () => {
    expect(sql).toMatch(/create unique index[\s\S]*ledger_entries\(idempotency_key/);
  });

  it('enables RLS and restricts reads to admins', () => {
    expect(sql).toMatch(/alter table ledger_entries\s+enable row level security/);
    expect(sql).toMatch(/for select using \(is_admin\(\)\)/);
  });

  it('constrains amounts to be non-negative at the database level', () => {
    expect(sql).toMatch(/amount_cents\s+bigint not null check \(amount_cents >= 0\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A BALANCED group can still be unpostable, and it fails silently.
//
// Every line in a group shares one idempotency key, and the unique index is
// (idempotency_key, account, direction). Two lines with the same account AND
// direction therefore collide with EACH OTHER on the first insert —
// `postEntryGroup` catches 23505 and returns { posted: false }, which is its
// "already handled" signal. The donation row is written, Stripe gets a 200, and
// the money never reaches the ledger, with no error raised anywhere.
//
// The invariant previously lived only in the shape of three literal arrays.
// ─────────────────────────────────────────────────────────────────────────────
describe('a group cannot collide with itself', () => {
  const slots = (lines: readonly { account: string; direction: string }[]) =>
    lines.map((l) => `${l.account}:${l.direction}`);

  it('rejects a group that posts the same account and direction twice', () => {
    expect(() =>
      assertBalanced([
        { account: 'donor_clearing', direction: 'debit', amount_cents: 1000 },
        { account: 'platform_revenue', direction: 'credit', amount_cents: 400 },
        { account: 'platform_revenue', direction: 'credit', amount_cents: 600 },
      ] as never),
    ).toThrow(/twice/);
  });

  it('still accepts the same account in OPPOSITE directions', () => {
    // Not a collision: the index includes direction, so these are separate rows.
    expect(() =>
      assertBalanced([
        { account: 'recipient_payable', direction: 'debit', amount_cents: 1000 },
        { account: 'recipient_payable', direction: 'credit', amount_cents: 1000 },
      ] as never),
    ).not.toThrow();
  });

  it('every builder holds the invariant across its input space, not at one point', () => {
    // A single sample would pass even if some amount combination emitted a
    // duplicate line, so this sweeps the boundaries that change which lines are
    // emitted at all — zero fees in particular, since PLATFORM_FEE_PERCENT is 0
    // and the zero-amount line is omitted.
    const amounts = [0, 1, 30, 250, 100_000];
    for (const donationCents of amounts) {
      for (const platformFeeCents of amounts) {
        for (const processorFeeCents of amounts) {
          const lines = buildDonationEntries({ donationCents, platformFeeCents, processorFeeCents });
          const s = slots(lines);
          expect(new Set(s).size, `donation ${donationCents}/${platformFeeCents}/${processorFeeCents}`)
            .toBe(s.length);
          expect(() => assertBalanced(lines)).not.toThrow();
        }
      }
    }
    for (const donation of amounts) {
      for (const fee of amounts) {
        for (const build of [buildRefundEntries, buildDisputeLossEntries]) {
          const lines = build({ refundDonationCents: donation, refundPlatformFeeCents: fee });
          const s = slots(lines);
          expect(new Set(s).size, `${build.name} ${donation}/${fee}`).toBe(s.length);
          expect(() => assertBalanced(lines)).not.toThrow();
        }
      }
    }
  });

  it('the unique index really is (key, account, direction)', () => {
    // The whole hazard follows from the index shape. If it ever becomes
    // (key) alone, a group of 4 lines could never post at all; if it drops
    // direction, the opposite-direction case above starts colliding.
    const sql = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../supabase/migrations/20260723001000_financial_ledger.sql',
      ),
      'utf8',
    ).toLowerCase();
    expect(sql).toMatch(/ledger_entries\(idempotency_key,\s*account,\s*direction\)/);
  });
});
