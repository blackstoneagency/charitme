import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

// DELETE /api/team-members/[id]
// Remove a team member (only the campaign owner can do this).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Fetch the team_member to verify ownership
  const { data: member, error: fetchErr } = await supabaseAdmin
    .from('team_members')
    .select('id, campaign_id, user_id')
    .eq('id', id)
    .single();

  if (fetchErr || !member) {
    return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
  }

  // Verify the current user owns the campaign OR is removing themselves
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('user_id')
    .eq('id', (member as { campaign_id: string }).campaign_id)
    .single();

  const isOwner = (campaign as { user_id: string } | null)?.user_id === user.id;
  const isSelf = (member as { user_id: string }).user_id === user.id;

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: 'Forbidden: you must own the campaign to remove members.' }, { status: 403 });
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('team_members')
    .delete()
    .eq('id', id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH /api/team-members/[id]
// Update a team member's role (only the campaign owner can do this).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { role?: string } | null;
  if (!body?.role || !['admin', 'member', 'viewer'].includes(body.role)) {
    return NextResponse.json({ error: 'Valid role is required (admin, member, or viewer).' }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('campaign_id')
    .eq('id', id)
    .single();

  if (!member) return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('user_id')
    .eq('id', (member as { campaign_id: string }).campaign_id)
    .single();

  if ((campaign as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('team_members')
    .update({ role: body.role })
    .eq('id', id)
    .select('id, role')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, member: updated });
}
