import 'server-only';
import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Payout destination resolution — the core of CharitMe's "never hold funds"
// guarantee. Every donation is created as a Stripe destination charge, so the
// money transfers to the recipient's own Stripe account at charge time and
// never sits in CharitMe's platform balance.
//
// Resolution order:
//   1. The campaign beneficiary's verified connected account (campaigns
//      created on behalf of someone route funds directly to that person —
//      the organizer never touches the money either)
//   2. The organizer's verified connected account
//   3. None → donations are BLOCKED until payout setup completes
// ─────────────────────────────────────────────────────────────────────────────

export interface PayoutDestination {
  stripeAccountId: string;
  recipientUserId: string;
  role: 'beneficiary' | 'organizer';
}

async function verifiedAccount(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted, charges_enabled')
    .eq('user_id', userId)
    .eq('verification_status', 'verified')
    .maybeSingle();

  const ok =
    !!data?.details_submitted &&
    !!data.payouts_enabled &&
    !!data.charges_enabled &&
    !!data.stripe_account_id;

  return ok ? data!.stripe_account_id : null;
}

export async function resolvePayoutDestination(campaign: {
  user_id: string;
  beneficiary_profile_id?: string | null;
}): Promise<PayoutDestination | null> {
  if (campaign.beneficiary_profile_id) {
    const beneficiaryAccount = await verifiedAccount(campaign.beneficiary_profile_id);
    if (beneficiaryAccount) {
      return { stripeAccountId: beneficiaryAccount, recipientUserId: campaign.beneficiary_profile_id, role: 'beneficiary' };
    }
  }

  const organizerAccount = await verifiedAccount(campaign.user_id);
  if (organizerAccount) {
    return { stripeAccountId: organizerAccount, recipientUserId: campaign.user_id, role: 'organizer' };
  }

  return null;
}
