import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase';
import type { NotificationDraft } from './notify-core';
import {
  buildPushPayload,
  serialisePayload,
  isGoneForever,
  pushConfigured,
} from './push-core';

/**
 * Delivery. Called from `notify()`, so every in-app notification the platform
 * already sends becomes a push for anyone who opted in — one integration point
 * rather than a push call bolted onto each of the fifteen routes that notify.
 *
 * ⚠️ Never throws and never blocks. A push failure must not roll back a
 * donation, and the caller is usually a Stripe webhook whose retry semantics
 * depend on what it returns.
 */

let configured = false;

function ensureConfigured(): boolean {
  if (!pushConfigured()) return false;
  if (configured) return true;
  webpush.setVapidDetails(
    // A contact the push service can reach about abuse; the spec requires
    // mailto: or an https URL.
    process.env.VAPID_SUBJECT?.trim() || 'mailto:support@charitme.com',
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
  return true;
}

interface SubscriptionRow {
  id: string;
  platform: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
}

/**
 * Push a notification to every device a user has registered.
 *
 * Returns the number delivered — `0` is a real answer (no devices, or push not
 * configured), and the caller ignores it. It exists for tests.
 */
export async function pushToUser(userId: string, draft: NotificationDraft): Promise<number> {
  if (!ensureConfigured()) return 0;

  try {
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, platform, endpoint, p256dh, auth')
      .eq('user_id', userId)
      // Bounded: a user with a runaway number of stale devices must not turn one
      // notification into hundreds of outbound requests.
      .limit(20);
    if (error || !data || data.length === 0) return 0;

    const payload = serialisePayload(buildPushPayload(draft));
    const rows = data as SubscriptionRow[];
    const dead: string[] = [];
    let sent = 0;

    await Promise.all(
      rows.map(async (row) => {
        // ⚠️ Native tokens are stored in the same table but cannot be delivered
        // by web-push — they need APNs/FCM. Skipped rather than attempted, so a
        // future iOS build does not silently look "delivered".
        if (row.platform !== 'web' || !row.endpoint || !row.p256dh || !row.auth) return;
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            payload,
            { TTL: 60 * 60 * 12 },
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // Only a definitive rejection prunes. See `isGoneForever` — deleting
          // on a 500 would unsubscribe everyone during a push-service outage.
          if (isGoneForever(status)) dead.push(row.id);
        }
      }),
    );

    if (dead.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', dead);
    }
    if (sent > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId);
    }
    return sent;
  } catch {
    // `supabaseAdmin` throws on property access when the env is missing, before
    // any query runs — which no `error` check can see.
    return 0;
  }
}
