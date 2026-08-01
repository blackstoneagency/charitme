import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { sendReceiptEmail, sendTaxReceiptEmail } from '../../../../lib/email';
import { formatCents } from '../../../../lib/stripe';
import { loadReceiptForUser } from '../../../../lib/receipt-load';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';

const Schema = z.object({ donationId: z.string().uuid() });

/**
 * POST resends the receipt. GET renders it for the preview surface.
 *
 * Both go through `loadReceiptForUser`, which owns the authorization. Splitting
 * that check across two handlers is how a read-only surface ends up leaking
 * donor names and amounts — the resend path gets the careful check and the
 * "harmless" one gets a lighter version, and nothing looks wrong.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!(await checkRateLimitDurable(`donation-receipt:${user.id}`, 5, 60_000))) {
    return NextResponse.json({ error: 'Too many receipt requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'donationId required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const loaded = await loadReceiptForUser(parsed.data.donationId, user);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error, code: loaded.code }, { status: loaded.status });
  }
  const { donation: don, existingReceipt, taxReceipt, donorEmail, donorName } = loaded;
  if (!donorEmail) {
    return NextResponse.json({ error: 'No donor email on file', code: 'NO_RECIPIENT' }, { status: 422 });
  }

  const amountFormatted = formatCents(don.amountCents, don.currency);
  const delivery = taxReceipt
    ? await sendTaxReceiptEmail({
      to: donorEmail,
      donorName,
      nonprofitName: taxReceipt.nonprofitName,
      nonprofitEin: taxReceipt.nonprofitEin,
      campaignTitle: don.campaignTitle,
      amountFormatted,
      receiptNumber: taxReceipt.receiptNumber,
      donationDate: new Date(don.createdAt).toLocaleDateString(
        'en-US',
        { month: 'long', day: 'numeric', year: 'numeric' },
      ),
    })
    : await sendReceiptEmail({
      to: donorEmail,
      donorName,
      campaignTitle: don.campaignTitle,
      campaignSlug: don.campaignSlug,
      amountFormatted,
      donationId: don.id,
    });
  if (!delivery.sent) {
    return NextResponse.json(
      { error: 'Email could not be sent right now', code: 'EMAIL_UNAVAILABLE' },
      { status: 502 },
    );
  }

  const deliveredAt = new Date().toISOString();
  const receiptNumber = taxReceipt?.receiptNumber
    ?? existingReceipt?.receiptNumber
    ?? `RCP-${new Date(don.createdAt).getUTCFullYear()}-${don.id.slice(0, 8).toUpperCase()}`;
  const receiptValues = {
    donation_id: don.id,
    donor_id: don.donorId,
    campaign_id: don.campaignId,
    receipt_number: receiptNumber,
    amount_cents: don.amountCents,
    tip_cents: don.tipCents,
    processing_fee_cents: don.processingFeeCents,
    currency: don.currency,
    is_tax_deductible: Boolean(taxReceipt),
    nonprofit_ein: taxReceipt?.nonprofitEin ?? null,
    campaign_title: don.campaignTitle,
    donor_name: donorName,
    donor_email: donorEmail,
    email_sent_at: deliveredAt,
    resent_at: deliveredAt,
    stripe_payment_intent_id: don.stripePaymentIntentId,
    stripe_checkout_session_id: don.stripeCheckoutSessionId,
    receipt_type: existingReceipt?.receiptType ?? 'donation',
  };
  const { error: receiptError } = existingReceipt
    ? await supabaseAdmin
      .from('donation_receipts')
      .update(receiptValues)
      .eq('id', existingReceipt.id)
    : await supabaseAdmin.from('donation_receipts').insert(receiptValues);
  if (receiptError) {
    return NextResponse.json({
      ok: true,
      warning: 'The receipt was sent but its delivery record could not be updated.',
      code: 'RECEIPT_RECORD_UNAVAILABLE',
    });
  }

  return NextResponse.json({ ok: true, receiptNumber });
}

/**
 * The receipt itself, as HTML, for the preview iframe.
 *
 * Returns the document `sendReceiptEmail` would send — not a re-creation of it.
 * `X-Frame-Options: SAMEORIGIN` because this is framed by our own page and by
 * nothing else; `noindex` because a receipt must never reach a search engine.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = Schema.safeParse({ donationId: request.nextUrl.searchParams.get('donationId') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'donationId required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const loaded = await loadReceiptForUser(parsed.data.donationId, user);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error, code: loaded.code }, { status: loaded.status });
  }

  return new NextResponse(loaded.mail.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
