/**
 * Pure Web Push helpers — no network, no database, no `web-push` import.
 *
 * Split out so the parts that decide WHAT gets sent can be tested directly. The
 * impure half (VAPID signing, HTTP to the push service) lives in `lib/push.ts`
 * and is thin on purpose.
 */

/** The shape the service worker's `push` handler expects. */
export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin path to open on click. Never an absolute URL — see below. */
  url: string;
  /** Groups notifications so a burst of donations collapses into one. */
  tag?: string;
}

/** A stored subscription, as the send path reads it. */
export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Is this a subscription we can actually encrypt a payload for?
 *
 * All three fields are required by RFC 8291. A row missing `p256dh` or `auth`
 * cannot be sent to at all — and the failure mode if you try is an opaque 400
 * from the push service, so it is worth refusing early and visibly.
 */
export function isSendableSubscription(value: unknown): value is StoredSubscription {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint)
    && typeof s.p256dh === 'string' && s.p256dh.length > 0
    && typeof s.auth === 'string' && s.auth.length > 0
  );
}

/**
 * Constrain the click-through target to a same-origin PATH.
 *
 * ⚠️ This is a security boundary, not tidiness. A notification is rendered by
 * the OS with the site's name and icon on it; if the payload could carry an
 * absolute URL, anyone who could influence a notification could show a
 * CharitMe-branded prompt that opens somebody else's site. The service worker
 * also resolves this against its own origin, so the two agree.
 *
 * Returns `/` for anything that is not a plain same-origin path.
 */
export function safeNotificationPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  // Reject scheme-relative (`//evil.com`) and absolute URLs outright.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  // A backslash is treated as a slash by some URL parsers — `/\evil.com`.
  if (raw.includes('\\')) return '/';
  return raw;
}

/** Clamp text so a long campaign title cannot push the amount off the banner. */
export function clampNotificationText(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * The donation alert an organiser receives.
 *
 * Deliberately does NOT name the donor. A notification renders on a lock screen
 * — in front of whoever is holding the phone — and an anonymous donation must
 * stay anonymous there too. The amount and the campaign are the useful parts,
 * and both are the organiser's own data.
 */
export function buildDonationPush(input: {
  amountCents: number;
  campaignTitle: string;
  campaignSlug: string;
  currency?: string;
}): PushPayload {
  const amount = formatAmount(input.amountCents, input.currency);
  return {
    title: `${amount} donation received`,
    body: clampNotificationText(input.campaignTitle, 80),
    // Per-campaign tag: ten donations to one campaign collapse into one
    // notification instead of ten buzzes, while two campaigns stay distinct.
    tag: `donation-${input.campaignSlug}`,
    url: safeNotificationPath(`/campaigns/${input.campaignSlug}`),
  };
}

/** Whole units when exact, cents otherwise — "$25" reads better than "$25.00". */
export function formatAmount(cents: number, currency = 'USD'): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  const whole = safe % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(safe / 100);
}

/**
 * Does a push-service response mean "this subscription is gone for good"?
 *
 * 404/410 are the standard tombstones. Everything else — including 429 and 5xx —
 * is transient and must NOT expire the row, or one bad afternoon at a push
 * service silently unsubscribes the entire user base.
 */
export function isGoneStatus(status: number): boolean {
  return status === 404 || status === 410;
}
