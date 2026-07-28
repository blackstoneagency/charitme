import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'escalated'] as const;
const VALID_ACTIONS  = ['assign', 'status', 'note', 'freeze_campaign', 'trigger_refund', 'close_case'] as const;

const ActionSchema = z.object({
  action:     z.enum(VALID_ACTIONS),
  status:     z.enum(VALID_STATUSES).optional(),
  assigneeId: z.string().uuid().optional(),
  note:       z.string().max(2000).optional(),
  campaignId: z.string().uuid().optional(), // for freeze_campaign action
  donationId: z.string().uuid().optional(), // for trigger_refund action
});

async function verifyAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await isAdmin(user.id, user.email);
  return allowed ? user.id : null;
}

// ── PATCH /api/admin/support/[id] ─────────────────────────────────────────────
// Execute an action on a support case.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { action, status, assigneeId, note, campaignId, donationId } = parsed.data;

  // Verify case exists
  const { data: caseRow } = await supabaseAdmin
    .from('support_cases')
    .select('id, status, campaign_id')
    .eq('id', id)
    .single();
  if (!caseRow) return NextResponse.json({ error: 'Support case not found' }, { status: 404 });

  const caseUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === 'status' && status) {
    caseUpdates.status = status;
  }

  if (action === 'assign' && assigneeId) {
    caseUpdates.assigned_to = assigneeId;
    caseUpdates.status = 'in_progress';
  }

  if (action === 'close_case') {
    caseUpdates.status = 'closed';
    caseUpdates.resolved_at = new Date().toISOString();
  }

  if (status === 'escalated') {
    caseUpdates.status = 'escalated';
    caseUpdates.escalated_at = new Date().toISOString();
  }

  // Apply case updates
  if (Object.keys(caseUpdates).length > 1) {
    const { error: updateErr } = await supabaseAdmin
      .from('support_cases')
      .update(caseUpdates)
      .eq('id', id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Add internal note if provided
  if (note?.trim()) {
    await supabaseAdmin.from('support_notes').insert({
      case_id: id,
      author_id: adminId,
      body: note.trim(),
      internal: true,
    });
  }

  // Freeze campaign
  if (action === 'freeze_campaign') {
    const targetCampaignId = campaignId ?? caseRow.campaign_id;
    if (targetCampaignId) {
      await supabaseAdmin
        .from('campaigns')
        .update({ payout_frozen: true, updated_at: new Date().toISOString() })
        .eq('id', targetCampaignId);
    }
  }

  // Trigger refund (creates a refund request row for the admin refunds queue)
  //
  // This used to be an `upsert(..., { onConflict: 'donation_id' })`, which could
  // not work: `refunds` has no unique index on `donation_id` — correctly, since a
  // donation can have a donor request plus the admin's processed row, or two
  // partial refunds — so every call raised 42P10, "no unique or exclusion
  // constraint matching the ON CONFLICT specification". It also omitted
  // `amount_cents`, which is NOT NULL. Two independent guaranteed failures, both
  // swallowed because the result was discarded, and the handler still returned
  // `{ ok: true }`. The button reported success and did nothing, every time.
  if (action === 'trigger_refund' && donationId) {
    const { data: donationRow, error: donationErr } = await supabaseAdmin
      .from('donations')
      .select('id, amount_cents')
      .eq('id', donationId)
      .maybeSingle();

    if (donationErr || !donationRow) {
      return NextResponse.json(
        { error: 'Could not load the donation to refund.', code: 'DONATION_NOT_FOUND' },
        { status: donationErr ? 500 : 404 },
      );
    }

    // Reuse an already-queued request rather than stacking a second one; the
    // admin refunds queue lists by status, so duplicates would show as two jobs.
    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from('refunds')
      .select('id')
      .eq('donation_id', donationId)
      .in('status', ['requested', 'under_review', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingErr) {
      return NextResponse.json(
        { error: 'Could not check for an existing refund request.', code: 'REFUND_CHECK_FAILED' },
        { status: 500 },
      );
    }

    const refundFields = {
      reason: `Support case #${id}: admin-triggered refund`,
      status: 'approved',
      reviewed_by: adminId,
      notes: note?.trim() ?? null,
    };

    // Nothing irreversible has happened here — no money has moved, this only
    // queues the request — so a failure must surface rather than be logged and
    // swallowed. Silence is what hid this for as long as it did.
    const { error: refundErr } = pending
      ? await supabaseAdmin
          .from('refunds')
          .update({ ...refundFields, updated_at: new Date().toISOString() })
          .eq('id', (pending as { id: string }).id)
      : await supabaseAdmin.from('refunds').insert({
          ...refundFields,
          donation_id: donationId,
          amount_cents: (donationRow as { amount_cents: number }).amount_cents,
          requested_by: adminId,
        });

    if (refundErr) {
      return NextResponse.json(
        { error: 'The refund could not be queued.', code: 'REFUND_QUEUE_FAILED' },
        { status: 500 },
      );
    }
  }

  // Audit log
  void Promise.resolve(supabaseAdmin.from('audit_logs').insert({
    actor_id: adminId,
    action: `support_case.${action}`,
    target_type: 'support_case',
    target_id: id,
    metadata: { action, status, assigneeId, campaignId, donationId },
  }));

  return NextResponse.json({ ok: true, caseId: id, action });
}

// ── GET /api/admin/support/[id] ───────────────────────────────────────────────
// Fetch a single support case with its notes.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [{ data: caseRow }, { data: notes }] = await Promise.all([
    supabaseAdmin
      .from('support_cases')
      .select('*, profiles:submitter_id(full_name, email)')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('support_notes')
      .select('id, body, internal, created_at, profiles:author_id(full_name)')
      .eq('case_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ case: caseRow, notes: notes ?? [] });
}
