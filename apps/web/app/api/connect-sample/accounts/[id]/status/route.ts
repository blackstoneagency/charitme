import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, StripeConfigError } from '../../../../../../lib/connect-sample/client';

export const dynamic = 'force-dynamic';

// ═════════════════════════════════════════════════════════════════════════════
// Account status — read live from the Stripe API (never from a DB cache)
//   GET /api/connect-sample/accounts/:id/status
//
// The source of truth for whether an account can receive payments and whether
// onboarding is complete is Stripe itself. We hydrate the recipient config +
// requirements and derive two booleans the UI uses.
// ═════════════════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const stripeClient = getStripeClient();
    const { id } = await params;
    const account = await stripeClient.v2.core.accounts.retrieve(id, {
      include: ['configuration.recipient', 'requirements'],
    });

    // Can the account actually receive transfers into its Stripe balance?
    const readyToReceivePayments =
      account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ===
      'active';

    // Requirements summary: if nothing is currently/past due, onboarding is done.
    const requirementsStatus = account.requirements?.summary?.minimum_deadline?.status;
    const onboardingComplete =
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

    return NextResponse.json({
      id: account.id,
      display_name: account.display_name,
      contact_email: account.contact_email,
      readyToReceivePayments,
      onboardingComplete,
      requirementsStatus: requirementsStatus ?? null,
    });
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
