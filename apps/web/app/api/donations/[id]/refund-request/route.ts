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
  // ⚠️ `.single()` reports ZERO ROWS AS AN ERROR, so `fetchErr` was set both when
  // the donation genuinely did not exist and when the read failed — and the
  // branch below collapsed the two into 404 "Donation not found". A donor trying
  // to request a refund during a database blip was told their donation does not
  // exist; the next thing they reach for is a chargeback.
  //
  // The read two blocks down ALREADY answers 503 for exactly this reason. Having
  // one guarded and the other not, inside a single handler, is what marks this as
  // an oversight rather than a decision.
  const { data: donation, error: fetchErr } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, status, created_at, campaign_id')
    .eq('id', donationId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: 'Could not load this donation right now. Please try again.', code: 'DONATION_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    );
  }
  if (!donation) {
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
  // Same shape as the GET below: several `refunds` rows per donation are normal,
  // so `maybeSingle()` alone would error on the multi-row case — and because the
  // error was discarded, the guard would fall open and let the duplicate through.
  // A guard that fails open is worse than no guard, so an unreadable check is an
  // error, not a pass. This mirrors the donor page, which refuses to submit
  // rather than risk a duplicate when it cannot verify eligibility.
  const { data: existingRequest, error: existingErr } = await supabaseAdmin
    .from('refunds')
    .select('id, status')
    .eq('donation_id', donationId)
    .in('status', ['requested', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json(
      { error: 'We could not verify your refund eligibility. Please try again.', code: 'REFUND_CHECK_UNAVAILABLE' },
      { status: 503 },
    );
  }

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
  // Same split as POST. A failed read must not read as "no such donation".
  const { data: donation, error: donationErr } = await supabaseAdmin
    .from('donations')
    .select('donor_id')
    .eq('id', donationId)
    .maybeSingle();

  if (donationErr) {
    return NextResponse.json(
      { error: 'Could not load this donation right now. Please try again.', code: 'DONATION_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    );
  }
  // A donation owned by someone else still answers 404 rather than 403 — this is
  // a read of a specific id, so 403 would confirm the donation exists.
  if (!donation || (donation as { donor_id: string | null }).donor_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // A donation can legitimately have SEVERAL `refunds` rows — a donor request
  // plus the admin's processed row, or two partial refunds. A bare `maybeSingle()`
  // errors on more than one match (PGRST116), and since the error was discarded
  // that surfaced as `refundRequest: null` — "you have no pending request" —
  // exactly when the donor most needs to see one. Take the newest instead.
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('refunds')
    .select('id, status, created_at')
    .eq('donation_id', donationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Never report "no request" because the lookup failed — the donor would file a
  // duplicate.
  if (existingErr) {
    return NextResponse.json(
      { error: 'Could not check refund status', code: 'REFUND_STATUS_UNAVAILABLE' },
      { status: 503 },
    );
  }

  return NextResponse.json({ refundRequest: existing ?? null });
}
