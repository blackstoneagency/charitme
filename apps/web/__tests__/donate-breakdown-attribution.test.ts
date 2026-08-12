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
//     Processing Fee (Estimated)     $127.45     ← $122.00 ours + $5.45 Stripe
//     Recipient receives              $50.00
//     You pay                        $177.45
//
// Every number was arithmetically correct and the recipient really did receive
// $50, so nothing looked broken. It simply told the donor that Stripe charged
// $127.45, when Stripe charged $5.45 and the remaining $122 was our own optional
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
    expect(b.processingCents).toBe(545);          // $5.45   — Stripe's
    expect(b.supportCents + b.processingCents).toBe(12_745); // the $127.45 shown
    expect(b.totalChargedCents).toBe(17_745);     // "You pay $177.45"
    expect(b.netToRecipientCents).toBe(5_000);    // "Recipient receives $50.00"
  });

  it('shows how badly the merge misattributes — over 23x Stripe\'s actual fee', () => {
    const merged = b.supportCents + b.processingCents;
    expect(merged / b.processingCents).toBeGreaterThan(23);
  });
});

describe('the rendered breakdown sums honestly', () => {
  it('shows ONE fees line, matching the requested three-row shape', () => {
    expect(code).toMatch(/value=\{money\(breakdown\.tip \+ breakdown\.processing\)\}/);
  });

  it('never names that sum after the processor', () => {
    // ⚠️ THE invariant. Summing the two fees is fine; calling the sum
    // "Processing fee" says Stripe took $127.29 when Stripe took $5.29.
    //
    // Checked as plain substrings rather than by parsing `label={...}`: the
    // label is a ternary, so a regex expecting a quote straight after `label={`
    // matched nothing and the first version of this assertion passed vacuously.
    expect(code, 'the summed row must be labelled "Fees (estimated)"')
      .toContain('Fees (estimated)');
    expect(code, 'no row may call the combined figure a processing fee')
      .not.toMatch(/Processing fee \(estimated\)/i);
  });

  it('keeps the split reachable, for pointer AND assistive tech', () => {
    // A `title`-only tooltip is invisible to keyboard and screen-reader users,
    // and this is the row where the itemisation actually matters.
    expect(code).toMatch(/CharitMe fee \$\{money\(breakdown\.tip\)\} \+ processing \$\{money\(breakdown\.processing\)\}/);
    expect(code).toMatch(/'aria-label': `\$\{label\}: \$\{value\}\. \$\{detail\}\.`/);
    expect(code).toMatch(/title: detail/);
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
    // The rendered shape is Donation / Fees (estimated) / Recipient receives /
    // You pay in every case — three rows above the total, as requested.
    expect(b.processingCents).toBe(180);
    expect(b.totalChargedCents).toBe(5_180);
    expect(b.netToRecipientCents).toBe(5_000);
  });

  it('the default is a fee the donor can see and remove', () => {
    const b = donationBreakdown({
      amountCents: 5_000,
      supportPercent: DEFAULT_DONOR_TIP_PERCENT,
      method: 'stripe',
      coverProcessing: true,
    });
    // 10% of $50.00 — the suggested rate, not the top of the ladder.
    expect(b.supportCents).toBe(500);
    // $50.00 + $5.00 support + enough coverage for 2.9% + 30c on the final charge.
    expect(b.totalChargedCents).toBe(5_695);
  });
});
