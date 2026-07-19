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

export interface ConnectedAccountReadiness {
  stripe_account_id?: string | null;
  details_submitted?: boolean | null;
  payouts_enabled?: boolean | null;
  charges_enabled?: boolean | null;
}

/**
 * A connected account may accept live donations only when Stripe onboarding is
 * fully complete: the account exists, onboarding details are submitted, and
 * BOTH charges and payouts are enabled. Anything less means a destination
 * charge would fail (or funds could not be paid out), so donations must stay
 * blocked. This is the enforcement point for the "no donation before payout
 * readiness" rule — see docs/payments/money-flow.md.
 */
export function accountIsPayoutReady(account: ConnectedAccountReadiness | null | undefined): boolean {
  return (
    !!account?.stripe_account_id &&
    !!account.details_submitted &&
    !!account.payouts_enabled &&
    !!account.charges_enabled
  );
}

async function verifiedAccount(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted, charges_enabled')
    .eq('user_id', userId)
    .eq('verification_status', 'verified')
    .maybeSingle();

  return accountIsPayoutReady(data) ? data!.stripe_account_id! : null;
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
