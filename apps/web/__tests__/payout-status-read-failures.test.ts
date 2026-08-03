import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// The payout surface must not state someone's account status from a failed read.
//
// These three endpoints all fail CLOSED, so no money moves either way — which is
// why they ranked below the donation and webhook fixes. They are still wrong,
// and wrong in a way that costs a fundraiser real time:
//
//   /api/payouts                      → "Complete Stripe onboarding before
//                                        accessing payouts" to a VERIFIED account
//   /api/stripe/connect/status        → `{ connected: false }`, which the UI
//                                        renders as "connect your Stripe account"
//   /api/campaigns/[id]/payout-status → 404 "Campaign not found" to the
//                                        campaign's own organizer, plus a setup
//                                        checklist telling a fully-connected
//                                        beneficiary to go and connect
//
// `!!(row?.payouts_enabled && …)` on an unreadable row is `false`, and `false`
// here is a claim: "we looked, and you are not set up". It must only be said
// when we actually looked.
//
// Source-level, matching the convention in `donation-read-failures.test.ts`:
// these branches need Stripe + Supabase + auth mocked to exercise, and the
// decision being pinned is visible in the source.
// ─────────────────────────────────────────────────────────────────────────────

const ROUTES = [
  { name: 'payouts', rel: '../app/api/payouts/route.ts', code: 'CONNECT_STATUS_UNAVAILABLE' },
  { name: 'connect/status', rel: '../app/api/stripe/connect/status/route.ts', code: 'CONNECT_STATUS_UNAVAILABLE' },
  { name: 'payout-status', rel: '../app/api/campaigns/[id]/payout-status/route.ts', code: 'PAYOUT_STATUS_UNAVAILABLE' },
];

/** Strip comments so prose ABOVE a fix cannot satisfy an assertion about it. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('payout surface never reports a failed read as account status', () => {
  for (const { name, rel, code } of ROUTES) {
    const src = strip(readFileSync(join(here, rel), 'utf8'));

    it(`${name}: captures the read error instead of discarding it`, () => {
      expect(src, 'every connected_accounts / campaigns read here must bind `error`')
        .toMatch(/error:\s*\w*(?:Error|error)\b/);
    });

    it(`${name}: answers 503 rather than asserting "not set up"`, () => {
      expect(src).toContain(code);
      expect(src, 'the unavailable branch must be a 503, not a 400/404/200')
        .toMatch(new RegExp(`${code}[\\s\\S]{0,120}?status:\\s*503`));
    });

    it(`${name}: reads go through a boundedQuery thunk`, () => {
      // Without the thunk the supabaseAdmin Proxy throws while the argument is
      // evaluated, so `error` is never populated and the 503 branch above can
      // never run — the route just 500s.
      expect(src).toMatch(/boundedQuery\(\(\)\s*=>/);
    });
  }

  it('payout-status: the 503 precedes the not-found branch', () => {
    const src = strip(readFileSync(join(here, ROUTES[2].rel), 'utf8'));
    const at503 = src.indexOf('PAYOUT_STATUS_UNAVAILABLE');
    const at404 = src.indexOf('Campaign not found');
    expect(at503).toBeGreaterThan(-1);
    expect(at404).toBeGreaterThan(-1);
    expect(at503, 'an unreadable campaign must not fall through to 404').toBeLessThan(at404);
  });

  it('payout-status: both connect booleans are guarded, not just one', () => {
    const src = strip(readFileSync(join(here, ROUTES[2].rel), 'utf8'));
    // The organizer and the beneficiary are separate reads; guarding one and
    // leaving the other still renders a wrong checklist, just half as often.
    expect(src).toMatch(/beneficiaryError/);
    expect(src).toMatch(/organizerError/);
    expect(
      (src.match(/PAYOUT_STATUS_UNAVAILABLE/g) ?? []).length,
      'campaign + beneficiary + organizer = three guarded reads',
    ).toBe(3);
  });

  it('the rule is not vacuous — it rejects the original shape', () => {
    const original = `
      const { data: connectedAccount } = await supabaseAdmin
        .from('connected_accounts').select('payouts_enabled').maybeSingle();
      if (!connectedAccount?.payouts_enabled) {
        return NextResponse.json({ error: 'Complete Stripe onboarding' }, { status: 400 });
      }
    `;
    expect(original).not.toMatch(/CONNECT_STATUS_UNAVAILABLE/);
    expect(original).not.toMatch(/boundedQuery\(\(\)\s*=>/);
  });
});
