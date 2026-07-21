import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

const Schema = z.object({
  campaignId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(100_000_00),
  donorName: z.string().trim().min(1).max(120).optional(),
  donorEmail: z.string().email().optional(),
  method: z.enum(['cash', 'check', 'bank_transfer', 'other']).default('cash'),
  notes: z.string().max(500).optional(),
  donatedAt: z.string().optional(), // ISO date string
});

// POST /api/offline-donations
// Records an offline (cash/check) donation for a campaign the organiser owns.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { campaignId, amountCents, donorName, donorEmail, method, notes, donatedAt } = parsed.data;

  // Verify campaign ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Insert offline donation
  const { data: donation, error: insertErr } = await supabaseAdmin
    .from('donations')
    .insert({
      campaign_id: campaignId,
      donor_id: null, // offline — no user account
      amount_cents: amountCents,
      status: 'completed',
      anonymous: !donorName,
      message: notes ?? null,
      offline: true,
      offline_method: method,
      offline_donor_name: donorName ?? null,
      offline_donor_email: donorEmail ?? null,
      created_at: donatedAt ?? new Date().toISOString(),
    })
    .select('id, amount_cents, status, created_at')
    .single();

  if (insertErr) {
    console.error('offline donation insert', insertErr.message);
    return NextResponse.json({ error: 'Failed to record donation.' }, { status: 500 });
  }

  // Campaign raised_amount / backer_count are incremented by the AFTER INSERT
  // trigger donations_increment_campaign_stats (fires on the 'completed' insert
  // above). We MUST NOT also call record_donation here — that inserts a SECOND
  // donation row (without the offline metadata) and increments stats again.

  // Add to transparency ledger
  try {
    await supabaseAdmin
      .from('transparency_ledger_items')
      .insert({
        campaign_id: campaignId,
        item_type: 'offline_donation',
        title: `Offline donation (${method})${donorName ? ` from ${donorName}` : ''}`,
        amount_cents: amountCents,
        category: 'donation',
        status: 'received',
      });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, donation }, { status: 201 });
}

// GET /api/offline-donations?campaignId=...
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = request.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  // Verify ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, status, created_at, message, offline_method, offline_donor_name')
    .eq('campaign_id', campaignId)
    .eq('offline', true)
    .order('created_at', { ascending: false });

  return NextResponse.json({ donations: data ?? [] });
}
