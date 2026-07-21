import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';

async function verifyAdmin(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const allowed = await isAdmin(user.id, user.email);
    if (!allowed) return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await verifyAdmin();
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing payout id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { action, note } = body as { action?: string; note?: string };

  const statusMap: Record<string, string> = {
    approve: 'approved',
    mark_paid: 'paid',
    reject: 'failed',
    cancel: 'cancelled',
  };

  if (!action || !statusMap[action]) {
    return NextResponse.json({ error: 'Invalid action. Use: approve, mark_paid, reject, cancel' }, { status: 400 });
  }

  const newStatus = statusMap[action];
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === 'paid') {
    updateData.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('payouts')
    .update(updateData)
    .eq('id', id)
    .select('id,status,amount_cents')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminId,
      action: `payout.${action}`,
      target_type: 'payout',
      target_id: id,
      metadata: { note, new_status: newStatus },
      created_at: new Date().toISOString(),
    });
  } catch { /* ignore audit log failures */ }

  return NextResponse.json({ payout: data });
}
