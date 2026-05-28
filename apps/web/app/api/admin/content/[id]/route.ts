import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';

// PATCH /api/admin/content/[id]
// Body: { title?, body? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    title?: string;
    body?: string;
  } | null;

  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') update.title = body.title.trim() || null;
  if (typeof body.body === 'string' && body.body.trim()) update.body = body.body.trim();

  const { error } = await supabaseAdmin
    .from('campaign_updates')
    .update(update)
    .eq('id', id);

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Content not found.' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'content.updated',
      target_type: 'campaign_update',
      target_id: id,
      metadata: { changes: Object.keys(update).filter(k => k !== 'updated_at') },
      created_at: new Date().toISOString(),
    });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/content/[id]
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('campaign_updates')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'content.deleted',
      target_type: 'campaign_update',
      target_id: id,
      metadata: {},
      created_at: new Date().toISOString(),
    });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
