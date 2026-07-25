import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['requested', 'under_review', 'approved', 'declined', 'processing', 'processed', 'failed', 'canceled'] as const;

const UpdateSchema = z.object({
  status:       z.enum(VALID_STATUSES).optional(),
  notes:        z.string().max(2000).optional(),
  reviewedBy:   z.string().uuid().optional(),
});

async function verifyAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await isAdmin(user.id, user.email);
  return allowed ? user.id : null;
}

// ── GET /api/admin/refunds ────────────────────────────────────────────────────
// List refunds with filtering by status, campaign, or donation.
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page    = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const limit   = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
  const status  = searchParams.get('status');
  const campaignId = searchParams.get('campaign_id');

  let query = supabaseAdmin
    .from('refunds')
    .select(`
      id, donation_id, amount_cents, reason, notes, status,
      requested_by, reviewed_by, created_at, updated_at,
      donations:donation_id (
        campaign_id, amount_cents,
        campaigns:campaign_id (title, slug),
        profiles:donor_id (full_name, email)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (status) query = query.eq('status', status);
  if (campaignId) {
    query = query.eq('donations.campaign_id', campaignId);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ refunds: data ?? [], total: count ?? 0, page, limit });
}

// ── PATCH /api/admin/refunds — bulk or single update ─────────────────────────
// Body: { id: string } to target one; or { ids: string[] } for bulk.
export async function PATCH(request: NextRequest) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
  if (ids.length === 0) return NextResponse.json({ error: 'No refund IDs provided' }, { status: 400 });

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status    !== undefined) updates.status      = parsed.data.status;
  if (parsed.data.notes     !== undefined) updates.notes       = parsed.data.notes;
  if (parsed.data.reviewedBy !== undefined) updates.reviewed_by = parsed.data.reviewedBy;

  const { data, error } = await supabaseAdmin
    .from('refunds')
    .update(updates)
    .in('id', ids)
    .select('id, status, notes, updated_at');

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  // Audit log for each status change
  if (parsed.data.status) {
    const logRows = ids.map(id => ({
      actor_id: adminId,
      action: `refund.${parsed.data.status}`,
      target_type: 'refund',
      target_id: id,
      metadata: { new_status: parsed.data.status, bulk: ids.length > 1 },
    }));
    void Promise.resolve(supabaseAdmin.from('audit_logs').insert(logRows));
  }

  return NextResponse.json({ ok: true, updated: data ?? [] });
}
