import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

// GET /api/notifications/count
// Returns unread message count for the authenticated user's campaigns.
// "Unread" = donor_messages posted to your campaigns that you haven't replied to yet.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  try {
    // Get user's active campaign IDs
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused', 'completed']);

    const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);
    if (campaignIds.length === 0) return NextResponse.json({ count: 0 });

    // Count donor_messages that have NO corresponding owner reply
    // (i.e., messages the organizer hasn't responded to yet)
    const { count: totalMessages } = await supabaseAdmin
      .from('donor_messages')
      .select('id', { count: 'exact', head: true })
      .in('campaign_id', campaignIds);

    const { count: repliedMessages } = await supabaseAdmin
      .from('campaign_owner_replies')
      .select('id', { count: 'exact', head: true })
      .in('campaign_id', campaignIds);

    const unreplied = Math.max(0, (totalMessages ?? 0) - (repliedMessages ?? 0));

    return NextResponse.json({ count: unreplied }, {
      headers: { 'Cache-Control': 'private, max-age=30' }, // 30-second client cache
    });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
