import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, StripeConfigError } from '../../../../lib/connect-sample/client';

export const dynamic = 'force-dynamic';

// ═════════════════════════════════════════════════════════════════════════════
// Products — created at the PLATFORM level (not on the connected account)
//   POST /api/connect-sample/products   → create a product for a connected acct
//   GET  /api/connect-sample/products   → list sample products
//
// Because charges are destination charges (money flows platform → connected
// account at settlement), the products live on the platform account. We record
// which connected account a product belongs to in the product's metadata.
// ═════════════════════════════════════════════════════════════════════════════

// Tag we use to identify products created by this sample (so GET can filter).
const SAMPLE_TAG = 'connect_sample';

// POST — create a product with an inline default price.
export async function POST(request: NextRequest) {
  try {
    const stripeClient = getStripeClient();
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      priceCents?: number;
      currency?: string;
      accountId?: string;
    };

    const name = body.name?.trim();
    const accountId = body.accountId?.trim();
    const priceCents = Number(body.priceCents);
    if (!name || !accountId || !Number.isFinite(priceCents) || priceCents < 1) {
      return NextResponse.json(
        { error: 'name, accountId and a positive priceCents are required.' },
        { status: 400 },
      );
    }

    const product = await stripeClient.products.create({
      name,
      description: body.description?.trim() || undefined,
      default_price_data: {
        unit_amount: Math.round(priceCents),
        currency: (body.currency?.trim() || 'usd').toLowerCase(),
      },
      // Store the product → connected-account mapping so the storefront and
      // checkout know where to send the funds. In a real app you might also
      // keep this in your own DB.
      metadata: {
        sample: SAMPLE_TAG,
        connected_account_id: accountId,
      },
    });

    return NextResponse.json({ id: product.id, product });
  } catch (err) {
    return handleError(err);
  }
}

// GET — list this sample's products with their price + owning account.
export async function GET() {
  try {
    const stripeClient = getStripeClient();
    const products = await stripeClient.products.list({
      active: true,
      limit: 100,
      expand: ['data.default_price'],
    });

    const data = products.data
      .filter((p) => p.metadata?.sample === SAMPLE_TAG)
      .map((p) => {
        const price = p.default_price;
        const priceObj = price && typeof price !== 'string' ? price : null;
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          connected_account_id: p.metadata?.connected_account_id ?? null,
          price_id: priceObj?.id ?? (typeof price === 'string' ? price : null),
          unit_amount: priceObj?.unit_amount ?? null,
          currency: priceObj?.currency ?? 'usd',
        };
      });

    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof StripeConfigError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return NextResponse.json({ error: message }, { status: 500 });
}
