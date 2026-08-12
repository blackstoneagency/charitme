import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// "CharitMe should never hold any funds" is a claim about EVERY route that can
// create a charge — not just the one anybody thinks to test.
//
// The per-route suites (`donation-money-flow`, `recurring-money-flow`,
// `portfolio-held-funds`) each prove one route routes correctly. None of them
// can see a route that does not exist yet. A new checkout added next month with
// no `transfer_data` lands the money on CharitMe's own balance, and every one of
// those suites still passes — the promise would be broken by an ADDITION, which
// is precisely the failure mode a per-route test cannot catch.
//
// So this file inverts it: it DISCOVERS every route that creates a Stripe
// charge, and requires each one to be classified. There are exactly two legal
// classifications, and the distinction is the whole product promise:
//
//   ROUTED  — someone else's money. Must carry `transfer_data.destination`, so
//             Stripe moves it to the connected account at capture and it never
//             sits in CharitMe's balance.
//   PLATFORM— CharitMe's OWN revenue, where CharitMe is the merchant. Holding it
//             is not custody of anyone else's funds; it is being paid.
//
// An unclassified route fails this test. That is the point: the failure message
// is the review, and it cannot be silenced by adding a route, only by deciding
// which kind of money it moves.
//
// ⚠️ THERE IS NO LONGER A THIRD KIND. Portfolio split gifts were the one route
// that could not be a destination charge — Stripe's `transfer_data.destination`
// takes exactly ONE connected account, and a split gift has several — so it
// charged to the platform balance and the webhook fanned the money out. That
// made it the only place CharitMe genuinely held donor funds. The feature is
// withdrawn, and with it the exception: EVERY remaining route either routes to a
// connected account or is CharitMe's own revenue.
//
// The `fan-out` kind is deliberately still defined and still asserted to be
// EMPTY. Deleting it would make reintroducing a platform-balance charge a
// question of adding a route; leaving it means reintroducing one has to say so
// out loud, in this file, in a kind whose emptiness is the current promise.
// ─────────────────────────────────────────────────────────────────────────────

type Kind = 'routed' | 'platform' | 'fan-out';

const EXPECTED: Record<string, { kind: Kind; why: string }> = {
  'app/api/donations/route.ts': {
    kind: 'routed',
    why: "a donation is the organizer's money; CharitMe keeps only tip + processing",
  },
  'app/api/donations/recurring/route.ts': {
    kind: 'routed',
    why: 'same as a one-off donation, on a subscription',
  },
  'app/api/events/[id]/tickets/checkout/route.ts': {
    kind: 'routed',
    why: 'ticket revenue belongs to the event organizer',
  },
  'app/api/creators/tiers/subscribe/route.ts': {
    kind: 'routed',
    why: 'a membership is the creator\'s income',
  },
  'app/api/campaigns/[id]/feature/route.ts': {
    kind: 'platform',
    why: 'paying CharitMe to promote a campaign — CharitMe is the merchant, there is no other recipient',
  },
  'app/api/stripe/checkout/route.ts': {
    kind: 'platform',
    why: 'a CharitMe plan subscription — CharitMe is the merchant',
  },
};

/** Every route file that hands params to Stripe to create a charge. */
function discoverChargeRoutes(): string[] {
  // `git grep` rather than a hand-kept list: the whole value here is catching a
  // route nobody remembered to add.
  //
  // ⚠️ `--untracked` is load-bearing, and it was missing. Without it `git grep`
  // searches only COMMITTED files, so a brand-new unclassified charge route is
  // invisible to this test until after it is committed — i.e. exactly while the
  // author is running the suite to check their work. A planted route proved it:
  // 27/27 still passed. The author sees green, commits, and only then does the
  // inventory notice.
  const out = execFileSync(
    'git',
    ['grep', '-l', '--untracked', '-E', 'createCheckoutSession\\(|paymentIntents\\.create\\(', '--', 'app/api'],
    { cwd: root, encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean).map((p) => p.replace(/\\/g, '/')).sort();
}

const routes = discoverChargeRoutes();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('every charge-creating route is classified', () => {
  it('finds the routes by search, not from a list someone must remember to update', () => {
    // A guard on the guard. If the search pattern ever stops matching (a helper
    // is renamed, the calls move behind a wrapper), discovery silently returns
    // few or no files and every assertion below passes vacuously.
    expect(routes.length, 'charge-route discovery found almost nothing — the pattern has drifted')
      .toBeGreaterThanOrEqual(6);
  });

  it('has no route moving money without a decision recorded here', () => {
    const unclassified = routes.filter((r) => !(r in EXPECTED));
    expect(
      unclassified,
      'A new route creates Stripe charges and nothing says where the money goes.\n'
      + 'Decide, then add it to EXPECTED in this file:\n'
      + "  · routed   — someone else's money. It MUST set transfer_data.destination.\n"
      + '  · platform — CharitMe\'s own revenue, where CharitMe is the merchant.\n'
      + 'If it is neither, CharitMe would be holding funds it owes to someone, which\n'
      + 'is the one thing the product promises it does not do.',
    ).toEqual([]);
  });

  it('does not keep classifications for routes that no longer exist', () => {
    // Otherwise a deleted route leaves a stale entry that makes the inventory
    // look more complete than it is.
    const stale = Object.keys(EXPECTED).filter((r) => !routes.includes(r));
    expect(stale, 'these classified routes are gone — remove them').toEqual([]);
  });
});

describe("routes carrying someone else's money never let it rest with CharitMe", () => {
  const routed = Object.entries(EXPECTED).filter(([, v]) => v.kind === 'routed').map(([p]) => p);

  it('covers more than one route, so a filter bug cannot empty this block', () => {
    expect(routed.length).toBeGreaterThanOrEqual(4);
  });

  it.each(routed)('%s sends a destination charge', (route) => {
    const src = read(route);
    // `transfer_data.destination` is the entire mechanism: with it, Stripe moves
    // the funds to the connected account as part of the charge. Without it the
    // money lands in CharitMe's balance and stays there until something else
    // moves it — the custodial arrangement the product says it does not use.
    expect(src, `${route} must route funds to a connected account`)
      .toMatch(/transfer_data:\s*\{\s*destination:/);
  });

  it.each(routed)('%s resolves the destination rather than hardcoding one', (route) => {
    expect(read(route)).toMatch(/resolvePayoutDestination/);
  });

  it.each(routed)('%s refuses to charge when there is nowhere to send the money', (route) => {
    // The corollary, and the one that actually bites: a route that resolves a
    // destination but charges anyway when it comes back empty has created money
    // it cannot forward.
    expect(read(route), `${route} must decline when payout is not set up`)
      .toMatch(/PAYOUT_NOT_READY/);
  });

  it.each(routed)('%s distinguishes "could not check" from "not set up"', (route) => {
    // Paying the wrong person is unrecoverable; declining is not. A failed
    // lookup must not be read as "this creator has not onboarded".
    expect(read(route), `${route} must handle PayoutLookupUnavailableError`)
      .toMatch(/PayoutLookupUnavailableError/);
  });
});

describe('platform-revenue routes are the ONLY ones that may charge to CharitMe', () => {
  const platform = Object.entries(EXPECTED).filter(([, v]) => v.kind === 'platform').map(([p]) => p);

  it('covers the routes it claims to', () => {
    expect(platform.length).toBeGreaterThanOrEqual(2);
  });

  it.each(platform)('%s takes no payout destination, because there is no payee', (route) => {
    // Asserted in the negative on purpose. If one of these ever grows a
    // destination, the money is going somewhere and this classification — and
    // the reasoning in EXPECTED — has stopped being true.
    expect(read(route), `${route} is classified as CharitMe's own revenue but routes funds elsewhere`)
      .not.toMatch(/transfer_data/);
  });

  it('each platform route says in prose why CharitMe is the recipient', () => {
    for (const route of platform) {
      expect(EXPECTED[route].why.length, `${route} needs a reason, not just a label`)
        .toBeGreaterThan(30);
    }
  });
});

describe('no route charges to the platform balance any more', () => {
  const fanOut = Object.entries(EXPECTED).filter(([, v]) => v.kind === 'fan-out').map(([p]) => p);

  it('is EMPTY — CharitMe holds nobody else\'s money', () => {
    // The whole promise, in one assertion. Portfolio split gifts were the only
    // route that landed donor money on CharitMe's balance; withdrawing them
    // removed the exception rather than shrinking it.
    expect(fanOut).toEqual([]);
  });

  it('the withdrawn portfolio checkout is really gone', () => {
    expect(routes, 'a portfolio charge route is back')
      .not.toContain('app/api/donations/portfolio/route.ts');
  });

  it('but the webhook can STILL settle a session created before the withdrawal', () => {
    // ⚠️ Not dead code, and deleting it loses money. Checkout Sessions live ~24h,
    // so a portfolio session opened before the withdrawal shipped can still be
    // PAID after it. Without this handler that donation is never recorded and the
    // money sits on the platform balance with nothing saying whose it is —
    // precisely the failure withdrawing the feature was meant to end.
    const webhook = read('app/api/stripe/webhook/route.ts');
    expect(webhook).toMatch(/handlePortfolioComplete/);
    expect(webhook).toMatch(/recordHeldFunds\(/);
    expect(webhook).toMatch(/reconciliation_exceptions/);
  });
});
