import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  METHOD_FEES,
  SUPPORT_TIER_PERCENTS,
  SUGGESTED_SUPPORT_PERCENT,
  methodProcessingFee,
  donationBreakdown,
} from '@shared/fees';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'app', 'campaigns', '[slug]', 'DonateButton.tsx'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

// ─────────────────────────────────────────────────────────────────────────────
// The donate panel discloses TWO separate charges: the payment processor's fee
// and CharitMe's optional service fee (the tip).
//
// They are now one progressive disclosure rather than two stacked accordions:
// the payment selector comes first, and opening it reveals both the per-method
// processor rates and the CharitMe service fee beneath them.
//
// ⚠️ Collapsing the service fee out of view is only defensible because the
// COLLAPSED SUMMARY STILL STATES IT ("2.9% + $0.30 + 15%"). Remove that and the
// change becomes a dark pattern: a 15% charge the donor cannot see. Several
// assertions below exist purely to keep that bargain enforceable.
// ─────────────────────────────────────────────────────────────────────────────

describe('the payment selector leads, and reveals the service fee', () => {
  it('renders the payment method block BEFORE the service fee block', () => {
    const pay = code.indexOf('Payment method &amp; processing fee estimate');
    // ⚠️ Anchored on the panel wiring, which appears ONLY in the JSX section.
    // Two earlier anchors were wrong and both silently measured the wrong
    // thing: "CharitMe fee" also occurs in the payment row's aria-label, and
    // `setServiceOpen` also occurs in the useState declaration at the top of
    // the component — each sits before the gate and inverted the comparison.
    const svc = code.indexOf('aria-controls="service-fee-panel"');
    expect(pay).toBeGreaterThan(-1);
    expect(svc).toBeGreaterThan(-1);
    expect(pay, 'the payment selector is the entry point and must come first').toBeLessThan(svc);
  });

  it('gates the service fee on the payment dropdown being open', () => {
    // ⚠️ `toMatch(/\{methodOpen && \(/)` is NOT enough, and this comment is here
    // because that was the first version of this test. There are TWO such gates
    // — one wraps the payment-method radio list, one wraps the service fee — so
    // a bare match still passed after the service-fee gate was deleted. The
    // assertion has to pin the gate that immediately precedes the service fee.
    const gates = [...code.matchAll(/\{methodOpen && \(/g)].map((m) => m.index ?? -1);
    expect(gates.length, 'expected a gate for the method list AND one for the service fee')
      .toBe(2);

    // Same anchoring trap as above — see that comment.
    const svc = code.indexOf('aria-controls="service-fee-panel"');
    const gateBeforeService = gates.filter((i) => i < svc).pop();
    expect(gateBeforeService, 'no methodOpen gate precedes the service fee block').toBeDefined();

    // The gate must not CLOSE before the service fee, or it wraps the radio list
    // instead and the fee is ungated.
    //
    // ⚠️ Checked against the gate's own closing LINE (`      )}` at its
    // indentation), not a bare `)}` substring. The first version used the
    // substring and failed on correct code, because the section's own button
    // contains `setServiceOpen((o) => !o)}` — a `)}` that closes an arrow
    // function, not the gate.
    const between = src.slice(
      src.indexOf('{methodOpen && (', src.indexOf('CharitMe fee — revealed')),
      src.indexOf('aria-controls="service-fee-panel"'),
    );
    expect(
      /\n {6}\)\}/.test(between),
      'the gate closes before the service fee — it wraps something else',
    ).toBe(false);
  });

  it('still lets the donor expand the service fee itself', () => {
    // The second arrow in the screenshots. Losing this would show the tip but
    // give no way to change it.
    expect(code).toMatch(/setServiceOpen\(\(o\) => !o\)/);
    expect(code).toMatch(/aria-expanded=\{serviceOpen\}/);
  });
});

describe('the collapsed summary states BOTH charges — the whole bargain', () => {
  it('combines the processor rate and the service fee when collapsed', () => {
    expect(code).toMatch(
      /const collapsedRate = methodOpen \? selFee\.label : `\$\{selFee\.label\} \$\{feeRate\}`/,
    );
  });

  it('shows a custom tip in CURRENCY, not a re-derived percent', () => {
    // Re-deriving a percentage from a typed amount rounds, and would disagree
    // with the itemised breakdown directly below it.
    expect(code).toMatch(
      /const feeRate = customTipCents != null \? `\+ \$\{money\(customTipCents\)\}` : `\+ \$\{tipPercent\}%`/,
    );
  });

  it('renders that combined value in the row, not just the method fee', () => {
    expect(code).toMatch(/>\{collapsedRate\}<\/span>/);
    expect(code, 'the raw method label would drop the service fee from the summary')
      .not.toMatch(/>\{selFee\.label\}<\/span>/);
  });

  it('announces the same thing to screen readers', () => {
    // A sighted donor sees "+ 15%"; a screen-reader user must not be told only
    // the processor rate.
    expect(code).toMatch(/aria-label=\{`Payment method: \$\{sel\.label\}, \$\{collapsedRate\}/);
  });
});

describe('the fee model behind the UI is real, and shared with the server', () => {
  it('offers every tier in the screenshots, including 0%', () => {
    // Support is optional and never forced — one click from zero.
    expect([...SUPPORT_TIER_PERCENTS]).toEqual([15, 12, 10, 8, 5, 3, 1, 0]);
    expect(SUPPORT_TIER_PERCENTS).toContain(0);
    expect(SUGGESTED_SUPPORT_PERCENT).toBe(10);
  });

  it('quotes the same per-method rates the screenshots show', () => {
    expect(METHOD_FEES.stripe.label).toBe('2.9% + $0.30');
    expect(METHOD_FEES.gpay.label).toBe('2.9% + $0.30');
    expect(METHOD_FEES.bank.label).toBe('0.8% (max $5)');
    expect(METHOD_FEES.card.label).toBe('2.9% + $0.30');
  });

  it('honours the bank-transfer cap the label promises', () => {
    // $5 cap: a $1,000 transfer must not be charged 0.8% ($8).
    expect(methodProcessingFee(100_000, 'bank')).toBe(500);
    expect(methodProcessingFee(10_000, 'bank')).toBe(80);
  });

  it('computes the shown total with the SAME helper the API charges with', () => {
    // The client calls donationBreakdown(); /api/donations calls
    // methodProcessingFee() on the donation+tip sub-total. If these disagreed,
    // the donor would be charged something other than the figure on screen.
    expect(code).toMatch(/donationBreakdown\(\{/);
    const amount = 50_000;
    const b = donationBreakdown({
      amountCents: amount,
      supportPercent: 15,
      method: 'stripe',
      coverProcessing: true,
    });
    expect(b.supportCents).toBe(7_500);
    expect(b.processingCents).toBe(methodProcessingFee(amount + b.supportCents, 'stripe'));
    expect(b.totalChargedCents).toBe(amount + b.supportCents + b.processingCents);
    // The recipient still receives the full donation — the fees are additive,
    // not deducted from it. That is the "0% platform fee" claim, checked.
    expect(b.netToRecipientCents).toBe(amount);
  });
});
