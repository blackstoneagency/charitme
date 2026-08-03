import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// On the DONATION path, a failed read must never be reported as a fact.
//
// Both routes destructured only `{ data }` from their Supabase lookups and threw
// the `error` away. Three consequences, all of them reaching a donor mid-checkout:
//
//   1. Campaign lookup fails  → `!campaign` → **404 "Campaign not found"**.
//      A live fundraiser is declared nonexistent because a query timed out.
//
//   2. Reward lookup fails    → **404 "Reward not found"** (one-time route).
//      Worse than it reads: the donor picked a real perk, and the obvious
//      recovery is to retry WITHOUT it — completing a gift that silently drops
//      the reward they chose.
//
//   3. `campaign_launch_settings` lookup fails → `normalizeCurrency(undefined)`
//      → **USD**. A GBP or EUR campaign's donor is charged in DOLLARS. That is a
//      wrong amount taken from a real card, and it is invisible afterwards
//      because the donation records the currency it charged. On the RECURRING
//      route it repeats every period until cancelled.
//
// The correct answer is the one this route already used for the organizer
// suspension check: 503 with "we could not process this right now" — we could not
// determine the fact, so we do not proceed and we do not assert anything false.
//
// Source-level assertions, matching the convention in
// `donations-respect-accept-toggle.test.ts`: exercising these branches for real
// would need the whole Stripe + Supabase + auth stack mocked, and the decision
// being pinned is visible in the source.
// ─────────────────────────────────────────────────────────────────────────────

const ROUTES = [
  { name: 'one-time', rel: '../app/api/donations/route.ts', hasRewards: true },
  { name: 'recurring', rel: '../app/api/donations/recurring/route.ts', hasRewards: false },
];

/** Strip comments so the prose ABOVE a fix cannot satisfy an assertion about it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('donation routes never turn a failed read into a claim', () => {
  for (const { name, rel, hasRewards } of ROUTES) {
    const src = code(readFileSync(join(here, rel), 'utf8'));

    it(`${name}: campaign lookup separates "unreadable" from "missing"`, () => {
      expect(src, 'the campaign read must capture `error`, not discard it')
        .toMatch(/data:\s*campaign,\s*error:\s*campaignError/);
      expect(src, 'an unreadable campaign must answer 503, never 404 "not found"')
        .toMatch(/campaignError[\s\S]{0,400}?CAMPAIGN_LOOKUP_UNAVAILABLE/);
      expect(src, 'the 503 must come BEFORE the not-found branch')
        .toMatch(/CAMPAIGN_LOOKUP_UNAVAILABLE[\s\S]*?Campaign not found/);
    });

    it(`${name}: campaign lookup uses maybeSingle, so "no rows" is not an error`, () => {
      // `.single()` reports zero rows AS AN ERROR. Under the rule above that
      // would route every genuinely missing campaign into the 503 branch — the
      // opposite failure, and just as wrong.
      const campaignRead = src.slice(src.indexOf("from('campaigns')"));
      expect(campaignRead.slice(0, 400), 'the campaign read must use .maybeSingle()')
        .toMatch(/\.maybeSingle\(\)/);
    });

    it(`${name}: a failed currency read stops checkout instead of defaulting to USD`, () => {
      expect(src, 'the launch-settings read must capture `error`')
        .toMatch(/data:\s*launchSettings,\s*error:\s*launchSettingsError/);
      expect(src, 'an unreadable currency must answer 503 before normalizeCurrency runs')
        .toMatch(/launchSettingsError[\s\S]{0,400}?CURRENCY_LOOKUP_UNAVAILABLE/);
      const guardAt = src.indexOf('CURRENCY_LOOKUP_UNAVAILABLE');
      const useAt = src.indexOf('normalizeCurrency(launchSettings');
      expect(guardAt, 'the currency guard must precede the currency being used').toBeLessThan(useAt);
    });

    if (hasRewards) {
      it(`${name}: a failed reward read does not claim the reward is missing`, () => {
        expect(src).toMatch(/data:\s*reward,\s*error:\s*rewardError/);
        expect(src).toMatch(/rewardError[\s\S]{0,400}?REWARD_LOOKUP_UNAVAILABLE/);
        expect(src, 'the 503 must come BEFORE the not-found branch')
          .toMatch(/REWARD_LOOKUP_UNAVAILABLE[\s\S]*?REWARD_NOT_FOUND/);
      });
    }

    it(`${name}: reads go through boundedQuery so a Proxy throw becomes an error`, () => {
      // `supabaseAdmin` is a Proxy whose `get` trap throws when the service-role
      // env is missing, so `.from(...)` throws while the ARGUMENT is evaluated.
      // Without the thunk that never becomes `{ error }` and the checks above
      // cannot fire at all — the route just 500s.
      expect(src).toMatch(/boundedQuery\(\(\)\s*=>\s*[\s\S]{0,80}supabaseAdmin[\s\S]{0,200}from\('campaigns'\)/);
      expect(src).toMatch(/boundedQuery\(\(\)\s*=>\s*[\s\S]{0,80}supabaseAdmin[\s\S]{0,200}from\('campaign_launch_settings'\)/);
    });
  }

  it('the detector is not vacuous — it rejects the original shape', () => {
    const original = `
      const { data: campaign } = await supabaseAdmin
        .from('campaigns').select('id').eq('id', campaignId).single();
      if (!campaign)
        return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
    `;
    expect(original).not.toMatch(/data:\s*campaign,\s*error:\s*campaignError/);
    expect(original).not.toMatch(/CAMPAIGN_LOOKUP_UNAVAILABLE/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The webhook has the same rule with a sharper consequence.
//
// Money has ALREADY MOVED by the time these handlers run. Returning early
// answers 200 to Stripe, which means **no retry, ever** — so an unreadable row
// left a permanent divergence:
//
//   refund  → donation stays `completed`, campaign keeps counting money it has
//             already given back
//   dispute → the chargeback exists at Stripe with no record here at all
//
// This file's own contract everywhere else (the recurring handlers at
// `record_donation failed`, `Recurring donation renewal could not be recorded`,
// …) is to THROW: the webhook 500s, Stripe redelivers, and the work is
// idempotent on the event id, so a retry is safe. These two paths were the
// outliers that swallowed instead.
//
// "No row" remains a legitimate early return in both — a refund for a payment we
// never recorded genuinely has nothing to update. Only a read ERROR throws.
// ─────────────────────────────────────────────────────────────────────────────
describe('stripe webhook retries rather than silently skipping money events', () => {
  const src = code(
    readFileSync(join(here, '../app/api/stripe/webhook/route.ts'), 'utf8'),
  );

  it('the refund handler throws on an unreadable donation', () => {
    expect(src, 'the refund lookup must capture `error`')
      .toMatch(/data:\s*donation,\s*error:\s*donationError[\s\S]{0,400}?stripe_payment_intent_id/);
    expect(src, 'an unreadable row must throw so Stripe redelivers, not return 200')
      .toMatch(/if \(donationError\) throw new Error\([^)]*Refunded donation/);
  });

  it('the dispute handler throws on an unreadable donation', () => {
    expect(src).toMatch(/if \(donationError\) throw new Error\([^)]*Disputed donation/);
  });

  it('still returns early for a genuinely missing row', () => {
    // The distinction is the whole point: throwing on "no row" would make every
    // refund of an unrecorded payment retry forever.
    expect(src, 'the not-found early return must survive next to the throw')
      .toMatch(/if \(donationError\) throw[\s\S]{0,300}?if \(!donation\) return;/);
  });

  it('the error check precedes the row branch in both handlers', () => {
    // Matched on each handler's own message rather than on `if (donationError)
    // throw`, which also occurs in the recurring-renewal handler — a
    // pre-existing, correct site with no row branch after it. A guard that
    // sweeps up unrelated code fails for the wrong reason and gets loosened.
    for (const marker of [/Refunded donation/, /Disputed donation/]) {
      const at = src.search(marker);
      expect(at, `handler guard not found: ${marker}`).toBeGreaterThan(-1);
      expect(
        src.slice(at, at + 400),
        'the row branch must come AFTER the error throw, so an unreadable row never takes it',
      ).toMatch(/if \(!?donation\)/);
    }
  });

  it('the detector is not vacuous — it rejects the original shape', () => {
    const original = `
      const { data: campaign } = await supabaseAdmin
        .from('campaigns').select('id').eq('id', campaignId).single();
      if (!campaign)
        return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
    `;
    expect(original).not.toMatch(/data:\s*campaign,\s*error:\s*campaignError/);
    expect(original).not.toMatch(/CAMPAIGN_LOOKUP_UNAVAILABLE/);
  });
});
