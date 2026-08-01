import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Outbound webhook endpoints — secret handling and the event catalogue.
 *
 * `outbound_webhook_endpoints` has shipped since 20260525002000 and, like
 * `donation_forms`, had no reader and no writer: its only mention was a row
 * count on /admin/system.
 *
 * ⚠️ THE PLAINTEXT SIGNING SECRET IS NEVER STORED. The column is `secret_hash`,
 * and only the SHA-256 hash goes to the database — same rule as `api_keys`, and
 * for the same reason: a database leak containing live signing secrets lets an
 * attacker forge events that a subscriber's server will trust.
 */

const SECRET_PREFIX = 'whsec_';

export function generateWebhookSecret(): { secret: string; hash: string } {
  const secret = SECRET_PREFIX + randomBytes(32).toString('base64url');
  return { secret, hash: hashWebhookSecret(secret) };
}

export function hashWebhookSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * The events an endpoint may subscribe to.
 *
 * Deliberately a closed list. A free-text field would let someone subscribe to
 * `donation.creted` and wait forever for a delivery that is never attempted,
 * with nothing to tell them why.
 */
export const WEBHOOK_EVENTS = [
  'donation.created',
  'donation.refunded',
  'campaign.published',
  'campaign.goal_reached',
  'payout.paid',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

/**
 * Only https, and no private/loopback hosts.
 *
 * The server fetches whatever URL is stored here, so an unvalidated value makes
 * this a server-side request forgery primitive: `http://169.254.169.254/…` is
 * the cloud metadata endpoint, and `http://localhost:…` reaches services that
 * trust the network they are on. Blocking them at write time is the cheap half;
 * the dispatcher must re-check at send time, because DNS can be repointed after
 * the row is saved.
 */
export function validateWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'That is not a valid URL.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Webhook URLs must use https.' };
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) {
    return { ok: false, reason: 'That host is not reachable from the internet.' };
  }
  return { ok: true, url: parsed.toString() };
}
