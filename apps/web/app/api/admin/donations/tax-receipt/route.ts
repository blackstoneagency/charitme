import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { sendTaxReceiptEmail } from '../../../../../lib/email';
import { checkRateLimitDurable } from '../../../../../lib/rate-limit-durable';

const Schema = z.object({
  donationId: z.string().uuid(),
});

// POST /api/admin/donations/tax-receipt
// Admin: issue/re-send a tax receipt for a specific donation.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  // Admin status is carried in profiles.roles (there is no profiles.is_admin
  // column). Use the shared resolver (roles + owner emails + ADMIN_EMAILS).
  if (!await isAdmin(user.id, user.email)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await checkRateLimitDurable(`admin-tax-receipt:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many receipt requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { donationId } = parsed.data;

  // Fetch the donation with campaign and donor info
  const { data: donation, error: donErr } = await supabaseAdmin
    .from('donations')
    .select(`
      id,
      amount_cents,
      currency,
      donor_id,
      status,
      created_at,
      campaigns:campaign_id (
        title,
        slug,
        user_id
      )
    `)
    .eq('id', donationId)
    .single();

  if (donErr || !donation) {
    return NextResponse.json({ error: 'Donation not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  type CampaignJoin = {
    title: string;
    slug: string;
    user_id: string;
  };
  const camp = donation.campaigns as unknown as CampaignJoin | null;
  if (donation.status !== 'completed') {
    return NextResponse.json({
      error: 'Only completed donations can receive a tax receipt',
      code: 'DONATION_NOT_COMPLETED',
    }, { status: 400 });
  }

  const { data: nonprofit } = camp?.user_id
    ? await supabaseAdmin
      .from('nonprofit_profiles')
      .select('id, name, tax_id, verified, verification_status, tax_receipt_enabled')
      .eq('owner_id', camp.user_id)
      .maybeSingle()
    : { data: null };

  const nonprofitVerified = Boolean(nonprofit?.verified) || nonprofit?.verification_status === 'verified';
  if (!camp || !nonprofit || !nonprofitVerified || !nonprofit.tax_receipt_enabled || !nonprofit.tax_id?.trim()) {
    return NextResponse.json({
      error: 'This campaign is not eligible for tax receipts',
      code: 'TAX_RECEIPT_INELIGIBLE',
    }, { status: 400 });
  }

  const { data: profile } = donation.donor_id
    ? await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', donation.donor_id)
      .maybeSingle()
    : { data: null };
  const { data: receiptRecipient } = !donation.donor_id
    ? await supabaseAdmin
      .from('donation_receipts')
      .select('donor_name, donor_email')
      .eq('donation_id', donation.id)
      .limit(1)
      .maybeSingle()
    : { data: null };
  const donorEmail = (profile as { email?: string | null } | null)?.email
    ?? receiptRecipient?.donor_email
    ?? null;
  const donorName = (profile as { full_name?: string | null } | null)?.full_name
    ?? receiptRecipient?.donor_name
    ?? null;

  if (!donorEmail) {
    return NextResponse.json({ error: 'Donor email not found', code: 'NO_RECIPIENT' }, { status: 404 });
  }

  const { formatCents } = await import('../../../../../lib/stripe');
  const amountFormatted = formatCents(donation.amount_cents as number, (donation.currency as string | null) ?? 'usd');
  const receiptNumber = `RCP-${new Date(donation.created_at as string).getUTCFullYear()}-${(donation.id as string).slice(0, 8).toUpperCase()}`;
  const donationDate = new Date(donation.created_at as string).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const { sent } = await sendTaxReceiptEmail({
    to: donorEmail,
    donorName,
    nonprofitName: nonprofit.name,
    nonprofitEin: nonprofit.tax_id,
    campaignTitle: camp.title,
    amountFormatted,
    receiptNumber,
    donationDate,
  });

  // Same rule as the donation receipt: never stamp `emailed_at` or write a
  // `tax_receipt_sent` audit entry for a send that did not happen. This is an
  // IRS-facing document — a false delivery record is a compliance problem, not a
  // cosmetic one.
  if (!sent) {
    return NextResponse.json(
      { error: 'Email could not be sent — receipt not recorded', code: 'EMAIL_UNAVAILABLE' },
      { status: 502 },
    );
  }

  // The receipt has already been emailed to the donor, so a failed write cannot
  // become an error status — that would read as "not sent" and invite a re-send.
  // But dropping it silently leaves an IRS-facing document with no record on our
  // side, which is the same compliance problem the email guard above refuses to
  // create. Log the row and tell the caller the record is missing.
  const { error: receiptErr } = await supabaseAdmin.from('tax_receipts').upsert({
    donation_id: donation.id,
    donor_id: donation.donor_id,
    nonprofit_id: nonprofit.id,
    receipt_number: receiptNumber,
    amount_cents: donation.amount_cents,
    emailed_at: new Date().toISOString(),
  }, { onConflict: 'donation_id' });
  if (receiptErr) {
    console.error('[admin/tax-receipt] tax_receipts upsert failed', {
      donation_id: donation.id,
      receipt_number: receiptNumber,
      amount_cents: donation.amount_cents,
      message: receiptErr.message,
    });
  }

  // Audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'donation.tax_receipt_sent',
      target_type: 'donation',
      target_id: donationId,
      metadata: { receipt_number: receiptNumber },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    ok: true,
    receiptNumber,
    recorded: !receiptErr,
    ...(receiptErr
      ? { warning: 'The receipt was emailed but could not be recorded. Do not re-send — file it manually.' }
      : {}),
  });
}
