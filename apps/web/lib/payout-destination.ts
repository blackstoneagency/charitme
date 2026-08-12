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
/**
 * Seeded account ids, which must never be used as a payout destination.
 *
 * ⚠️ MEASURED IN PRODUCTION, 2026-08-11. `connected_accounts` holds 501 rows.
 * FIVE HUNDRED of them carry a fabricated id of the form `acct_<16 lowercase
 * hex>` — they are MD5 prefixes (`acct_c4ca4238a0b92382` is md5("1")) written by
 * a seed script. **375 of those are flagged `verification_status='verified'`
 * with charges_enabled and payouts_enabled true**, so this function declared
 * them payout-ready and a real donation would have been built as a destination
 * charge to a Stripe account that does not exist.
 *
 * Exactly one row is a real account, and it has `charges_enabled = false`.
 *
 * A real Stripe account id is `acct_` followed by 16 MIXED-CASE alphanumerics
 * (the live one here is `acct_1U0scbB26VOPUk5O`). Sixteen characters of pure
 * lowercase hex is the seeder's signature, not Stripe's. The chance a genuine id
 * is all lowercase hex is about (16/62)^16 ≈ 1e-10 — small enough to reject on,
 * and the failure mode of rejecting one is a donation blocked rather than money
 * misrouted, which is the right direction to be wrong in.
 */
const SEEDED_ACCOUNT_ID = /^acct_[0-9a-f]{16}$/;

export function isSeededAccountId(id: string | null | undefined): boolean {
  return typeof id === 'string' && SEEDED_ACCOUNT_ID.test(id);
}

export function accountIsPayoutReady(account: ConnectedAccountReadiness | null | undefined): boolean {
  return (
    !!account?.stripe_account_id &&
    // ⚠️ Checked BEFORE the database's own flags, because the flags are exactly
    // what the seed data sets to true. Trusting them is what made 375 fictional
    // accounts look ready to receive other people's money.
    !isSeededAccountId(account.stripe_account_id) &&
    !!account.details_submitted &&
    !!account.payouts_enabled &&
    !!account.charges_enabled
  );
}

/**
 * Raised when readiness could not be DETERMINED, as distinct from determined to
 * be "not ready".
 *
 * ⚠️ This read used to drop its `error`, and the two cases collapsed into
 * `null`. For the organizer that is harmless — the caller blocks the donation.
 * For the BENEFICIARY it silently redirected money: `resolvePayoutDestination`
 * treats a null beneficiary as "no beneficiary account" and falls through to the
 * organizer, so a transient database failure on the beneficiary lookup routes
 * the donation to a DIFFERENT PERSON — defeating the guarantee in this file's own
 * header that "the organizer never touches the money either".
 *
 * Declining a donation is recoverable. Paying the wrong person is not.
 */
export class PayoutLookupUnavailableError extends Error {
  constructor(cause: string) {
    super(`payout readiness could not be determined: ${cause}`);
    this.name = 'PayoutLookupUnavailableError';
  }
}

async function verifiedAccount(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted, charges_enabled')
    .eq('user_id', userId)
    .eq('verification_status', 'verified')
    .maybeSingle();

  // `.maybeSingle()` already returns { data: null, error: null } for "no row",
  // so an error here means the question genuinely could not be answered.
  if (error) throw new PayoutLookupUnavailableError(error.message);

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
