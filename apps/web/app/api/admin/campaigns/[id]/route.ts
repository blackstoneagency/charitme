import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

const allowedStatuses = new Set(['draft', 'active', 'paused', 'completed', 'rejected', 'frozen']);
const allowedTrustStatuses = new Set(['Needs More Info', 'Under Review', 'Verified', 'Flagged']);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of ['title', 'tagline', 'description', 'category']) {
    if (typeof body[key] === 'string') update[key] = String(body[key]).trim();
  }

  if (typeof body.status === 'string') {
    if (!allowedStatuses.has(body.status)) return NextResponse.json({ error: 'Invalid campaign status' }, { status: 400 });
    update.status = body.status;
  }

  if (typeof body.trust_status === 'string') {
    if (!allowedTrustStatuses.has(body.trust_status)) return NextResponse.json({ error: 'Invalid trust status' }, { status: 400 });
    update.trust_status = body.trust_status;
  }

  if (typeof body.payout_frozen === 'boolean') update.payout_frozen = body.payout_frozen;

  if (typeof body.campaign_health_score === 'number') {
    update.campaign_health_score = Math.max(0, Math.min(100, Math.round(body.campaign_health_score)));
  }

  if (typeof body.goal_amount === 'number') {
    update.goal_amount = Math.max(0, Math.round(body.goal_amount));
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No campaign fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(update)
    .eq('id', id)
    .select('id, title, status, trust_status, payout_frozen, campaign_health_score, goal_amount, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const auditPayload = {
    actor_id: admin.id,
    action: 'campaign.updated',
    target_type: 'campaign',
    target_id: id,
    metadata: update,
    created_at: new Date().toISOString(),
  };

  const { error: auditError } = await supabaseAdmin.from('audit_logs').insert(auditPayload);
  if (auditError && auditError.code !== '42P01') {
    return NextResponse.json({ ok: true, campaign: data, warning: auditError.message });
  }

  return NextResponse.json({ ok: true, campaign: data });
}
