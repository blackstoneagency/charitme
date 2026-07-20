import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, StripeConfigError } from '../../../../lib/connect-sample/client';
import { transfersActive } from '../../../../lib/connect-sample/status';

export const dynamic = 'force-dynamic';

// ═════════════════════════════════════════════════════════════════════════════
// Connected accounts (Stripe Connect V2)
//   POST /api/connect-sample/accounts       → create a connected account
//   GET  /api/connect-sample/accounts       → list connected accounts
//
// The platform is responsible for pricing and fee collection, so we create a
// V2 "recipient" account where the application collects fees and losses.
// ═════════════════════════════════════════════════════════════════════════════

// POST — create a connected account.
export async function POST(request: NextRequest) {
  try {
    const stripeClient = getStripeClient();
    const body = (await request.json().catch(() => ({}))) as {
      displayName?: string;
      contactEmail?: string;
    };

    // Values collected from the user creating the account.
    const displayName = body.displayName?.trim();
    const contactEmail = body.contactEmail?.trim();
    if (!displayName || !contactEmail) {
      return NextResponse.json(
        { error: 'displayName and contactEmail are required.' },
        { status: 400 },
      );
    }

    // Create the account with the V2 accounts API.
    // IMPORTANT: never pass a top-level `type` (no 'express'/'standard'/'custom').
    const account = await stripeClient.v2.core.accounts.create({
      display_name: displayName,
      contact_email: contactEmail,
      identity: {
        // The account's home country. 'us' for this sample.
        country: 'us',
      },
      // Give the connected user an Express dashboard experience.
      dashboard: 'express',
      defaults: {
        responsibilities: {
          // The PLATFORM collects fees and is responsible for losses — this is
          // what lets us charge an application fee on destination charges.
          fees_collector: 'application',
          losses_collector: 'application',
        },
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              // Request the ability to receive transfers into the Stripe balance.
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
    });

    // In a real app, persist the mapping { your user → account.id } in your DB
    // so you can look it up later. This sample reads accounts back from Stripe
    // directly (see GET below), so no storage is required for the demo.
    return NextResponse.json({ id: account.id, account });
  } catch (err) {
    return handleError(err);
  }
}

// GET — list connected accounts (used by the dashboard + storefront).
export async function GET() {
  try {
    const stripeClient = getStripeClient();
    // The V2 accounts list, filtered to accounts that have the recipient
    // configuration (the ones this sample creates). The list endpoint does not
    // hydrate capability status — the dashboard fetches live per-account status
    // from the /status route, which retrieves with the recipient config expanded.
    const accounts = await stripeClient.v2.core.accounts.list({
      applied_configurations: ['recipient'],
    });
    return NextResponse.json({
      data: accounts.data.map((a) => ({
        id: a.id,
        display_name: a.display_name,
        contact_email: a.contact_email,
        // May be undefined on the list payload; the /status route reports the
        // authoritative value.
        transfers_active: transfersActive(a),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  // Missing-env errors get a 400 with the actionable message; everything else 500.
  if (err instanceof StripeConfigError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return NextResponse.json({ error: message }, { status: 500 });
}
