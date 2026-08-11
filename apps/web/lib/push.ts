import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase';
import {
  isGoneStatus,
  isSupportedEndpoint,
  pushConfigured,
  type PushPayload,
} from './push-core';

/**
 * The server half of web push: sign with VAPID, encrypt, deliver, and prune.
 *
 * The decisions live in `lib/push-core.ts` so they can be executed in tests;
 * this file is the part that needs a keypair and a socket.
 */

let configured: boolean | null = null;

/**
 * Configure lazily, ONCE, and never at module scope.
 *
 * `web-push` throws if `setVapidDetails` is called with a malformed key, and a
 * throw at module scope takes down every route that imports this file —
 * including the Stripe webhook, where a failure means Stripe retries a donation
 * that already succeeded. Push is optional; it must not be able to do that.
 */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  if (!pushConfigured(process.env)) { configured = false; return false; }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || `mailto:${process.env.SUPPORT_EMAIL || 'support@charitme.com'}`,
      (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  } catch (err) {
    console.error('[push] VAPID keys are present but invalid — push is disabled', err);
    configured = false;
  }
  return configured;
}

export interface PushSendResult {
  sent: number;
  /** Endpoints deleted because the push service reported them gone. */
  pruned: number;
  /** Transient failures. The rows are kept and will be tried again next time. */
  failed: number;
  /** True when no keypair is configured — nothing was attempted. */
  skipped: boolean;
}

/**
 * Push `payload` to every device belonging to `userId`.
 *
 * Never throws. Callers are notification paths hanging off money movements
 * (a Stripe webhook, a payout hook), and a failed notification must never turn
 * a completed donation into a retried one.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, pruned: 0, failed: 0, skipped: false };
  if (!ensureConfigured()) { result.skipped = true; return result; }

  try {
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .limit(20);

    if (!subs || subs.length === 0) return result;

    const body = JSON.stringify(payload);
    const gone: string[] = [];

    await Promise.all(subs.map(async (sub) => {
      // A row whose endpoint is not a real push service never came from a
      // browser. Dialling it would make this server an HTTP client pointed at an
      // attacker-chosen host — an SSRF with a signed request attached.
      if (!isSupportedEndpoint(sub.endpoint)) { gone.push(sub.id); return; }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 12 },
        );
        result.sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (isGoneStatus(statusCode)) gone.push(sub.id);
        else result.failed++;
      }
    }));

    if (gone.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('id', gone);
      result.pruned = gone.length;
    }
    if (result.sent > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId);
    }
  } catch (err) {
    console.error('[push] send failed', err);
  }
  return result;
}

/** Whether this deployment can offer push at all. Read by the settings UI. */
export function isPushConfigured(): boolean {
  return pushConfigured(process.env);
}
