import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// §7 of the payments audit: partial refunds must not, in aggregate, refund more
// than was given.
//
// THE BUG THIS PINS. A partial refund leaves the donation `completed` — the
// status enum has no `partially_refunded` — so the "already refunded?" guard at
// the top of the route does not stop a second one. Each call was then clamped to
// the FULL principal, independently:
//
//   $100 donation, charge $111.43 ($100 + $8 tip + $3.43 processing)
//   refund $55  -> allowed, status stays `completed`
//   refund $55  -> allowed again; $110 refunded on a $100 donation
//
// $10 of that is CharitMe's tip and processing revenue, handed back without
// anyone asking for it, and the donation still reads `completed`.
//
// ⚠️ Stripe is only a backstop, and a loose one: it rejects once cumulative
// refunds exceed the CHARGE, and the charge is principal + tip + processing. The
// headroom above the principal is exactly where this happens quietly.
// ─────────────────────────────────────────────────────────────────────────────

const route = readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'admin', 'donations', '[id]', 'refund', 'route.ts'),
  'utf8',
);

describe('the cap is cumulative', () => {
  it('reads the prior refunds for this donation', () => {
    expect(route).toMatch(/from\('refunds'\)[\s\S]{0,120}\.eq\('donation_id', id\)/);
  });

  it('sums them in integer cents', () => {
    expect(route).toMatch(/reduce\(\(sum, r\) => sum \+ Number\(r\.amount_cents \?\? 0\), 0\)/);
  });

  it('clamps this refund to what REMAINS, not to the full principal', () => {
    // The whole defect in one line: the old clamp used don.amount_cents.
    expect(route).toContain('const remainingCents = don.amount_cents - alreadyRefunded');
    expect(route).toMatch(/Math\.min\(Math\.max\(1, Math\.round\(rawAmount\)\), remainingCents\)/);
    expect(route, 'the per-call clamp against the full principal must be gone').not.toMatch(
      /Math\.min\(Math\.max\(1, Math\.round\(rawAmount\)\), don\.amount_cents\)/,
    );
  });

  it('refuses outright when nothing remains', () => {
    expect(route).toContain("code: 'ALREADY_REFUNDED'");
    expect(route).toMatch(/if \(remainingCents <= 0\)/);
  });

  it('counts prior refunds when deciding this is the final one', () => {
    // Otherwise a donation refunded in two halves never flips to `refunded`, and
    // the ledger disagrees with Stripe about whether it is settled.
    expect(route).toContain('const isFullRefund = alreadyRefunded + refundCents >= don.amount_cents');
  });
});

describe('an unreadable refund history refuses the refund', () => {
  it('fails closed with 503 rather than assuming zero', () => {
    // ⚠️ Same rule as the ownership read and the tombstone check: an unknown
    // history is not an empty history, and guessing here refunds money that was
    // already returned.
    expect(route).toContain("code: 'REFUND_HISTORY_UNAVAILABLE'");
    expect(route).toMatch(/if \(priorError\)/);
    expect(route).toMatch(/status: 503/);
  });
});

describe('the Stripe call still reverses correctly', () => {
  it('reverses the transfer and the application fee', () => {
    // Destination charges: the principal already sits in the recipient's
    // account. A plain refund would come out of the PLATFORM balance while the
    // recipient keeps the money. Stripe prorates both flags for a partial
    // refund, so they stay correct under the new cumulative cap.
    expect(route).toContain('reverse_transfer: true');
    expect(route).toContain('refund_application_fee: true');
  });

  it('falls back to a plain refund only for non-destination charges', () => {
    expect(route).toMatch(/\/transfer\|application fee\|no such\/i\.test\(msg\)/);
  });
});
