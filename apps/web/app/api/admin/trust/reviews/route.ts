import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS = ['approved', 'rejected', 'flagged', 'held', 'released'] as const;

const CreateSchema = z.object({
  campaignId: z.string().uuid(),
  action:     z.enum(VALID_ACTIONS),
  notes:      z.string().max(2000).optional(),
});

async function verifyAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await isAdmin(user.id, user.email);
  return allowed ? user.id : null;
}

// ── GET /api/admin/trust/reviews ──────────────────────────────────────────────
// List reviews, optionally filtered by campaign_id or action.
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page       = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
  const campaignId = searchParams.get('campaign_id');
  const action     = searchParams.get('action');

  let query = supabaseAdmin
    .from('admin_reviews')
    .select(`
      id, campaign_id, reviewer_id, action, notes, created_at,
      campaigns:campaign_id (title, slug),
      profiles:reviewer_id (full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (action)     query = query.eq('action', action);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reviews: data ?? [], total: count ?? 0, page, limit });
}

// ── POST /api/admin/trust/reviews ─────────────────────────────────────────────
// Create a new admin review record and update campaign status accordingly.
export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { campaignId, action, notes } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('admin_reviews')
    .insert({
      campaign_id:  campaignId,
      reviewer_id:  adminId,
      action,
      notes: notes ?? null,
    })
    .select('id, campaign_id, action, notes, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Propagate action to campaign status where applicable
  const campaignStatusMap: Partial<Record<typeof action, string>> = {
    approved:  'active',
    rejected:  'frozen',
    held:      'paused',
    released:  'active',
  };
  const newStatus = campaignStatusMap[action];
  if (newStatus) {
    void Promise.resolve(
      supabaseAdmin
        .from('campaigns')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', campaignId),
    );
  }

  // Audit log
  void Promise.resolve(supabaseAdmin.from('audit_logs').insert({
    actor_id:    adminId,
    action:      `trust_review.${action}`,
    target_type: 'campaign',
    target_id:   campaignId,
    metadata:    { review_id: data.id, action, has_notes: !!notes },
  }));

  return NextResponse.json(data, { status: 201 });
}
