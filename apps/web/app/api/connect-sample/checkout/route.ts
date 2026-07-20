import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getStripeClient,
  StripeConfigError,
  baseUrl,
  applicationFeeCents,
} from '../../../../lib/connect-sample/client';

export const dynamic = 'force-dynamic';

// ═════════════════════════════════════════════════════════════════════════════
// Checkout — destination charge with an application fee (hosted Checkout)
//   POST /api/connect-sample/checkout   { priceId, quantity? }
//
// The customer pays the platform; the funds are transferred to the connected
// account at settlement (transfer_data.destination) minus our application fee.
// ═════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const stripeClient = getStripeClient();
    const body = (await request.json().catch(() => ({}))) as {
      priceId?: string;
      quantity?: number;
    };

    const priceId = body.priceId?.trim();
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    if (!priceId) {
      return NextResponse.json({ error: 'priceId is required.' }, { status: 400 });
    }

    // Look up the price to find the amount + owning connected account (stored in
    // the product's metadata by the products route).
    const price = await stripeClient.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product;
    const productObj = product && typeof product !== 'string' ? product : null;
    const destination =
      productObj && 'metadata' in productObj
        ? productObj.metadata?.connected_account_id
        : undefined;

    if (!destination) {
      return NextResponse.json(
        { error: 'This product is not linked to a connected account.' },
        { status: 400 },
      );
    }

    const unitAmount = price.unit_amount ?? 0;
    const feeCents = applicationFeeCents(unitAmount * quantity);

    const base = baseUrl();
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity }],
      payment_intent_data: {
        // Our cut of the sale.
        application_fee_amount: feeCents,
        // Route the remainder to the connected account (destination charge).
        transfer_data: {
          destination,
        },
      },
      success_url: `${base}/connect-sample/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/connect-sample/storefront`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
