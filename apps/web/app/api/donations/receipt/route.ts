import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { sendReceiptEmail } from '../../../../lib/email';
import { formatCents } from '../../../../lib/stripe';

const Schema = z.object({ donationId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'donationId required' }, { status: 400 });

  // Load donation — donor must own it or be admin
  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, currency, campaign_id, status, campaigns:campaign_id(title, slug)')
    .eq('id', parsed.data.donationId)
    .single();

  if (!donation) return NextResponse.json({ error: 'Donation not found' }, { status: 404 });

  type DonRow = { id: string; donor_id: string | null; amount_cents: number; currency: string | null; campaign_id: string; status: string; campaigns: { title: string; slug: string } | null };
  const don = donation as unknown as DonRow;

  if (don.donor_id !== user.id) {
    // Check admin
    const { data: profile } = await supabaseAdmin.from('profiles').select('roles').eq('id', user.id).single();
    const roles: string[] = Array.isArray((profile as { roles?: unknown })?.roles) ? (profile as { roles: string[] }).roles : [];
    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (don.status !== 'completed') {
    return NextResponse.json({ error: 'Donation not completed' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', user.id).single();
  const camp = don.campaigns;

  if (!profile?.email || !camp) {
    return NextResponse.json({ error: 'Profile or campaign not found' }, { status: 404 });
  }

  await sendReceiptEmail({
    to: profile.email,
    donorName: profile.full_name,
    campaignTitle: camp.title,
    campaignSlug: camp.slug,
    amountFormatted: formatCents(don.amount_cents, don.currency ?? 'usd'),
    donationId: don.id,
  });

  return NextResponse.json({ ok: true });
}
