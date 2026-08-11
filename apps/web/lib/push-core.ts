/**
 * Web push — the decisions, with no network and no `web-push` import.
 *
 * `lib/push.ts` is the thin server half that actually encrypts and sends. It is
 * untestable here (it needs a VAPID keypair and a live push service), so
 * everything that can be decided without a socket lives in this file and is
 * executed by `__tests__/web-push.test.ts`.
 */

/** What we send. Kept small on purpose — see `MAX_PAYLOAD_BYTES`. */
export interface PushPayload {
  title: string;
  body: string;
  /** Where a click lands. Same-origin path, never an absolute URL — see below. */
  url: string;
  tag?: string;
}

/**
 * The push protocol caps an encrypted payload at 4096 bytes, and the encryption
 * overhead is ~103 of them. Overshooting is rejected by the push service at send
 * time — i.e. the notification silently never arrives — so the payload is
 * truncated here instead, where the result is visible.
 */
export const MAX_PAYLOAD_BYTES = 3000;

/**
 * A push service endpoint is a capability URL. These are the only hosts we ever
 * hand a payload to; anything else in the column means the row did not come from
 * a real `PushSubscription` and must not be dialled.
 */
const ENDPOINT_HOSTS = [
  /\.googleapis\.com$/,          // Chrome / Edge / Android (FCM)
  /\.mozilla\.com$/,             // Firefox
  /\.push\.apple\.com$/,         // Safari / iOS
  /\.windows\.com$/,             // legacy Edge / WNS
  /\.microsoft\.com$/,
];

export function isSupportedEndpoint(endpoint: string): boolean {
  let url: URL;
  try { url = new URL(endpoint); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  return ENDPOINT_HOSTS.some((h) => h.test(url.hostname));
}

/**
 * Truncate to fit, on a character boundary, with the ellipsis inside the budget.
 * Measured in BYTES: a body of emoji or non-Latin script is several bytes per
 * character, and a length check in characters would pass a payload the push
 * service then drops.
 */
export function fitToPayloadBudget(payload: PushPayload): PushPayload {
  const encoder = new TextEncoder();
  const size = (p: PushPayload) => encoder.encode(JSON.stringify(p)).length;
  if (size(payload) <= MAX_PAYLOAD_BYTES) return payload;

  // Title and url are short and load-bearing; the body is what gets cut. Cut by
  // CODE POINT (`[...body]`, not `.slice`) so a multi-byte character is never
  // halved into a replacement glyph.
  const out = { ...payload };
  const chars = [...payload.body];
  for (let keep = chars.length; keep > 0; keep -= 16) {
    out.body = `${chars.slice(0, keep).join('').replace(/[\s.…]+$/, '')}…`;
    if (size(out) <= MAX_PAYLOAD_BYTES) return out;
  }
  out.body = '…';
  return out;
}

/**
 * A click target must be a same-origin PATH.
 *
 * The service worker resolves this against its own origin and calls
 * `clients.openWindow`. Letting an absolute URL through would turn any code that
 * can write a notification into an open redirect out of the installed app —
 * which on a phone looks exactly like the app itself navigating.
 */
export function safeClickPath(url: string, fallback = '/dashboard'): string {
  if (typeof url !== 'string' || !url.startsWith('/')) return fallback;
  // `//evil.com` and `/\evil.com` are protocol-relative: same first character,
  // different origin.
  if (/^\/[/\\]/.test(url)) return fallback;
  return url;
}

/**
 * Push services report a dead subscription with 404 or 410 — the device was
 * wiped, the app uninstalled, or permission revoked. Those rows must be deleted:
 * an endpoint that is gone stays gone, and retrying it forever is how a table of
 * subscriptions becomes mostly corpses.
 *
 * Everything else (a 429, a 500, a timeout) is transient and the row is kept.
 */
export function isGoneStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** Trim a UA string to something displayable without storing a fingerprint. */
export function shortUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return ua.slice(0, 180);
}

/**
 * Is push configured at all?
 *
 * Every optional integration in this app degrades rather than throwing
 * (`RESEND_API_KEY`, `OPENAI_API_KEY`, `UNSPLASH_ACCESS_KEY`), and push follows
 * the same rule: with no keypair the send is a no-op and the UI never offers the
 * toggle. A donation must never fail because a notification could not be sent.
 */
export function pushConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean((env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && env.VAPID_PRIVATE_KEY);
}

/**
 * The donation alert, built from the SAME redacted display name the in-app
 * notification and the organiser email already use.
 *
 * ⚠️ Takes `donorDisplayName`, never a profile. The webhook resolves that name
 * behind two gates — the per-gift `anonymous` flag and account-wide Profile
 * Visibility — and a new channel that re-derived it from `full_name` would
 * announce an anonymous donor by name on the organiser's lock screen, which is
 * the most public place this app can put a name.
 */
export function donationPushPayload(input: {
  donorDisplayName: string;
  amountFormatted: string;
  campaignTitle: string;
  campaignId: string;
}): PushPayload {
  return fitToPayloadBudget({
    title: `New donation: ${input.amountFormatted}`,
    body: `${input.donorDisplayName} donated ${input.amountFormatted} to "${input.campaignTitle}".`,
    url: '/dashboard/campaigns',
    // Collapses a burst on one campaign into a single visible notification
    // instead of a stack of them.
    tag: `donation-${input.campaignId}`,
  });
}
