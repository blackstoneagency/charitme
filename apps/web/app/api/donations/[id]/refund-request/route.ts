import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

// ── Validation ──────────────────────────────────────────────────────────────
const RequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters.')
    .max(1000, 'Reason must be 1000 characters or fewer.'),
});

// ── POST /api/donations/[id]/refund-request ──────────────────────────────────
// Creates a refund_request record in the `refunds` table.
// Only the donor who made the donation may submit; admins process via admin console.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Input ──────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }
  const { reason } = parsed.data;

  const { id: donationId } = await params;

  // ── 3. Fetch donation — must belong to the requesting donor ──────────────
  const { data: donation, error: fetchErr } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, status, created_at, campaign_id')
    .eq('id', donationId)
    .single();

  if (fetchErr || !donation) {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
  }

  type DonationRow = {
    id: string;
    donor_id: string | null;
    amount_cents: number;
    status: string;
    created_at: string;
    campaign_id: string;
  };
  const don = donation as DonationRow;

  // Ownership check — only the donor who made the donation may request a refund
  if (don.donor_id !== user.id) {
    return NextResponse.json(
      { error: 'You can only request refunds for your own donations' },
      { status: 403 },
    );
  }

  // ── 4. Business rules ─────────────────────────────────────────────────────
  if (don.status !== 'completed') {
    return NextResponse.json(
      {
        error:
          don.status === 'refunded'
            ? 'This donation has already been refunded.'
            : `Cannot request a refund for a donation with status "${don.status}".`,
      },
      { status: 400 },
    );
  }

  // No refund requests older than 60 days (configurable)
  const MAX_AGE_DAYS = 60;
  const donationAgeMs = Date.now() - new Date(don.created_at).getTime();
  const donationAgeDays = donationAgeMs / (1000 * 60 * 60 * 24);
  if (donationAgeDays > MAX_AGE_DAYS) {
    return NextResponse.json(
      {
        error: `Refund requests must be submitted within ${MAX_AGE_DAYS} days of the donation.`,
      },
      { status: 400 },
    );
  }

  // ── 5. Duplicate guard — block a second pending request ──────────────────
  const { data: existingRequest } = await supabaseAdmin
    .from('refunds')
    .select('id, status')
    .eq('donation_id', donationId)
    .in('status', ['requested', 'approved'])
    .maybeSingle();

  if (existingRequest) {
    return NextResponse.json(
      { error: 'A refund request for this donation is already pending.' },
      { status: 409 },
    );
  }

  // ── 6. Create refund request ──────────────────────────────────────────────
  const { data: refundRow, error: insertErr } = await supabaseAdmin
    .from('refunds')
    .insert({
      donation_id: donationId,
      amount_cents: don.amount_cents, // full amount — admin can adjust
      reason,
      notes: reason, // keep notes in sync; admin may edit later
      requested_by: user.id,
      status: 'requested',
    })
    .select('id, donation_id, amount_cents, status, created_at')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, refundRequest: refundRow }, { status: 201 });
}

// ── GET /api/donations/[id]/refund-request ───────────────────────────────────
// Returns whether a pending refund request exists for this donation+user.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: donationId } = await params;

  // Verify ownership
  const { data: donation } = await supabaseAdmin
    .from('donations')
    .select('donor_id')
    .eq('id', donationId)
    .single();

  if (!donation || (donation as { donor_id: string | null }).donor_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from('refunds')
    .select('id, status, created_at')
    .eq('donation_id', donationId)
    .maybeSingle();

  return NextResponse.json({ refundRequest: existing ?? null });
}
