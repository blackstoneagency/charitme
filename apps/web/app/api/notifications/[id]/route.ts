import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

// PATCH /api/notifications/[id]
// Mark a single notification as read (or unread).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership — user can only update their own notifications
  const { data: notif } = await supabaseAdmin
    .from('notifications')
    .select('id, user_id, read_at')
    .eq('id', id)
    .single();

  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ((notif as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { read?: boolean };
  const markRead = body.read !== false; // default to marking as read

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: markRead ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id, read_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notification: data });
}

// DELETE /api/notifications/[id]
// Delete a single notification.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: notif } = await supabaseAdmin
    .from('notifications')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ((notif as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('notifications').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
