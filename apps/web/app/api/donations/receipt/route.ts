import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';
import { createClient } from '../../../../lib/supabase-server';
import { sendReceiptEmail, sendTaxReceiptEmail } from '../../../../lib/email';
import { formatCents } from '../../../../lib/stripe';
import {
  canAccessDonationReceipt,
  normalizeReceiptEmail,
} from '../../../../lib/tax-receipt-access';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';

const Schema = z.object({ donationId: z.string().uuid() });

type DonationRow = {
  id: string;
  donor_id: string | null;
  amount_cents: number;
  tip_cents: number | null;
  processing_fee_cents: number | null;
  currency: string | null;
  campaign_id: string;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  campaigns: { title: string; slug: string } | null;
};

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

  const { data: donation, error: donationError } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, tip_cents, processing_fee_cents, currency, campaign_id, status, created_at, stripe_payment_intent_id, stripe_checkout_session_id, campaigns:campaign_id(title, slug)')
    .eq('id', parsed.data.donationId)
    .maybeSingle();
  if (donationError) {
    return NextResponse.json({ error: 'Receipt data unavailable', code: 'RECEIPT_DATA_UNAVAILABLE' }, { status: 503 });
  }
  if (!donation) {
    return NextResponse.json({ error: 'Donation not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  const don = donation as unknown as DonationRow;

  const { data: receipt, error: receiptLoadError } = await supabaseAdmin
    .from('donation_receipts')
    .select('id, donor_id, donor_email, donor_name, receipt_number, receipt_type')
    .eq('donation_id', don.id)
    .limit(1)
    .maybeSingle();
  if (receiptLoadError) {
    return NextResponse.json({ error: 'Receipt data unavailable', code: 'RECEIPT_DATA_UNAVAILABLE' }, { status: 503 });
  }

  const ownsReceipt = canAccessDonationReceipt({
    userId: user.id,
    userEmail: user.email,
    donationDonorId: don.donor_id,
    receiptDonorId: receipt?.donor_id ?? null,
    receiptEmail: receipt?.donor_email ?? null,
  });
  if (!ownsReceipt && !(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }
  if (don.status !== 'completed') {
    return NextResponse.json({ error: 'Donation not completed', code: 'DONATION_NOT_COMPLETED' }, { status: 400 });
  }
  if (!don.campaigns) {
    return NextResponse.json({ error: 'Campaign not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });
  }

  const { data: profile } = don.donor_id
    ? await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', don.donor_id)
      .maybeSingle()
    : { data: null };
  const donorEmail = normalizeReceiptEmail(
    (profile as { email?: string | null } | null)?.email
      ?? receipt?.donor_email
      ?? (ownsReceipt ? user.email : null),
  );
  const donorName = (profile as { full_name?: string | null } | null)?.full_name
    ?? receipt?.donor_name
    ?? null;
  if (!donorEmail) {
    return NextResponse.json({ error: 'No donor email on file', code: 'NO_RECIPIENT' }, { status: 422 });
  }

  const { data: taxReceipt, error: taxReceiptError } = await supabaseAdmin
    .from('tax_receipts')
    .select('receipt_number, nonprofit_name, nonprofit_ein, campaign_title')
    .eq('donation_id', don.id)
    .maybeSingle();
  if (taxReceiptError) {
    return NextResponse.json({ error: 'Receipt data unavailable', code: 'RECEIPT_DATA_UNAVAILABLE' }, { status: 503 });
  }

  const amountFormatted = formatCents(don.amount_cents, don.currency ?? 'usd');
  const delivery = taxReceipt?.nonprofit_name && taxReceipt.nonprofit_ein
    ? await sendTaxReceiptEmail({
      to: donorEmail,
      donorName,
      nonprofitName: taxReceipt.nonprofit_name,
      nonprofitEin: taxReceipt.nonprofit_ein,
      campaignTitle: taxReceipt.campaign_title ?? don.campaigns.title,
      amountFormatted,
      receiptNumber: taxReceipt.receipt_number,
      donationDate: new Date(don.created_at).toLocaleDateString(
        'en-US',
        { month: 'long', day: 'numeric', year: 'numeric' },
      ),
    })
    : await sendReceiptEmail({
      to: donorEmail,
      donorName,
      campaignTitle: don.campaigns.title,
      campaignSlug: don.campaigns.slug,
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
  const receiptNumber = taxReceipt?.receipt_number
    ?? receipt?.receipt_number
    ?? `RCP-${new Date(don.created_at).getUTCFullYear()}-${don.id.slice(0, 8).toUpperCase()}`;
  const receiptValues = {
    donation_id: don.id,
    donor_id: don.donor_id,
    campaign_id: don.campaign_id,
    receipt_number: receiptNumber,
    amount_cents: don.amount_cents,
    tip_cents: don.tip_cents ?? 0,
    processing_fee_cents: don.processing_fee_cents ?? 0,
    currency: don.currency ?? 'usd',
    is_tax_deductible: Boolean(taxReceipt),
    nonprofit_ein: taxReceipt?.nonprofit_ein ?? null,
    campaign_title: don.campaigns.title,
    donor_name: donorName,
    donor_email: donorEmail,
    email_sent_at: deliveredAt,
    resent_at: deliveredAt,
    stripe_payment_intent_id: don.stripe_payment_intent_id,
    stripe_checkout_session_id: don.stripe_checkout_session_id,
    receipt_type: receipt?.receipt_type ?? 'donation',
  };
  const { error: receiptError } = receipt
    ? await supabaseAdmin
      .from('donation_receipts')
      .update(receiptValues)
      .eq('id', receipt.id)
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
