import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { donationBreakdown, DEFAULT_DONOR_TIP_PERCENT } from '@shared/fees';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'app', 'campaigns', '[slug]', 'DonateButton.tsx'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

// ─────────────────────────────────────────────────────────────────────────────
// The breakdown says WHO is taking each part of the money. Simplifying it by
// merging rows is exactly how that stops being true.
//
// ⚠️ MEASURED, not hypothetical. A build that folded the CharitMe fee into the
// processing line rendered this for a $50 donation with a $122.00 custom fee:
//
//     Donation                        $50.00
//     Processing Fee (Estimated)     $127.29     ← $122.00 ours + $5.29 Stripe
//     Recipient receives              $50.00
//     You pay                        $177.29
//
// Every number was arithmetically correct and the recipient really did receive
// $50, so nothing looked broken. It simply told the donor that Stripe charged
// $127.29, when Stripe charged $5.29 and the remaining $122 was our own optional
// fee — which the donor had set themselves and could have set to zero.
//
// The reproduction below is the actual arithmetic, kept as executable evidence.
// ─────────────────────────────────────────────────────────────────────────────

describe('the merged-row defect, reproduced exactly', () => {
  const b = donationBreakdown({
    amountCents: 5_000,
    supportPercent: 15,
    supportCentsOverride: 12_200,
    method: 'stripe',
    coverProcessing: true,
  });

  it('produces the screenshot to the cent', () => {
    expect(b.supportCents).toBe(12_200);          // $122.00 — ours, donor-set
    expect(b.processingCents).toBe(529);          // $5.29   — Stripe's
    expect(b.supportCents + b.processingCents).toBe(12_729); // the $127.29 shown
    expect(b.totalChargedCents).toBe(17_729);     // "You pay $177.29"
    expect(b.netToRecipientCents).toBe(5_000);    // "Recipient receives $50.00"
  });

  it('shows how badly the merge misattributes — 24x Stripe\'s actual fee', () => {
    const merged = b.supportCents + b.processingCents;
    expect(merged / b.processingCents).toBeGreaterThan(24);
  });
});

describe('the rendered breakdown keeps the two fees apart', () => {
  it('still has a distinct CharitMe fee row', () => {
    expect(code).toMatch(/label="CharitMe fee \(optional\)"/);
  });

  it('the processing row renders ONLY the processing figure', () => {
    // `breakdown.processing`, never a sum. A `breakdown.tip + breakdown.processing`
    // here is the defect above, restored.
    expect(code).toMatch(/value=\{money\(breakdown\.processing\)\}/);
    expect(code, 'the processing row must not add the CharitMe fee into itself')
      .not.toMatch(/money\(breakdown\.processing \+ breakdown\.tip\)/);
    expect(code)
      .not.toMatch(/money\(breakdown\.tip \+ breakdown\.processing\)/);
  });

  it('hides the CharitMe row only when it is exactly zero', () => {
    // `> 0`, not truthiness or a rounding tolerance: any non-zero fee, however
    // small, is money the donor is being asked for and must be itemised.
    expect(code).toMatch(/\{breakdown\.tip > 0 && \(/);
  });

  it('still states the total and what the recipient gets', () => {
    expect(code).toMatch(/You pay\{isMonthly \? '\/month' : ''\}/);
    expect(code).toMatch(/Recipient receives/);
    expect(code).toMatch(/100% of your donation/);
  });
});

describe('the zero-fee case is the clean three-row breakdown', () => {
  it('a donor who declines the fee sees only donation + processing', () => {
    const b = donationBreakdown({
      amountCents: 5_000,
      supportPercent: 0,
      method: 'stripe',
      coverProcessing: true,
    });
    expect(b.supportCents).toBe(0);
    // With the row hidden at zero, what remains is Donation / Processing /
    // Recipient receives / You pay — the simple shape, reached honestly.
    expect(b.processingCents).toBe(175);
    expect(b.totalChargedCents).toBe(5_175);
    expect(b.netToRecipientCents).toBe(5_000);
  });

  it('the default is a fee the donor can see and remove', () => {
    const b = donationBreakdown({
      amountCents: 5_000,
      supportPercent: DEFAULT_DONOR_TIP_PERCENT,
      method: 'stripe',
      coverProcessing: true,
    });
    expect(b.supportCents).toBe(750);
    expect(b.totalChargedCents).toBe(5_947);
  });
});
