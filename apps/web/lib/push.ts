import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase';
import {
  isGoneStatus,
  isSendableSubscription,
  type PushPayload,
  type StoredSubscription,
} from './push-core';

/**
 * Web Push delivery.
 *
 * ⚠️ Every function here FAILS SOFT. Push is a courtesy channel layered on top of
 * flows that must not break: the donation webhook records money. A push service
 * being slow, a VAPID key being absent, or a table not existing must never turn
 * a successful donation into a failed webhook that Stripe then retries. So the
 * callers `void` these and nothing throws past this module.
 */

let configured: boolean | null = null;

/**
 * Configure VAPID once. Returns false when keys are absent, which is the normal
 * state in development and in CI — the feature is simply off, not broken.
 */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@charitme.com';
  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch {
    // A malformed key pair is a configuration error, not a runtime one. Log
    // nothing sensitive and stay off.
    configured = false;
  }
  return configured;
}

/** True when push can actually be delivered. Cheap; safe to call per request. */
export function pushConfigured(): boolean {
  return ensureConfigured();
}

/** Reset memoized config. Tests only. */
export function __resetPushConfigForTests(): void {
  configured = null;
}

interface SendResult {
  sent: number;
  expired: number;
  failed: number;
  /** No subscriptions, or push not configured — distinct from "tried and failed". */
  skipped: boolean;
}

/**
 * Deliver a payload to every live subscription a user has.
 *
 * Returns counts rather than throwing so callers can log a real outcome. A user
 * with three devices gets three sends; one dead device does not stop the others.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  const empty: SendResult = { sent: 0, expired: 0, failed: 0, skipped: true };
  if (!userId || !ensureConfigured()) return empty;

  let rows: StoredSubscription[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .is('expired_at', null)
      .limit(20);
    // 42P01 = table absent (migration not applied). Same handling as any other
    // failure: push is off, the caller carries on.
    if (error) return empty;
    rows = (data ?? []).filter(isSendableSubscription);
  } catch {
    return empty;
  }
  if (rows.length === 0) return empty;

  const body = JSON.stringify(payload);
  const result: SendResult = { sent: 0, expired: 0, failed: 0, skipped: false };
  const gone: string[] = [];

  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        body,
        { TTL: 3600 },
      );
      result.sent++;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode ?? 0;
      if (isGoneStatus(status)) {
        gone.push(row.endpoint);
        result.expired++;
      } else {
        // Transient (429/5xx/network). NOT expired — see isGoneStatus.
        result.failed++;
      }
    }
  }));

  if (gone.length > 0) {
    try {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ expired_at: new Date().toISOString() })
        .in('endpoint', gone);
    } catch {
      // Marking is an optimisation; the next send retries and re-marks.
    }
  }

  return result;
}
