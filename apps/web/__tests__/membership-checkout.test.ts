import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const route = strip(read('app/api/creators/tiers/subscribe/route.ts'));
const hook = strip(read('app/api/stripe/webhook/route.ts'));
const page = strip(read('app/creators/[handle]/page.tsx'));

// ─────────────────────────────────────────────────────────────────────────────
// Paid membership checkout — the last piece of the creator module.
//
// `membership_tiers` and `member_subscriptions` have been applied since
// 20260525002000 and the tier CRUD shipped, but nothing could take the money,
// so `/creators/[handle]` said "memberships open soon". todo.md recorded this as
// gated on Stripe test keys (O3). It was not: writing, typechecking and
// unit-testing a subscription-mode Checkout needs no key — only a live
// end-to-end charge does, which is true of every Stripe path already shipped
// here. Same mis-classification A1 had.
//
// What this pins is the part that costs real money to get wrong.
// ─────────────────────────────────────────────────────────────────────────────

describe('membership checkout never leaves money unaccounted for', () => {
  it('requires a signed-in member', () => {
    // A membership grants access to member-only posts, so it has to attach to
    // an account.
    expect(route).toMatch(/auth\.getUser\(\)/);
    expect(route).toMatch(/UNAUTHENTICATED/);
  });

  it('refuses when the creator has no payout destination', () => {
    // CharitMe never holds the money. Taking a recurring payment we cannot
    // forward would leave funds sitting with us — the standing constraint.
    expect(route).toMatch(/resolvePayoutDestination/);
    expect(route).toMatch(/PAYOUT_NOT_READY/);
    // Compared against the CALL, not the identifier — `indexOf` on the bare
    // name finds the import at the top of the file and the assertion passes or
    // fails on where the import sits, which is not the property being pinned.
    const gate = route.indexOf('PAYOUT_NOT_READY');
    const call = route.indexOf('await createCheckoutSession(');
    expect(call, 'the checkout call must exist').toBeGreaterThan(-1);
    expect(gate, 'the payout gate must precede the checkout call').toBeLessThan(call);
  });

  it('separates an unreadable tier from a missing one', () => {
    expect(route).toMatch(/\.maybeSingle\(\)/);
    expect(route).toMatch(/tierError[\s\S]{0,300}?TIER_LOOKUP_UNAVAILABLE/);
    const unavailable = route.indexOf('TIER_LOOKUP_UNAVAILABLE');
    const notFound = route.indexOf('Membership tier not found');
    expect(unavailable, 'a failed read must not answer 404').toBeLessThan(notFound);
  });

  it('does not return the Stripe error to the caller', () => {
    // Stripe messages can name internal configuration.
    expect(route).toMatch(/console\.error/);
    expect(route).not.toMatch(/error:\s*err\.message/);
  });

  it('sends an idempotency key so a double-click cannot buy twice', () => {
    expect(route).toMatch(/createCheckoutSession\([\s\S]{0,200}?membership:\$\{user\.id\}:\$\{tier\.id\}/);
  });

  it('tags the subscription so the webhook can tell it from a donation', () => {
    // Without `kind`, a membership session is indistinguishable from a recurring
    // DONATION session and the handler would write the wrong table.
    expect(route).toMatch(/kind: 'membership'/);
    expect(route).toMatch(/subscription_data/);
  });
});

describe('the webhook records the membership it was paid for', () => {
  /**
   * Just the `kind === 'membership'` branch of handleCheckoutComplete.
   *
   * Assertions about this handler must not be satisfiable by the recurring
   * -donation handler further down the same file, which writes a different table
   * with a coincidentally identical conflict target.
   */
  const membershipBlock = (() => {
    const from = hook.indexOf("meta.kind === 'membership'");
    expect(from, 'the membership branch must exist for these assertions to mean anything')
      .toBeGreaterThan(-1);
    return hook.slice(from, hook.indexOf('meta.portfolio', from));
  })();

  it('branches on membership BEFORE the donation paths', () => {
    const membership = hook.indexOf("meta.kind === 'membership'");
    const portfolio = hook.indexOf("meta.portfolio === '1'");
    expect(membership, 'the membership branch must exist').toBeGreaterThan(-1);
    expect(membership, 'falling through would run the donation handler with no campaignId')
      .toBeLessThan(portfolio);
  });

  it('is idempotent on the Stripe subscription id', () => {
    // The column is UNIQUE and Stripe retries. Without onConflict the retry
    // errors forever instead of being a no-op.
    //
    // Scoped to the membership BLOCK, not the whole file. The recurring-donation
    // handler lower down carries the same `onConflict`, so a file-wide match
    // passed even with the membership one deleted — caught by mutation-testing
    // this assertion, which is the only reason it is written this way.
    expect(membershipBlock, 'the membership upsert must be idempotent')
      .toMatch(/onConflict: 'stripe_subscription_id'/);
    expect(membershipBlock).toMatch(/\.from\('member_subscriptions'\)/);
  });

  it('throws rather than answering 200 when the membership cannot be recorded', () => {
    // Returning would strand a paying member outside the paywall with no retry.
    expect(hook).toMatch(/membership could not be recorded/);
    expect(hook).toMatch(/if \(error\) throw new Error\(`membership could not be recorded/);
  });

  it('tracks status changes and cancellation onto the same row', () => {
    // The paywall reads `status`, so a past_due card must stop granting access
    // and a recovered one must restore it without anyone intervening.
    expect(hook).toMatch(/membership status could not be updated/);
    expect(hook).toMatch(/membership cancellation could not be recorded/);
    expect(hook).toMatch(/past_due/);
  });
});

describe('the Join control exists only because the route does', () => {
  it('the page no longer claims memberships are unavailable', () => {
    expect(page).not.toMatch(/memberships open soon/);
  });

  it('renders a real button wired to the real route', () => {
    expect(page).toMatch(/JoinTierButton/);
    const btn = strip(read('app/creators/[handle]/JoinTierButton.tsx'));
    expect(btn).toMatch(/\/api\/creators\/tiers\/subscribe/);
  });

  it('shows membership state instead of a second Join', () => {
    // A duplicate Join would create a second subscription for the same tier.
    expect(page).toMatch(/viewer\.memberships\.some\(\(m\) => m\.tierId === t\.id\)/);
  });
});
