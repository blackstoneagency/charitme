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

    // `count` is null on a query error, so `?? 0` silently reports "nothing to see".
    // Tracked so the response can say the number is partial rather than assert a
    // confident zero.
    let partial = Boolean(notifResult.error) || notifResult.count == null;
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
      // Both halves must be readable for the subtraction to mean anything. The two
      // failure modes go in OPPOSITE directions: if the replies count fails, every
      // donor message counts as unreplied and the badge is inflated; if the totals
      // count fails, it collapses to 0 and the badge disappears. Neither number is
      // worth showing, so a failure on either side leaves this at 0 and marks the
      // response partial.
      const totalCount = totalResult.error ? null : totalResult.count;
      const repliedCount = repliedResult.error ? null : repliedResult.count;
      if (totalCount == null || repliedCount == null) {
        partial = true;
      } else {
        unrepliedMessages = Math.max(0, totalCount - repliedCount);
      }
    }

    const total = unreadNotifications + unrepliedMessages;

    return NextResponse.json(
      // `partial` lets a caller distinguish "you have nothing" from "we could not
      // check". The badge itself stays hidden either way — a wrong number is worse
      // than none — but the distinction is available rather than thrown away.
      { count: total, notifications: unreadNotifications, messages: unrepliedMessages, partial },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch {
    return NextResponse.json({ count: 0, notifications: 0, messages: 0 });
  }
}
