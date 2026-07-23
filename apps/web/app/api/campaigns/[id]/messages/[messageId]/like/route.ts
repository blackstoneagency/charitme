import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../../lib/supabase';
import { createClient } from '../../../../../../../lib/supabase-server';

// POST /api/campaigns/[id]/messages/[messageId]/like
// Toggles the current user's like on a donor wall comment.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId, messageId } = await params;

  const { data: message } = await supabaseAdmin
    .from('donor_messages')
    .select('id')
    .eq('id', messageId)
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (!message) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  const { data: existing } = await supabaseAdmin
    .from('donor_message_likes')
    .select('id')
    .eq('donor_message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from('donor_message_likes').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from('donor_message_likes')
      .insert({ donor_message_id: messageId, user_id: user.id });
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  const { count } = await supabaseAdmin
    .from('donor_message_likes')
    .select('id', { count: 'exact', head: true })
    .eq('donor_message_id', messageId);

  return NextResponse.json({ liked: !existing, count: count ?? 0 });
}
