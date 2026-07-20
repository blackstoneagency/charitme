// ═════════════════════════════════════════════════════════════════════════════
// Connect V2 account-status derivation — pure, no I/O, unit-testable.
//
// The Stripe API is the source of truth for whether a connected account can
// receive payments and whether onboarding is complete. The route fetches the
// account (with configuration.recipient + requirements hydrated) and passes the
// raw object here; these helpers turn it into the booleans the UI consumes.
//
// The input is a minimal structural shape (not the full Stripe type) so the
// logic can be exercised directly in tests — mirroring accountIsPayoutReady.
// ═════════════════════════════════════════════════════════════════════════════

/** The subset of a retrieved V2 account these helpers read. */
export interface RecipientAccountShape {
  configuration?: {
    recipient?: {
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: { status?: string | null } | null;
        } | null;
      } | null;
    } | null;
  } | null;
  requirements?: {
    summary?: {
      minimum_deadline?: { status?: string | null } | null;
    } | null;
  } | null;
}

export interface AccountStatus {
  /** The account can receive transfers into its Stripe balance. */
  readyToReceivePayments: boolean;
  /** No outstanding onboarding requirements are currently/past due. */
  onboardingComplete: boolean;
  /** The raw requirements deadline status, or null when none is reported. */
  requirementsStatus: string | null;
}

/** True when the recipient's stripe_transfers capability is fully active. */
export function transfersActive(account: RecipientAccountShape | null | undefined): boolean {
  return (
    account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ===
    'active'
  );
}

/**
 * Onboarding is complete unless Stripe reports requirements that are currently
 * or already past due. A null/absent status means nothing is outstanding.
 */
export function onboardingComplete(requirementsStatus: string | null | undefined): boolean {
  return requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';
}

/** Derive the full status object the /status route returns. */
export function deriveAccountStatus(
  account: RecipientAccountShape | null | undefined,
): AccountStatus {
  const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status ?? null;
  return {
    readyToReceivePayments: transfersActive(account),
    onboardingComplete: onboardingComplete(requirementsStatus),
    requirementsStatus,
  };
}
