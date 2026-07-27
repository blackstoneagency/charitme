import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BID_INCREMENT_CENTS,
  MAX_BID_CENTS,
  auctionSummary,
  formatCents,
  highestBid,
  isAuctionOpen,
  minimumNextBidCents,
  parseBidToCents,
  validateBid,
  type AuctionBid,
} from '../lib/auctions-core';

const WEB_ROOT = join(__dirname, '..');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const read = (p: string) => strip(readFileSync(join(WEB_ROOT, p), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// Charity auctions — the last feature the catalog marked `planned: true`.
//
// `auction_items` and `auction_bids` shipped to production (verified: both
// return 200 and are empty) but no route, API or UI ever read them, so
// /features counted Auctions toward Givebutter parity while nothing existed.
//
// Bids are money, so the rules are tested hard: a UI that accepts a bid the
// server rejects is worse than no UI, and two simultaneous bidders must never
// both be told they are winning.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-27T12:00:00Z');
const open = {
  status: 'open' as const,
  closes_at: '2026-08-01T00:00:00Z',
  starting_bid_cents: 5_000,
  current_bid_cents: 0,
};

describe('the minimum next bid', () => {
  it('is the starting bid when nobody has bid', () => {
    // current_bid_cents defaults to 0 in the schema. Requiring starting +
    // increment here would make the advertised starting price unbiddable.
    expect(minimumNextBidCents(open)).toBe(5_000);
  });

  it('is one increment above a standing bid', () => {
    expect(minimumNextBidCents({ ...open, current_bid_cents: 7_500 })).toBe(7_500 + BID_INCREMENT_CENTS);
  });

  it('never returns zero, even on a nonsense row', () => {
    // A zero minimum would let a $0 bid win the lot.
    expect(minimumNextBidCents({ starting_bid_cents: 0, current_bid_cents: 0 })).toBeGreaterThan(0);
    expect(minimumNextBidCents({ starting_bid_cents: Number.NaN, current_bid_cents: Number.NaN })).toBeGreaterThan(0);
  });
});

describe('an auction is open only when it demonstrably is', () => {
  it('accepts an open lot before its close time', () => {
    expect(isAuctionOpen(open, NOW)).toBe(true);
  });

  it('treats a null close date as open-ended', () => {
    expect(isAuctionOpen({ status: 'open', closes_at: null }, NOW)).toBe(true);
  });

  it('separates a real null from a blank string', () => {
    // Both are falsy, but only null means "no deadline"; a blank string is
    // corrupt data and must not read as an auction that never ends.
    expect(isAuctionOpen({ status: 'open', closes_at: '   ' }, NOW)).toBe(false);
  });

  it('closes at the deadline', () => {
    expect(isAuctionOpen({ status: 'open', closes_at: '2026-07-27T11:59:59Z' }, NOW)).toBe(false);
    expect(isAuctionOpen({ status: 'open', closes_at: NOW.toISOString() }, NOW)).toBe(false);
  });

  it('respects a non-open status regardless of date', () => {
    for (const status of ['closed', 'fulfilled'] as const) {
      expect(isAuctionOpen({ status, closes_at: '2099-01-01T00:00:00Z' }, NOW), status).toBe(false);
    }
  });

  it('treats an unparseable close date as CLOSED, not as forever-open', () => {
    // Failing the other way would let a data problem keep taking money.
    for (const bad of ['', 'soon', 'not-a-date']) {
      expect(isAuctionOpen({ status: 'open', closes_at: bad }, NOW), bad).toBe(false);
    }
  });
});

describe('bid validation', () => {
  it('accepts a bid at exactly the minimum', () => {
    const r = validateBid(open, 5_000, NOW);
    expect(r.ok).toBe(true);
  });

  it('rejects a bid below the minimum and says what it is', () => {
    const r = validateBid({ ...open, current_bid_cents: 10_000 }, 10_050, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('BELOW_MINIMUM');
      expect(r.minimumCents).toBe(10_100);
      expect(r.message).toContain('$101.00');
    }
  });

  it('rejects non-integer, negative and non-numeric amounts', () => {
    for (const bad of [0, -100, 12.5, '100', null, undefined, Number.NaN, {}]) {
      const r = validateBid(open, bad, NOW);
      expect(r.ok, String(bad)).toBe(false);
    }
  });

  it('rejects an absurd amount rather than accepting a typo', () => {
    const r = validateBid(open, MAX_BID_CENTS + 1, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('ABOVE_MAXIMUM');
  });

  it('rejects any bid on a closed lot, however large', () => {
    const r = validateBid({ ...open, status: 'closed' }, 1_000_000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_OPEN');
  });

  it('rejects a bid after the deadline', () => {
    const r = validateBid({ ...open, closes_at: '2026-07-01T00:00:00Z' }, 9_999, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('CLOSED');
  });
});

describe('parsing a typed amount', () => {
  it('reads plain and formatted dollars as cents', () => {
    expect(parseBidToCents('50')).toBe(5_000);
    expect(parseBidToCents('$1,250.50')).toBe(125_050);
    expect(parseBidToCents(' 12.34 ')).toBe(1_234);
  });

  it('rounds rather than truncating the half cent', () => {
    // Truncating would silently under-bid the user.
    expect(parseBidToCents('10.99')).toBe(1_099);
  });

  it('rejects junk instead of guessing', () => {
    for (const bad of ['', 'abc', '10.999', '-5', '1e5', '..']) {
      expect(parseBidToCents(bad), bad).toBeNull();
    }
  });
});

describe('the standing high bid', () => {
  const bid = (amount: number, status: AuctionBid['status'] = 'active'): AuctionBid => ({
    id: `b${amount}`, item_id: 'i', bidder_id: 'u', amount_cents: amount, status, created_at: '',
  });

  it('is null when nobody has bid — never a fabricated winner', () => {
    expect(highestBid([])).toBeNull();
  });

  it('picks the largest live bid', () => {
    expect(highestBid([bid(100), bid(900), bid(500)])?.amount_cents).toBe(900);
  });

  it('ignores cancelled bids', () => {
    expect(highestBid([bid(100), bid(9_000, 'cancelled')])?.amount_cents).toBe(100);
    expect(highestBid([bid(9_000, 'cancelled')])).toBeNull();
  });
});

describe('the summary never claims a lot is uncontested without checking', () => {
  it('says the count is unavailable rather than "0 bids"', () => {
    // Telling a bidder "0 bids" when the read failed misrepresents competition.
    const text = auctionSummary({ ...open, current_bid_cents: 8_000 }, null, NOW);
    expect(text).toContain('bid count unavailable');
    expect(text).not.toContain('0 bids');
  });

  it('reports a measured zero normally', () => {
    expect(auctionSummary(open, 0, NOW)).toContain('no bids yet');
  });

  it('singularises one bid', () => {
    const text = auctionSummary({ ...open, current_bid_cents: 8_000 }, 1, NOW);
    expect(text).toContain('· 1 bid');
    expect(text).not.toContain('1 bids');
  });

  it('reports a closed lot as sold, not as still biddable', () => {
    const text = auctionSummary({ ...open, status: 'closed', current_bid_cents: 8_000 }, 3, NOW);
    expect(text).toContain('Closed');
    expect(text).toContain(formatCents(8_000));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The race guard. This is the part that cannot be unit-tested without a
// database, so it is asserted structurally — the shape IS the correctness.
// ─────────────────────────────────────────────────────────────────────────────
describe('bids are settled by an atomic compare-and-set', () => {
  const src = read('lib/auctions.ts');

  it('claims the row with a conditional update, not a read-then-write', () => {
    // Two bidders reading the same current_bid_cents before either writes is
    // exactly how both get told they are winning. PostgREST turns these filters
    // into the UPDATE's WHERE clause, so Postgres decides in one statement.
    expect(src).toMatch(/\.lt\('current_bid_cents', amountCents\)/);
    expect(src).toMatch(/\.eq\('status', 'open'\)/);
  });

  it('treats zero updated rows as being outbid', () => {
    expect(src).toMatch(/claimed\.length === 0/);
    expect(src).toContain("reason: 'OUTBID'");
  });

  it('claims the lot before recording the bid', () => {
    // Ordered so a crash leaves a standing bid with no ledger row (visible and
    // fixable) rather than a ledger row that never won anything.
    expect(src.indexOf("from('auction_items')\n    .update")).toBeLessThan(
      src.indexOf("from('auction_bids').insert"),
    );
  });

  it('demotes the previous leader so two rows never claim winning', () => {
    expect(src).toMatch(/status: 'outbid'/);
    expect(src).toMatch(/\.eq\('status', 'winning'\)/);
  });

  it('does not report success when the ledger insert failed', () => {
    expect(src).toMatch(/accepted but could not be fully recorded/);
  });

  it('reports a failed list read rather than an empty auction', () => {
    expect(src).toMatch(/return \{ items: \[\], failed: true \}/);
  });
});

describe('the bid API cannot be spoofed', () => {
  const src = read('app/api/auctions/[id]/bids/route.ts');

  it('requires a session', () => {
    expect(src).toMatch(/if \(!user\)/);
    expect(src).toContain('401');
  });

  it('401s rather than redirecting', () => {
    // requireUser() redirects to /login, which hands a fetch caller HTML and
    // makes res.json() throw — the bidder would see a connection error instead
    // of "your session expired".
    expect(src).not.toContain('requireUser');
  });

  it('takes the bidder from the session, never the body', () => {
    // Accepting bidder_id from the caller would let anyone bid in another name.
    expect(src).toMatch(/placeBid\(id, user\.id,/);
    expect(src).not.toMatch(/body\.bidderId|bidder_id/);
  });

  it('distinguishes losing the race from a bad request', () => {
    expect(src).toMatch(/'OUTBID' \? 409/);
  });
});

describe('the UI validates with the same module as the server', () => {
  const src = read('app/events/[slug]/_components/AuctionLots.tsx');

  it('imports the shared rules rather than reimplementing them', () => {
    expect(src).toContain("from '../../../../lib/auctions-core'");
    expect(src).toContain('validateBid(');
    expect(src).toContain('minimumNextBidCents(');
  });

  it('does not offer a bid box to signed-out visitors', () => {
    expect(src).toMatch(/open && !signedIn/);
    expect(src).toContain('Sign in to bid');
  });

  it('labels the bid input for screen readers', () => {
    expect(src).toMatch(/htmlFor=\{`bid-\$\{item\.id\}`\}/);
    expect(src).toContain('sr-only');
  });
});
