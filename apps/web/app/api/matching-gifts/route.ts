import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { estimateMatchForEmployer } from '../../../lib/matching-gifts';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  donationId: z.string().uuid(),
  employerName: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional(),
});

// GET /api/matching-gifts
// Returns the signed-in donor's matching-gift claims, newest first, with the
// campaign title for display.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: claims, error } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('id, donation_id, campaign_id, employer_name, donation_amount_cents, match_ratio, estimated_match_cents, status, employer_reference, note, created_at, updated_at')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campaignIds = [...new Set((claims ?? []).map((c) => c.campaign_id))];
  const titles: Record<string, { title: string; slug: string }> = {};
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug')
      .in('id', campaignIds);
    for (const c of campaigns ?? []) titles[c.id] = { title: c.title, slug: c.slug };
  }

  return NextResponse.json({
    claims: (claims ?? []).map((c) => ({ ...c, campaign: titles[c.campaign_id] ?? null })),
  });
}

// POST /api/matching-gifts { donationId, employerName, note? }
// Files a matching-gift claim for one of the donor's own completed donations.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { donationId, employerName, note } = parsed.data;

  // The donation must belong to the signed-in donor and be completed.
  const { data: donation, error: donationError } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, campaign_id, amount_cents, status')
    .eq('id', donationId)
    .maybeSingle();

  if (donationError) return NextResponse.json({ error: donationError.message }, { status: 500 });
  if (!donation) return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
  if (donation.donor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (donation.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed donations are eligible for a matching gift' }, { status: 409 });
  }

  // One claim per donation.
  const { data: existing } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('id, status')
    .eq('donation_id', donationId)
    .maybeSingle();
  if (existing && existing.status !== 'cancelled') {
    return NextResponse.json({ error: 'A matching-gift claim already exists for this donation', code: 'ALREADY_CLAIMED' }, { status: 409 });
  }

  const amountCents = Number(donation.amount_cents) || 0;
  const estimate = estimateMatchForEmployer(amountCents, employerName);

  const row = {
    donation_id: donationId,
    campaign_id: donation.campaign_id,
    donor_id: user.id,
    employer_name: employerName,
    donation_amount_cents: amountCents,
    match_ratio: estimate.ratio,
    estimated_match_cents: estimate.estimatedMatchCents,
    status: 'submitted' as const,
    note: note ?? null,
  };

  // Re-filing a previously cancelled claim replaces it (unique on donation_id).
  const { data: inserted, error: insertError } = existing
    ? await supabaseAdmin.from('matching_gift_claims').update(row).eq('id', existing.id).select().maybeSingle()
    : await supabaseAdmin.from('matching_gift_claims').insert(row).select().maybeSingle();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ claim: inserted, estimate: { matched: estimate.matched, ratio: estimate.ratio, estimatedMatchCents: estimate.estimatedMatchCents } }, { status: 201 });
}
