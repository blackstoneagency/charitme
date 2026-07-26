import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { sendReceiptEmail } from '../../../../../../lib/email';
import { formatCents } from '../../../../../../lib/stripe';
import { verifyAdmin } from '../../../users/_auth';

// ─────────────────────────────────────────────────────────────────────────────
// Admin "Send / Resend receipt".
//
// This endpoint used to stamp `receipt_sent_at`, write an audit-log entry saying
// `donation.receipt_sent`, and return ok — WITHOUT SENDING ANY EMAIL. The console
// then told the operator "A donation receipt has been sent to <donor>". So a tax
// document the donor never received was recorded as delivered, in the audit log
// that exists precisely to evidence that it was. Worse than a no-op.
//
// It now sends first and records only what actually happened.
// ─────────────────────────────────────────────────────────────────────────────

type DonationRow = {
  id: string;
  donor_id: string | null;
  amount_cents: number;
  tip_cents: number | null;
  processing_fee_cents: number | null;
  currency: string | null;
  status: string;
  campaign_id: string;
  offline_donor_email: string | null;
  offline_donor_name: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  campaigns: { title: string; slug: string; nonprofit_verified: boolean | null } | null;
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: donation, error: loadError } = await supabaseAdmin
    .from('donations')
    .select(
      'id, donor_id, amount_cents, tip_cents, processing_fee_cents, currency, status, campaign_id,' +
      ' offline_donor_email, offline_donor_name, stripe_payment_intent_id, stripe_checkout_session_id,' +
      ' campaigns:campaign_id(title, slug, nonprofit_verified)',
    )
    .eq('id', id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
  if (!donation) {
    return NextResponse.json({ error: 'Donation not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const don = donation as unknown as DonationRow;
  const campaign = don.campaigns;
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // The recipient is the DONOR — never the admin triggering the send. Offline
  // donations carry their own contact details instead of a profile.
  let donorEmail = don.offline_donor_email;
  let donorName = don.offline_donor_name;
  if (don.donor_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', don.donor_id)
      .maybeSingle();
    donorEmail = (profile as { email?: string | null } | null)?.email ?? donorEmail;
    donorName = (profile as { full_name?: string | null } | null)?.full_name ?? donorName;
  }

  if (!donorEmail) {
    // An anonymous cash donation with no contact details has nowhere to go. Say so
    // rather than recording a receipt nobody can receive.
    return NextResponse.json(
      { error: 'This donation has no donor email on file', code: 'NO_RECIPIENT' },
      { status: 422 },
    );
  }

  const { sent } = await sendReceiptEmail({
    to: donorEmail,
    donorName,
    campaignTitle: campaign.title,
    campaignSlug: campaign.slug,
    amountFormatted: formatCents(don.amount_cents, don.currency ?? 'usd'),
    donationId: don.id,
  });

  if (!sent) {
    // Email is not configured (no RESEND_API_KEY) or the provider rejected it.
    return NextResponse.json(
      { error: 'Email could not be sent — receipt not recorded', code: 'EMAIL_UNAVAILABLE' },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('donations')
    .update({ receipt_sent_at: now, updated_at: now })
    .eq('id', id)
    .select('id, receipt_sent_at')
    .single();

  if (updateError) {
    // The donor HAS the receipt at this point; failing the request would invite a
    // duplicate send. Report success and let the ledger write below be the record.
    console.error('[admin/receipt] sent but could not stamp receipt_sent_at', updateError.message);
  }

  // Ledger row — `donation_receipts` existed with receipt_number/email_sent_at/
  // resent_at columns and had never been written to (0 rows in production), so the
  // platform kept no record of which tax receipts it had issued.
  const { data: existing } = await supabaseAdmin
    .from('donation_receipts')
    .select('id')
    .eq('donation_id', don.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('donation_receipts')
      .update({ resent_at: now, donor_email: donorEmail, donor_name: donorName })
      .eq('id', (existing as { id: string }).id);
  } else {
    await supabaseAdmin.from('donation_receipts').insert({
      donation_id: don.id,
      donor_id: don.donor_id,
      campaign_id: don.campaign_id,
      amount_cents: don.amount_cents,
      tip_cents: don.tip_cents ?? 0,
      processing_fee_cents: don.processing_fee_cents ?? 0,
      currency: don.currency ?? 'usd',
      // Deductibility is per-campaign verification, never the donor's `nonprofit`
      // role — see lib/role-capabilities.ts.
      is_tax_deductible: campaign.nonprofit_verified === true,
      campaign_title: campaign.title,
      donor_name: donorName,
      donor_email: donorEmail,
      email_sent_at: now,
      stripe_payment_intent_id: don.stripe_payment_intent_id,
      stripe_checkout_session_id: don.stripe_checkout_session_id,
      receipt_type: 'donation',
    });
  }

  await supabaseAdmin
    .from('audit_logs')
    .insert({
      actor_id: admin.id,
      action: 'donation.receipt_sent',
      target_type: 'donation',
      target_id: id,
      metadata: { to: donorEmail, resent: Boolean(existing) },
      created_at: now,
    })
    .then(() => undefined);

  return NextResponse.json({ ok: true, donation: updated ?? { id, receipt_sent_at: now } });
}
