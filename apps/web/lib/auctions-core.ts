// ─────────────────────────────────────────────────────────────────────────────
// Charity auctions — the pure bid rules.
//
// Auctions were the one feature in the catalog marked `planned: true`: the
// `auction_items` / `auction_bids` tables shipped, but no route, API or UI ever
// read them, so /features counted an unbuilt feature toward Givebutter parity.
//
// Everything here is pure and side-effect free. The rules that decide whether a
// bid is legal live in one place so the API and the UI cannot disagree — a UI
// that accepts a bid the server rejects is worse than no UI.
//
// Money is in CENTS throughout, matching campaigns/donations. Never floats.
// ─────────────────────────────────────────────────────────────────────────────

export type AuctionItemStatus = 'open' | 'closed' | 'fulfilled';
export type AuctionBidStatus = 'active' | 'outbid' | 'winning' | 'cancelled';

export type AuctionItem = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  starting_bid_cents: number;
  current_bid_cents: number;
  closes_at: string | null;
  status: AuctionItemStatus;
};

export type AuctionBid = {
  id: string;
  item_id: string;
  bidder_id: string | null;
  amount_cents: number;
  status: AuctionBidStatus;
  created_at: string;
};

/**
 * Minimum raise over the standing bid.
 *
 * A flat step keeps the rule explainable on the page ("bids go up in $1
 * increments"), which matters more here than a clever percentage ladder.
 */
export const BID_INCREMENT_CENTS = 100;

/** Refuse absurd bids outright — a mis-typed amount is far likelier than a real one. */
export const MAX_BID_CENTS = 100_000_000; // $1,000,000

/**
 * The lowest legal next bid.
 *
 * With no bids yet (`current_bid_cents` is 0 by default) the starting bid is
 * itself acceptable — asking for starting + increment would quietly make the
 * advertised starting price unbiddable.
 */
export function minimumNextBidCents(item: Pick<AuctionItem, 'starting_bid_cents' | 'current_bid_cents'>): number {
  const current = Number.isFinite(item.current_bid_cents) ? item.current_bid_cents : 0;
  const starting = Number.isFinite(item.starting_bid_cents) ? item.starting_bid_cents : 0;
  if (current <= 0) return Math.max(starting, 1);
  return current + BID_INCREMENT_CENTS;
}

/** True when the item still accepts bids at `now`. */
export function isAuctionOpen(
  item: Pick<AuctionItem, 'status' | 'closes_at'>,
  now: Date = new Date(),
): boolean {
  if (item.status !== 'open') return false;
  // A genuine null means "no deadline". An empty or blank string is a data
  // problem wearing the same falsy clothes, so the two are separated here —
  // otherwise a corrupted close date reads as an auction that never ends.
  if (item.closes_at === null || item.closes_at === undefined) return true;
  if (item.closes_at.trim() === '') return false;
  const closes = Date.parse(item.closes_at);
  // An unparseable close date must not silently make a lot biddable forever;
  // treat it as closed so a data problem cannot take someone's money.
  if (Number.isNaN(closes)) return false;
  return closes > now.getTime();
}

export type BidRejection =
  | 'NOT_OPEN'
  | 'CLOSED'
  | 'NOT_A_NUMBER'
  | 'BELOW_MINIMUM'
  | 'ABOVE_MAXIMUM';

export type BidValidation =
  | { ok: true; amountCents: number }
  | { ok: false; reason: BidRejection; message: string; minimumCents: number };

/**
 * Decide whether a bid may be attempted. This is a *pre*-check: it cannot rule
 * out losing a race to a simultaneous bidder, which only the atomic conditional
 * update in the API can settle. See `placeBid` in lib/auctions.ts.
 */
export function validateBid(
  item: Pick<AuctionItem, 'status' | 'closes_at' | 'starting_bid_cents' | 'current_bid_cents'>,
  amountCents: unknown,
  now: Date = new Date(),
): BidValidation {
  const minimumCents = minimumNextBidCents(item);

  if (item.status !== 'open') {
    return { ok: false, reason: 'NOT_OPEN', message: 'This lot is no longer accepting bids.', minimumCents };
  }
  if (!isAuctionOpen(item, now)) {
    return { ok: false, reason: 'CLOSED', message: 'Bidding on this lot has closed.', minimumCents };
  }
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: 'NOT_A_NUMBER', message: 'Enter a bid amount in whole cents.', minimumCents };
  }
  if (amountCents > MAX_BID_CENTS) {
    return { ok: false, reason: 'ABOVE_MAXIMUM', message: 'That bid is larger than this auction allows.', minimumCents };
  }
  if (amountCents < minimumCents) {
    return {
      ok: false,
      reason: 'BELOW_MINIMUM',
      message: `Bids must be at least ${formatCents(minimumCents)}.`,
      minimumCents,
    };
  }
  return { ok: true, amountCents };
}

/** Parse a typed dollar amount ("1,250.50") into whole cents, or null. */
export function parseBidToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d{0,2}$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Round rather than truncate so 10.005 does not silently become 10.00.
  return Math.round(value * 100);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

/** The standing high bid, or null when nobody has bid. Never invents a winner. */
export function highestBid(bids: AuctionBid[]): AuctionBid | null {
  const live = bids.filter((b) => b.status !== 'cancelled');
  if (live.length === 0) return null;
  return live.reduce((best, b) => (b.amount_cents > best.amount_cents ? b : best));
}

/**
 * Human summary of an item's state. `bidCount` is `number | null` so an
 * unreadable count renders as unknown rather than as "0 bids", which would
 * wrongly tell a bidder the lot is uncontested.
 */
export function auctionSummary(
  item: Pick<AuctionItem, 'status' | 'closes_at' | 'starting_bid_cents' | 'current_bid_cents'>,
  bidCount: number | null,
  now: Date = new Date(),
): string {
  const open = isAuctionOpen(item, now);
  const bids = bidCount === null ? 'bid count unavailable' : `${bidCount} ${bidCount === 1 ? 'bid' : 'bids'}`;
  if (!open) {
    return item.current_bid_cents > 0
      ? `Closed · sold at ${formatCents(item.current_bid_cents)} · ${bids}`
      : `Closed · no bids received`;
  }
  return item.current_bid_cents > 0
    ? `Current bid ${formatCents(item.current_bid_cents)} · ${bids}`
    : `Starting bid ${formatCents(item.starting_bid_cents)} · no bids yet`;
}
