import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';
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

  // `isAdmin()` rather than a raw roles check: the raw check missed hardcoded
  // owner emails, ADMIN_EMAILS, and super admins who do not also hold `admin`.
  if (don.donor_id !== user.id && !(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (don.status !== 'completed') {
    return NextResponse.json({ error: 'Donation not completed' }, { status: 400 });
  }

  // The receipt goes to the DONOR. This previously loaded the profile of the
  // *requesting* user, so when an admin issued a receipt it was addressed to the
  // admin, with the admin's name on it, and the donor got nothing.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', don.donor_id ?? user.id)
    .maybeSingle();
  const camp = don.campaigns;

  if (!camp) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const donorEmail = (profile as { email?: string | null } | null)?.email ?? null;
  if (!donorEmail) {
    return NextResponse.json({ error: 'No donor email on file' }, { status: 422 });
  }

  const { sent } = await sendReceiptEmail({
    to: donorEmail,
    donorName: (profile as { full_name?: string | null } | null)?.full_name ?? null,
    campaignTitle: camp.title,
    campaignSlug: camp.slug,
    amountFormatted: formatCents(don.amount_cents, don.currency ?? 'usd'),
    donationId: don.id,
  });

  // Do not report success for an email that was never dispatched — the donor UI
  // renders a "✓ Sent" confirmation off this response.
  if (!sent) {
    return NextResponse.json(
      { error: 'Email could not be sent right now', code: 'EMAIL_UNAVAILABLE' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
