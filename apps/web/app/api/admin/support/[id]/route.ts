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
  if (action === 'trigger_refund' && donationId) {
    await supabaseAdmin.from('refunds').upsert(
      {
        donation_id: donationId,
        reason: `Support case #${id}: admin-triggered refund`,
        status: 'approved',
        requested_by: adminId,
        reviewed_by: adminId,
        notes: note?.trim() ?? null,
      },
      { onConflict: 'donation_id' },
    );
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
