import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase-server';
import { placeBid } from '../../../../../lib/auctions';

export const dynamic = 'force-dynamic';

// POST /api/auctions/[id]/bids — place a bid on an auction lot.
//
// Signed-in only: a bid is a financial commitment and has to be attributable.
// `bidder_id` comes from the session, never from the request body — accepting it
// from the caller would let anyone bid in someone else's name.
//
// Returns 401 rather than using requireUser(), which REDIRECTS to /login. A
// redirect hands this endpoint's fetch caller an HTML page, so `res.json()`
// throws and the bidder sees a generic connection error instead of "your session
// expired". Every other API route in the app returns 401; this one now matches.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to place a bid.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const { id } = await params;

  let amountCents: unknown;
  try {
    const body = (await request.json()) as { amountCents?: unknown };
    amountCents = body.amountCents;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const result = await placeBid(id, user.id, amountCents as number);

  if (!result.ok) {
    // 409 for losing the race — the request was well formed and the client
    // should re-read and retry, which is a different instruction from 400.
    const status =
      result.reason === 'NOT_FOUND' ? 404
      : result.reason === 'OUTBID' ? 409
      : result.reason === 'WRITE_FAILED' ? 502
      : 400;
    return NextResponse.json(
      { error: result.message, code: result.reason, minimumCents: result.minimumCents },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    itemId: result.item.id,
    currentBidCents: result.item.current_bid_cents,
    amountCents: result.amountCents,
  });
}
