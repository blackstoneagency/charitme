import 'server-only';
import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { getAppOrigin } from '../../../../../lib/auth-config';

export const dynamic = 'force-dynamic';

// ── GET /api/stripe/connect/status ────────────────────────────────────────────
// Returns the current Stripe Connect account status for the authenticated user.
// If the account exists but onboarding is incomplete, returns a fresh account
// link URL so the frontend can show a "Complete setup" button.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: connectedAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, verification_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!connectedAccount) {
    return NextResponse.json({ connected: false, onboarded: false });
  }

  // Refresh live status from Stripe
  let liveAccount;
  try {
    liveAccount = await stripe.accounts.retrieve(connectedAccount.stripe_account_id);
  } catch {
    // Account may have been deleted on Stripe side
    return NextResponse.json({ connected: false, onboarded: false, stale: true });
  }

  const onboarded = !!liveAccount.details_submitted;
  const chargesEnabled = !!liveAccount.charges_enabled;
  const payoutsEnabled = !!liveAccount.payouts_enabled;

  // Sync DB if anything has changed
  if (
    connectedAccount.charges_enabled !== chargesEnabled ||
    connectedAccount.payouts_enabled !== payoutsEnabled ||
    connectedAccount.details_submitted !== onboarded
  ) {
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: onboarded,
        verification_status: onboarded ? 'verified' : 'pending',
      })
      .eq('id', connectedAccount.id);
  }

  // If incomplete, generate a fresh account link for re-onboarding
  let resumeUrl: string | null = null;
  if (!onboarded) {
    try {
      const origin = getAppOrigin();
      const link = await stripe.accountLinks.create({
        account: connectedAccount.stripe_account_id,
        refresh_url: `${origin}/dashboard/payouts`,
        return_url: `${origin}/api/stripe/connect?account=${connectedAccount.stripe_account_id}&user=${user.id}`,
        type: 'account_onboarding',
      });
      resumeUrl = link.url;
    } catch { /* non-critical */ }
  }

  return NextResponse.json({
    connected: true,
    onboarded,
    chargesEnabled,
    payoutsEnabled,
    stripeAccountId: connectedAccount.stripe_account_id,
    resumeUrl,
  });
}
