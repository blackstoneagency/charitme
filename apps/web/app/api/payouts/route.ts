import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { createClient } from '../../../lib/supabase-server';
import { stripe } from '../../../lib/stripe';

export const dynamic = 'force-dynamic';

// ── POST /api/payouts ─────────────────────────────────────────────────────────
// CharitMe uses Stripe Connect DESTINATION CHARGES: every donation transfers the
// principal straight to the recipient's own connected account at charge time, and
// Stripe automatically pays that balance out to their bank on the account's payout
// schedule. CharitMe never holds the funds.
//
// Because the money is already in the organizer's connected account, there is NO
// platform-initiated "move money" step. A `stripe.transfers.create` here would
// DOUBLE-PAY the recipient (they already have the funds) out of the platform
// balance — which only holds application fees. This endpoint therefore issues a
// single-use Stripe Express dashboard login link so the organizer can view their
// balance, payout schedule, and history and trigger an instant payout in Stripe.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Connected account must be fully onboarded before its dashboard exists.
  const { data: connectedAccount, error: connectedAccountError } = await boundedQuery(() =>
    supabaseAdmin
      .from('connected_accounts')
      .select('stripe_account_id, payouts_enabled, details_submitted')
      .eq('user_id', user.id)
      .eq('verification_status', 'verified')
      .maybeSingle(),
  );

  // An unreadable row is not an unfinished onboarding. This fell through to
  // "Complete Stripe onboarding before accessing payouts" — telling a fully
  // verified fundraiser their setup is incomplete, and sending them back into a
  // flow they already finished, because a query failed.
  //
  // It fails CLOSED, so no money moves either way; the fix is about not making a
  // false statement about someone's account.
  if (connectedAccountError) {
    return NextResponse.json({
      error: 'We could not check your payout account right now. Please try again.',
      code: 'CONNECT_STATUS_UNAVAILABLE',
    }, { status: 503 });
  }

  if (!connectedAccount?.stripe_account_id || !connectedAccount.payouts_enabled || !connectedAccount.details_submitted) {
    return NextResponse.json({
      error: 'Complete Stripe onboarding before accessing payouts.',
      code: 'CONNECT_INCOMPLETE',
    }, { status: 400 });
  }

  try {
    const link = await stripe.accounts.createLoginLink(connectedAccount.stripe_account_id);
    return NextResponse.json({
      ok: true,
      url: link.url,
      automatic: true,
      message:
        'Donations are sent to your connected account automatically and Stripe ' +
        'pays them out to your bank on your payout schedule — CharitMe never holds ' +
        'your funds. Open your Stripe dashboard to view your balance, schedule, and ' +
        'history, or start an instant payout.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not open your Stripe dashboard';
    return NextResponse.json({ error: message, code: 'STRIPE_ERROR' }, { status: 502 });
  }
}
