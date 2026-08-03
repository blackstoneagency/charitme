import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { boundedQuery } from '../../../../../lib/query-timeout';
import { createClient } from '../../../../../lib/supabase-server';
import { resolvePayoutDestination } from '../../../../../lib/payout-destination';

export const dynamic = 'force-dynamic';

// GET /api/campaigns/[id]/payout-status — owner-only payout destination state.
// Donations are blocked platform-wide until payoutReady is true, because every
// donation is a Stripe destination charge straight to the recipient's account.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // `.maybeSingle()` so "no rows" stops being reported as an error — otherwise
  // the failure branch below would swallow every genuinely missing campaign.
  const { data: campaign, error: campaignError } = await boundedQuery(() =>
    supabaseAdmin
      .from('campaigns')
      .select('id, user_id, beneficiary_profile_id, beneficiary_name')
      .eq('id', id)
      .maybeSingle(),
  );

  // A failed read is not a missing campaign. This answered 404 "Campaign not
  // found" to the campaign's own organizer because a query timed out.
  if (campaignError) return NextResponse.json({ error: 'We could not load payout details right now. Please try again.', code: 'PAYOUT_STATUS_UNAVAILABLE' }, { status: 503 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const destination = await resolvePayoutDestination(campaign);

  // Beneficiary linkage + their own connect state (for the setup checklist)
  let beneficiaryConnected = false;
  if (campaign.beneficiary_profile_id) {
    const { data, error: beneficiaryError } = await boundedQuery(() =>
      supabaseAdmin
        .from('connected_accounts')
        .select('details_submitted, payouts_enabled, charges_enabled')
        .eq('user_id', campaign.beneficiary_profile_id)
        .eq('verification_status', 'verified')
        .maybeSingle(),
    );
    // `!!` on an unreadable row yields FALSE, which this endpoint renders as a
    // setup checklist telling a fully-connected beneficiary to go and connect.
    // We cannot know, so we do not answer.
    if (beneficiaryError) return NextResponse.json({ error: 'We could not load payout details right now. Please try again.', code: 'PAYOUT_STATUS_UNAVAILABLE' }, { status: 503 });
    beneficiaryConnected = !!(data?.details_submitted && data.payouts_enabled && data.charges_enabled);
  }

  const { data: organizerAccount, error: organizerError } = await boundedQuery(() =>
    supabaseAdmin
      .from('connected_accounts')
      .select('details_submitted, payouts_enabled, charges_enabled')
      .eq('user_id', campaign.user_id)
      .eq('verification_status', 'verified')
      .maybeSingle(),
  );
  if (organizerError) return NextResponse.json({ error: 'We could not load payout details right now. Please try again.', code: 'PAYOUT_STATUS_UNAVAILABLE' }, { status: 503 });
  const organizerConnected = !!(organizerAccount?.details_submitted && organizerAccount.payouts_enabled && organizerAccount.charges_enabled);

  // Most recent unaccepted, unexpired invite (if any)
  const { data: invite } = await supabaseAdmin
    .from('beneficiary_invites')
    .select('email, created_at, expires_at, accepted_at')
    .eq('campaign_id', id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    payoutReady: !!destination,
    destinationRole: destination?.role ?? null,
    organizerConnected,
    beneficiaryLinked: !!campaign.beneficiary_profile_id,
    beneficiaryConnected,
    beneficiaryName: campaign.beneficiary_name ?? null,
    pendingInvite: invite ? { email: invite.email, expiresAt: invite.expires_at } : null,
  });
}
