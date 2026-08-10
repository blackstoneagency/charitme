import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapRecentDonations } from '../lib/home-data';
import { aggregateSupporters } from '../lib/organizer-marketing';
import { marketingStatusForOptIn } from '../lib/marketing-core';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const form = read('app/campaigns/[slug]/DonateButton.tsx');
const api = read('app/api/donations/route.ts');
const webhook = read('app/api/stripe/webhook/route.ts');

/**
 * The two checkboxes under the donation message:
 *   · "Don't display my name or profile publicly on the fundraiser" → `anonymous`
 *   · "Subscribe to receive emails"                                 → `subscribeToUpdates`
 *
 * Each has to survive four hops — checkbox state → request body → Stripe session
 * metadata → webhook → database — and a break at any one of them is invisible
 * from the UI, because Stripe Checkout succeeds either way. The donor only finds
 * out when their name appears on a campaign they asked to be anonymous on.
 *
 * ⚠️ The DISPLAY half is executed here against the real mappers. The four hops
 * are asserted against source, because each one needs a live Stripe session and
 * a webhook signature — see the note in `it('...cannot be executed here')`.
 */
describe('the checkboxes are bound to state and sent', () => {
  it('anonymous is a controlled checkbox', () => {
    expect(form).toMatch(/checked=\{anonymous\}/);
    expect(form).toMatch(/onChange=\{\(e\) => setAnonymous\(e\.target\.checked\)\}/);
  });

  it('subscribe is a controlled checkbox', () => {
    expect(form).toMatch(/checked=\{subscribeEmail\}/);
    expect(form).toMatch(/onChange=\{\(e\) => setSubscribeEmail\(e\.target\.checked\)\}/);
  });

  it('both are in the request body, under the names the API validates', () => {
    // The API's zod schema keys. A rename on either side silently drops the
    // value: zod `.optional()` means an unknown key is ignored, not rejected.
    expect(form).toMatch(/^\s+anonymous,$/m);
    expect(form).toMatch(/subscribeToUpdates: subscribeEmail,/);
    expect(api).toMatch(/anonymous:\s+z\.boolean\(\)\.optional\(\)/);
    expect(api).toMatch(/subscribeToUpdates: z\.boolean\(\)\.optional\(\)/);
  });

  it('the anonymity box carries an explanation of what it does', () => {
    // "Don't display my name" is a promise about a specific surface. The tooltip
    // says which one, so the donor is not guessing.
    expect(form).toContain('Your name will not appear on the donor list');
  });
});

describe('both flags reach Stripe metadata, which is what the webhook reads', () => {
  it('anonymous is stringified into session metadata', () => {
    // Stripe metadata values are STRINGS. `anonymous: false` would serialise to
    // "false", which is truthy — hence the explicit '1'/'0'.
    expect(api).toMatch(/anonymous:\s+anonymous \? '1' : '0'/);
  });

  it('subscribeToUpdates is stringified into session metadata', () => {
    expect(api).toMatch(/subscribeToUpdates:\s+subscribeToUpdates \? '1' : '0'/);
  });

  it('the webhook compares against the string, not truthiness', () => {
    // `meta.anonymous` is always a string here. A truthiness check would make
    // "0" true and every donation anonymous.
    expect(webhook).toMatch(/p_anonymous: meta\.anonymous === '1'/);
    expect(webhook).toMatch(/meta\.subscribeToUpdates === '1'/);
  });

  it('opting in never silently opts anyone out', () => {
    // notification_marketing is only ever set TRUE here. Writing `false` on a
    // donation without the box ticked would unsubscribe someone who had opted
    // in elsewhere — a donation is not a preference change.
    expect(webhook).toMatch(/notification_marketing: true/);
    expect(webhook).not.toMatch(/notification_marketing: false/);
  });

  it('a guest opt-in is recorded as consent, not just a contact row', () => {
    // Guests have no profile to flag, so consent lives on the marketing contact.
    expect(api).toMatch(/consentEmail: !!subscribeToUpdates/);
    expect(api).toMatch(/marketingStatus: marketingStatusForOptIn\(!!subscribeToUpdates\)/);
    expect(webhook).toMatch(/consentEmail: subscribed/);
  });
});

describe('anonymity actually hides the donor — executed, not read', () => {
  const row = (anonymous: boolean, showPublicProfile = true) => ({
    id: 'd1',
    amount_cents: 5000,
    anonymous,
    created_at: '2026-08-09T00:00:00Z',
    offline_donor_name: null,
    profiles: { full_name: 'Real Name', show_public_profile: showPublicProfile },
    campaigns: { title: 'A campaign', slug: 'a-campaign', visibility: 'public' },
  });

  it('names a donor who did NOT tick the box', () => {
    // Guards the guard: if this returned "Anonymous" too, the assertion below
    // would pass while the checkbox did nothing at all.
    const [d] = mapRecentDonations([row(false)] as never, 8);
    expect(d.name).toBe('Real Name');
  });

  it('hides a donor who DID tick it', () => {
    const [d] = mapRecentDonations([row(true)] as never, 8);
    expect(d.name).toBe('Anonymous');
  });

  it('still hides a private profile that did not tick it', () => {
    // Two independent gates. This one has regressed before: a donor set to
    // Private but not anonymous was named in the homepage ticker.
    const [d] = mapRecentDonations([row(false, false)] as never, 8);
    expect(d.name).toBe('Anonymous');
  });

  it('hides the name in the organizer supporter list too', () => {
    const supporters = aggregateSupporters([
      { email: 'a@b.c', name: 'Real Name', anonymous: true, amount_cents: 5000, created_at: '2026-08-09T00:00:00Z' },
    ] as never);
    expect(supporters[0]!.name).toBe('Anonymous donor');
  });

  it('lets a later non-anonymous gift from the same donor restore the name', () => {
    // Deliberate: anonymity is per GIFT. Someone who gave anonymously once and
    // openly later has not asked to be hidden forever.
    const supporters = aggregateSupporters([
      { email: 'a@b.c', name: 'Real Name', anonymous: true, amount_cents: 5000, created_at: '2026-08-01T00:00:00Z' },
      { email: 'a@b.c', name: 'Real Name', anonymous: false, amount_cents: 2500, created_at: '2026-08-05T00:00:00Z' },
    ] as never);
    expect(supporters[0]!.name).toBe('Real Name');
  });
});

describe('the subscribe box decides whether marketing may reach them — executed', () => {
  it('declining creates the contact as UNSUBSCRIBED, not merely un-flagged', () => {
    // This is the whole gate. If declining produced 'active', every donor would
    // be emailable and the checkbox would be decoration — the send path filters
    // on `marketing_contacts.status === 'active'`, nothing else.
    expect(marketingStatusForOptIn(false)).toBe('unsubscribed');
  });

  it('opting in makes them emailable', () => {
    expect(marketingStatusForOptIn(true)).toBe('active');
  });

  it('the send path is gated on that status and on suppression', () => {
    // Two gates, not one: a re-subscribed contact still on the suppression list
    // receives nothing. Both are checked before a send.
    const send = read('app/api/admin/marketing/campaigns/route.ts');
    expect(send).toMatch(/contact\.status !== 'active'/);
    expect(send).toMatch(/await isSuppressed\(contact\.email\)/);
  });

  it('an unticked box never unsubscribes an existing subscriber', () => {
    // Deliberate asymmetry: opting in upgrades, declining does not downgrade.
    // A donation is not a preference change, and someone who subscribed via the
    // newsletter should not be silently dropped by giving without ticking a box.
    const engine = read('lib/marketing-engine.ts');
    expect(engine).toMatch(/if \(input\.marketingStatus === 'active'\) \{ updates\.status = 'active'; \}/);
  });
});

describe('what this suite does NOT prove', () => {
  it('cannot be executed end to end here, and says so rather than implying otherwise', () => {
    // The four hops need a live Stripe Checkout session and a signed webhook.
    // Neither exists in this sandbox, and the donate form itself only renders
    // when `isActive && payoutReady` — no seeded campaign is payout-ready, so
    // the form cannot even be driven in a browser here.
    //
    // This test exists so the limitation is recorded next to the assertions it
    // qualifies, instead of a reader assuming the suite covers more than it does.
    const detail = read('app/campaigns/[slug]/(detail)/page.tsx');
    expect(detail).toMatch(/isActive && payoutReady \? \(/);
  });
});
