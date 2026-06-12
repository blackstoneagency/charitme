import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { sendTaxReceiptEmail } from '../../../../../lib/email';

const Schema = z.object({
  donationId: z.string().uuid(),
});

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  return !!(data as { is_admin?: boolean } | null)?.is_admin;
}

// POST /api/admin/donations/tax-receipt
// Admin: issue/re-send a tax receipt for a specific donation.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await isAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
      created_at,
      campaigns:campaign_id (
        title,
        slug,
        nonprofit_profiles:nonprofit_id (
          organization_name,
          ein,
          verification_status,
          tax_receipt_enabled
        )
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
    nonprofit_profiles: { organization_name: string; ein: string; verification_status: string; tax_receipt_enabled: boolean } | null;
  };
  const camp = donation.campaigns as unknown as CampaignJoin | null;

  if (!camp?.nonprofit_profiles?.tax_receipt_enabled) {
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
  const receiptNumber = `CHM-${(donation.id as string).slice(0, 8).toUpperCase()}`;
  const donationDate = new Date(donation.created_at as string).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  await sendTaxReceiptEmail({
    to: (profile as { email: string }).email,
    donorName: (profile as { full_name?: string }).full_name,
    nonprofitName: camp.nonprofit_profiles.organization_name,
    nonprofitEin: camp.nonprofit_profiles.ein,
    campaignTitle: camp.title,
    amountFormatted,
    receiptNumber,
    donationDate,
  });

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
