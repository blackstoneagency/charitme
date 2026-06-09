import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/notifications/count
// Returns the combined unread count: unread in-app notifications + unreplied donor messages.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0, notifications: 0, messages: 0 });

  try {
    const [notifResult, campaignsResult] = await Promise.all([
      // Unread in-app notifications
      supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),

      // Get user's active campaign IDs for message counts
      supabaseAdmin
        .from('campaigns')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'paused', 'completed']),
    ]);

    const unreadNotifications = notifResult.count ?? 0;
    const campaignIds = (campaignsResult.data ?? []).map((c: { id: string }) => c.id);

    let unrepliedMessages = 0;
    if (campaignIds.length > 0) {
      const [totalResult, repliedResult] = await Promise.all([
        supabaseAdmin
          .from('donor_messages')
          .select('id', { count: 'exact', head: true })
          .in('campaign_id', campaignIds),
        supabaseAdmin
          .from('campaign_owner_replies')
          .select('id', { count: 'exact', head: true })
          .in('campaign_id', campaignIds),
      ]);
      unrepliedMessages = Math.max(0, (totalResult.count ?? 0) - (repliedResult.count ?? 0));
    }

    const total = unreadNotifications + unrepliedMessages;

    return NextResponse.json(
      { count: total, notifications: unreadNotifications, messages: unrepliedMessages },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch {
    return NextResponse.json({ count: 0, notifications: 0, messages: 0 });
  }
}
