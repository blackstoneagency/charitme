import 'server-only';
import { supabaseAdmin } from './supabase';
import {
  validateBid,
  type AuctionBid,
  type AuctionItem,
  type BidRejection,
} from './auctions-core';

// ─────────────────────────────────────────────────────────────────────────────
// Charity auction reads and the bid write.
//
// The bid write is the whole difficulty. Two bidders submitting the same amount
// at the same instant must not both be told they are winning, and a
// read-then-write ("fetch current_bid_cents, compare, then update") cannot
// prevent that — both requests read the same value before either writes.
//
// The usual fix is a Postgres function with SELECT ... FOR UPDATE, but DDL is not
// available here (only the service-role key; PostgREST cannot run DDL, and the
// aggregate RPCs are already blocked on the same access). So the guard is a
// CONDITIONAL UPDATE instead:
//
//     PATCH /auction_items?id=eq.<id>&current_bid_cents=lt.<amount>&status=eq.open
//
// PostgREST turns those filters into the UPDATE's WHERE clause, so Postgres
// evaluates the comparison and the row lock in a single statement. The loser of a
// race matches zero rows and is told it was outbid. This is a real
// compare-and-set, not an optimistic guess — and it needs no migration, so it
// works against production today.
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_COLUMNS = 'id,event_id,title,description,image_url,starting_bid_cents,current_bid_cents,closes_at,status';
const MAX_ITEMS = 200;
const MAX_BIDS = 50;

/**
 * Auction lots for an event.
 *
 * `failed` is returned rather than swallowed: an empty list and a failed read
 * look identical to a caller, and "no lots" on a live auction page is a claim,
 * not an absence.
 */
export async function listAuctionItems(eventId: string): Promise<{ items: AuctionItem[]; failed: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('auction_items')
    .select(ITEM_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(MAX_ITEMS);
  if (error || data == null) return { items: [], failed: true };
  return { items: data as AuctionItem[], failed: false };
}

export async function getAuctionItem(itemId: string): Promise<AuctionItem | null> {
  const { data, error } = await supabaseAdmin
    .from('auction_items')
    .select(ITEM_COLUMNS)
    .eq('id', itemId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AuctionItem;
}

/** Bid counts per item. Missing keys mean unknown, never 0 — see auctionSummary. */
export async function countBidsByItem(itemIds: string[]): Promise<Map<string, number> | null> {
  if (itemIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from('auction_bids')
    .select('item_id')
    .in('item_id', itemIds)
    .neq('status', 'cancelled')
    .limit(5000);
  if (error || data == null) return null;
  const counts = new Map<string, number>();
  for (const row of data as { item_id: string }[]) {
    counts.set(row.item_id, (counts.get(row.item_id) ?? 0) + 1);
  }
  return counts;
}

export async function listItemBids(itemId: string): Promise<{ bids: AuctionBid[]; failed: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('auction_bids')
    .select('id,item_id,bidder_id,amount_cents,status,created_at')
    .eq('item_id', itemId)
    .order('amount_cents', { ascending: false })
    .limit(MAX_BIDS);
  if (error || data == null) return { bids: [], failed: true };
  return { bids: data as AuctionBid[], failed: false };
}

export type PlaceBidResult =
  | { ok: true; item: AuctionItem; amountCents: number }
  | { ok: false; reason: BidRejection | 'OUTBID' | 'NOT_FOUND' | 'WRITE_FAILED'; message: string; minimumCents?: number };

/**
 * Place a bid, atomically.
 *
 * The pre-check gives a good error message; the conditional update is what
 * actually decides. Order matters: the item row is claimed FIRST, and only then
 * is the bid recorded — so a crash between the two leaves a standing bid with no
 * ledger row (visible, fixable) rather than a ledger row that never won anything.
 */
export async function placeBid(
  itemId: string,
  bidderId: string,
  amountCents: number,
  now: Date = new Date(),
): Promise<PlaceBidResult> {
  const item = await getAuctionItem(itemId);
  if (!item) return { ok: false, reason: 'NOT_FOUND', message: 'That auction lot could not be found.' };

  const check = validateBid(item, amountCents, now);
  if (!check.ok) return { ok: false, reason: check.reason, message: check.message, minimumCents: check.minimumCents };

  // The compare-and-set. `lt` on current_bid_cents is the race guard; `eq` on
  // status stops a bid landing on a lot closed between the read and the write.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('auction_items')
    .update({ current_bid_cents: amountCents, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('status', 'open')
    .lt('current_bid_cents', amountCents)
    .select(ITEM_COLUMNS);

  if (claimError) {
    return { ok: false, reason: 'WRITE_FAILED', message: 'The bid could not be recorded. Please try again.' };
  }
  // Zero rows means someone else's bid landed first, or the lot just closed.
  if (!claimed || claimed.length === 0) {
    const latest = await getAuctionItem(itemId);
    return {
      ok: false,
      reason: 'OUTBID',
      message: 'Someone else bid first — your bid was not placed.',
      minimumCents: latest ? latest.current_bid_cents + 1 : undefined,
    };
  }

  // Demote the previous leader before recording the new one, so there is never a
  // window with two rows claiming 'winning'.
  await supabaseAdmin
    .from('auction_bids')
    .update({ status: 'outbid' })
    .eq('item_id', itemId)
    .eq('status', 'winning');

  const { error: bidError } = await supabaseAdmin.from('auction_bids').insert({
    item_id: itemId,
    bidder_id: bidderId,
    amount_cents: amountCents,
    status: 'winning',
  });

  if (bidError) {
    // The lot is already claimed at this amount, so the bid stands; only the
    // ledger row is missing. Say so rather than reporting a clean success.
    return { ok: false, reason: 'WRITE_FAILED', message: 'Your bid was accepted but could not be fully recorded. Contact the organizer.' };
  }

  return { ok: true, item: (claimed as AuctionItem[])[0], amountCents };
}
