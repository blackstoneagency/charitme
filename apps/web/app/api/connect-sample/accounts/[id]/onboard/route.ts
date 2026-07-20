import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, StripeConfigError, baseUrl } from '../../../../../../lib/connect-sample/client';

export const dynamic = 'force-dynamic';

// ═════════════════════════════════════════════════════════════════════════════
// Onboarding — create a hosted account-onboarding link (Stripe Connect V2)
//   POST /api/connect-sample/accounts/:id/onboard
//
// Returns a { url } the client redirects the connected user to so they can
// complete Stripe's hosted onboarding (identity, bank details, etc.).
// ═════════════════════════════════════════════════════════════════════════════

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const stripeClient = getStripeClient();
    const { id: accountId } = await params;

    // Where Stripe sends the user after onboarding. `refresh_url` is used if the
    // link expires before completion; `return_url` after they finish/return.
    const dashboard = `${baseUrl()}/connect-sample`;

    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          // Onboard the "recipient" configuration we requested at account creation.
          configurations: ['recipient'],
          refresh_url: `${dashboard}?onboarding=refresh&account=${encodeURIComponent(accountId)}`,
          return_url: `${dashboard}?onboarding=return&account=${encodeURIComponent(accountId)}`,
        },
      },
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
