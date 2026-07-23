import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { sendTaxReceiptEmail } from '../../../../../lib/email';

const Schema = z.object({
  donationId: z.string().uuid(),
});

// POST /api/admin/donations/tax-receipt
// Admin: issue/re-send a tax receipt for a specific donation.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Admin status is carried in profiles.roles (there is no profiles.is_admin
  // column). Use the shared resolver (roles + owner emails + ADMIN_EMAILS).
  if (!await isAdmin(user.id, user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
  }

  type CampaignJoin = {
    title: string;
    slug: string;
    user_id: string;
  };
  const camp = donation.campaigns as unknown as CampaignJoin | null;
  if (donation.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed donations can receive a tax receipt' }, { status: 400 });
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
    return NextResponse.json({ error: 'This campaign is not eligible for tax receipts' }, { status: 400 });
  }

  if (!donation.donor_id) {
    return NextResponse.json({ error: 'Cannot send tax receipt for anonymous donation' }, { status: 400 });
  }

  // Fetch donor profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', donation.donor_id)
    .single();

  if (!(profile as { email?: string } | null)?.email) {
    return NextResponse.json({ error: 'Donor email not found' }, { status: 404 });
  }

  const { formatCents } = await import('../../../../../lib/stripe');
  const amountFormatted = formatCents(donation.amount_cents as number, (donation.currency as string | null) ?? 'usd');
  const receiptNumber = `RCP-${new Date(donation.created_at as string).getUTCFullYear()}-${(donation.id as string).slice(0, 8).toUpperCase()}`;
  const donationDate = new Date(donation.created_at as string).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  await sendTaxReceiptEmail({
    to: (profile as { email: string }).email,
    donorName: (profile as { full_name?: string }).full_name,
    nonprofitName: nonprofit.name,
    nonprofitEin: nonprofit.tax_id,
    campaignTitle: camp.title,
    amountFormatted,
    receiptNumber,
    donationDate,
  });

  await supabaseAdmin.from('tax_receipts').upsert({
    donation_id: donation.id,
    donor_id: donation.donor_id,
    nonprofit_id: nonprofit.id,
    receipt_number: receiptNumber,
    amount_cents: donation.amount_cents,
    emailed_at: new Date().toISOString(),
  }, { onConflict: 'donation_id' });

  // Audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'donation.tax_receipt_sent',
      target_type: 'donation',
      target_id: donationId,
      metadata: { receipt_number: receiptNumber, recipient: (profile as { email: string }).email },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, receiptNumber });
}
