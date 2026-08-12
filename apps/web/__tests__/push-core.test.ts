import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPushPayload,
  safeNotificationPath,
  serialisePayload,
  isValidWebPushSubscription,
  isGoneForever,
  pushConfigured,
  PUSH_MAX_BYTES,
} from '../lib/push-core';

// ─────────────────────────────────────────────────────────────────────────────
// Push exists to answer App Store Guideline 4.2 — a Capacitor shell pointed at
// a URL is "a repackaged website" unless it does something the web cannot, and
// donation alerts are the one capability organisers actually want.
//
// The three decisions worth pinning are all ones that fail QUIETLY:
//
//  · pruning a subscription on a transient error unsubscribes everybody during
//    a push-service outage, and nobody finds out they stopped receiving alerts
//  · an unvalidated endpoint makes the send path a request forger — it is a URL
//    this server POSTs to, supplied by a client
//  · an oversized payload is dropped by the browser with no error at all
// ─────────────────────────────────────────────────────────────────────────────

const draft = { kind: 'donation', title: 'You received a gift', body: '$50 from Ada', link: '/dashboard' };

describe('payload', () => {
  it('carries the notification through unchanged when it is short', () => {
    const payload = buildPushPayload(draft);
    expect(payload.title).toBe('You received a gift');
    expect(payload.body).toBe('$50 from Ada');
    expect(payload.url).toBe('/dashboard');
  });

  it('always has somewhere to open', () => {
    // A notification that opens nothing is a dead end on the lock screen.
    const payload = buildPushPayload({ ...draft, link: '' });
    expect(payload.url).toBeTruthy();
  });

  it('collapses repeats of one kind onto a single tag', () => {
    // Five gifts in a minute should replace one another, not stack five banners.
    expect(buildPushPayload(draft).tag).toBe(buildPushPayload({ ...draft, body: 'other' }).tag);
  });

  it('truncates rather than letting the browser drop the message', () => {
    const long = { ...draft, body: 'x'.repeat(5000) };
    const json = serialisePayload(buildPushPayload(long));
    expect(Buffer.byteLength(json, 'utf8')).toBeLessThanOrEqual(PUSH_MAX_BYTES);
    // The title survives — it is what the notification means.
    expect(JSON.parse(json).title).toBe('You received a gift');
  });
});

describe('subscription validation', () => {
  const valid = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: { p256dh: 'BEl62iUYgUiv', auth: 'k8JV6sjd' },
  };

  it('accepts a real one', () => {
    expect(isValidWebPushSubscription(valid)).toBe(true);
  });

  it('rejects endpoints that would make this server a request forger', () => {
    // ⚠️ The endpoint is a URL supplied by a client that the server then POSTs
    // to. Loopback and private ranges reach inside the network.
    for (const endpoint of [
      'http://fcm.googleapis.com/x',
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://10.0.0.5/x',
      'https://192.168.1.1/x',
      'https://169.254.169.254/latest/meta-data',
      'https://172.16.0.1/x',
      'not-a-url',
    ]) {
      expect(isValidWebPushSubscription({ ...valid, endpoint }), endpoint).toBe(false);
    }
  });

  it('rejects a subscription missing its encryption keys', () => {
    expect(isValidWebPushSubscription({ endpoint: valid.endpoint })).toBe(false);
    expect(isValidWebPushSubscription({ ...valid, keys: { p256dh: 'x' } })).toBe(false);
  });

  it('rejects absurd lengths rather than storing them', () => {
    expect(isValidWebPushSubscription({ ...valid, endpoint: `https://a.com/${'x'.repeat(2000)}` })).toBe(false);
    expect(isValidWebPushSubscription({ ...valid, keys: { ...valid.keys, p256dh: 'x'.repeat(500) } })).toBe(false);
  });

  it('rejects nothing at all', () => {
    for (const value of [null, undefined, 'string', 42, []]) {
      expect(isValidWebPushSubscription(value)).toBe(false);
    }
  });
});

describe('when to throw a subscription away', () => {
  it('prunes only on a definitive rejection', () => {
    expect(isGoneForever(404)).toBe(true);
    expect(isGoneForever(410)).toBe(true);
  });

  it('KEEPS the subscription on a transient failure', () => {
    // ⚠️ The one that matters. Deleting on a 500 or a 429 unsubscribes every
    // user during a push-service outage, and the only symptom is that alerts
    // quietly stop arriving forever.
    for (const status of [undefined, 0, 429, 500, 502, 503, 504]) {
      expect(isGoneForever(status), `status ${status} must not prune`).toBe(false);
    }
  });
});

describe('configuration gate', () => {
  it('needs BOTH keys', () => {
    expect(pushConfigured({})).toBe(false);
    expect(pushConfigured({ VAPID_PUBLIC_KEY: 'a' })).toBe(false);
    expect(pushConfigured({ VAPID_PRIVATE_KEY: 'b' })).toBe(false);
    expect(pushConfigured({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b' })).toBe(true);
  });

  it('treats whitespace as unset', () => {
    expect(pushConfigured({ VAPID_PUBLIC_KEY: '  ', VAPID_PRIVATE_KEY: '  ' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The click target must be a same-origin PATH.
//
// Added after two agents built push concurrently: this implementation won (it is
// integrated with notify-core, caps the payload, and validates the endpoint
// against SSRF), but its click target was unconstrained. Its same-origin check
// is on `client.url` — WHICH WINDOW to focus — and does not constrain WHERE that
// window is then sent. A notification wears CharitMe's name and icon, so an
// absolute `draft.link` would open somebody else's site from a CharitMe banner.
// ─────────────────────────────────────────────────────────────────────────────
describe('a notification can only ever open this site', () => {
  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '',
  ])('rejects %s', (input) => {
    expect(safeNotificationPath(input)).toBe('/dashboard/notifications');
  });

  it.each([null, undefined, 42, {}])('rejects the non-string %s', (input) => {
    expect(safeNotificationPath(input as unknown)).toBe('/dashboard/notifications');
  });

  it('keeps an ordinary same-origin path', () => {
    expect(safeNotificationPath('/campaigns/help-sarah')).toBe('/campaigns/help-sarah');
  });

  it('is applied by buildPushPayload, not merely exported', () => {
    const payload = buildPushPayload({
      kind: 'donation_received',
      title: 'A donation',
      body: 'x',
      link: 'https://evil.example/phish',
    } as Parameters<typeof buildPushPayload>[0]);
    expect(payload.url).toBe('/dashboard/notifications');
  });

  it('the service worker enforces the SAME rule', () => {
    // Both halves, because a payload arriving encrypted proves it came from us —
    // not that a future sender bug cannot put an absolute URL in it.
    const sw = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sw.js'),
      'utf8',
    );
    // ⚠️ Asserts the RULE, not one spelling of it. Two sessions fixed this
    // independently — an inline check on master, and `swSafeClickPath` on the
    // branch that merged — and pinning the inline form made the better
    // implementation fail a test that agreed with it. The helper is applied at
    // BOTH the notification-creation point and the click handler; the inline
    // version covered only the click.
    expect(sw).toMatch(/function swSafeClickPath/);
    expect(sw).toMatch(/startsWith\('\/'\)/);
    expect((sw.match(/swSafeClickPath\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
