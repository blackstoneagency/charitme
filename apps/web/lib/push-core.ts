import type { NotificationDraft } from './notify-core';

/**
 * Pure push logic — payload shape, subscription validation, and the rule for
 * when a failed delivery means "throw this subscription away".
 *
 * Kept free of `web-push` and of the database so it can be tested directly. The
 * decisions here are the ones that go wrong quietly:
 *   · pruning a subscription on a transient error unsubscribes people during an
 *     outage, and they never find out
 *   · a payload built from unvalidated input is a notification an attacker
 *     writes and CharitMe signs
 */

/** What the service worker receives. Deliberately small — see `PUSH_MAX_BYTES`. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  kind: string;
  tag: string;
}

/**
 * Web Push caps an encrypted payload at ~4KB. Browsers drop an oversized message
 * silently rather than erroring, so it is truncated here instead — a short
 * notification beats one nobody receives.
 */
export const PUSH_MAX_BYTES = 3500;

const MAX_TITLE = 80;
const MAX_BODY = 180;

function clamp(value: string, max: number): string {
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Build the payload from the same draft the in-app notification uses, so the two
 * cannot say different things about one event.
 */
export function buildPushPayload(draft: NotificationDraft): PushPayload {
  return {
    title: clamp(draft.title, MAX_TITLE),
    body: clamp(draft.body ?? '', MAX_BODY),
    // A notification that opens nothing is a dead end on the lock screen.
    url: draft.link || '/dashboard/notifications',
    kind: draft.kind,
    // Collapses repeats: five gifts in a minute replace one another rather than
    // stacking five banners.
    tag: `charitme-${draft.kind}`,
  };
}

export function serialisePayload(payload: PushPayload): string {
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, 'utf8') <= PUSH_MAX_BYTES) return json;
  // Body is the only field worth sacrificing; title and url carry the meaning.
  const trimmed = { ...payload, body: clamp(payload.body, 60) };
  return JSON.stringify(trimmed);
}

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * The hosts that actually operate push services.
 *
 * Matched on the FULL hostname or a dot-suffix, never `includes` — otherwise
 * `fcm.googleapis.com.attacker.example` passes. Extend this list if a browser
 * vendor adds a service; a subscription refused here is a device that silently
 * never receives anything, so a missing entry shows up as "push does not work
 * on <browser>" rather than as an error.
 */
const PUSH_SERVICE_SUFFIXES = [
  '.googleapis.com',   // Chrome, Edge, Android (FCM)
  '.mozilla.com',      // Firefox (updates.push.services.mozilla.com)
  '.push.apple.com',   // Safari, iOS home-screen apps
  '.windows.com',      // legacy Edge (WNS)
  '.microsoft.com',
];

export function isKnownPushService(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * A notification click target must be a same-origin PATH.
 *
 * The service worker hands this to `client.navigate()` / `openWindow()`, which
 * resolve it against the app's origin — so an absolute or protocol-relative URL
 * would navigate the INSTALLED APP to an arbitrary site, which on a phone is
 * indistinguishable from the app going there itself.
 *
 * Not reachable today: every `link` comes from internal `notify()` callers. It
 * is defence in depth for the first notification whose link is user-influenced
 * (a campaign URL, a custom domain), and the worker enforces it independently
 * because a service worker outlives the deploy that installed it.
 */
export function safeClickPath(url: unknown, fallback = '/dashboard/notifications'): string {
  if (typeof url !== 'string' || !url.startsWith('/')) return fallback;
  // `//evil.example` and `/\evil.example` share the first character with a safe
  // path and resolve to a different origin.
  if (/^\/[/\\]/.test(url)) return fallback;
  return url;
}

/**
 * Is this a subscription we can actually store?
 *
 * ⚠️ The endpoint must be HTTPS. A push endpoint is a URL this server will POST
 * to on a schedule an attacker partly controls, so an unvalidated one turns the
 * send path into a request forger — `http://localhost:…` or an internal address
 * would be reached from inside the network.
 */
export function isValidWebPushSubscription(value: unknown): value is WebPushSubscription {
  if (!value || typeof value !== 'object') return false;
  const sub = value as Record<string, unknown>;
  if (typeof sub.endpoint !== 'string') return false;

  let url: URL;
  try {
    url = new URL(sub.endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  // Blocks the obvious SSRF targets. Not exhaustive on its own — the send path
  // is service-role and outbound — but there is no reason a real push service
  // is ever a loopback or link-local address.
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|::1$|\[::1\])/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (sub.endpoint.length > 1000) return false;
  // …and then the allowlist, which is what actually closes it. The checks above
  // are a denylist, and their own comment says they are not exhaustive: they
  // pass ANY public host. A signed-in user could register
  // `https://attacker.example/collect` and have this server POST a
  // VAPID-signed, encrypted payload there on every notification thereafter.
  // Private-range denial does not help, because the target is public.
  if (!isKnownPushService(host)) return false;

  const keys = sub.keys as Record<string, unknown> | undefined;
  if (!keys || typeof keys !== 'object') return false;
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return false;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return false;
  return true;
}

/**
 * Should a delivery failure remove the subscription?
 *
 * ⚠️ ONLY on a definitive rejection. 404 and 410 mean the push service has
 * dropped the endpoint — it will never work again. Everything else (429, 500,
 * timeouts) is the push service having a bad day, and deleting on those would
 * silently unsubscribe every user during an outage, with no way for them to know
 * they had stopped receiving anything.
 */
export function isGoneForever(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** Push is off unless BOTH VAPID keys are configured. */
export function pushConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY?.trim() && env.VAPID_PRIVATE_KEY?.trim());
}
