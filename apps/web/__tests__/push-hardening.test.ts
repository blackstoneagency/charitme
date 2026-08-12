import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isKnownPushService, isValidWebPushSubscription, safeClickPath } from '../lib/push-core';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const sw = read('public/sw.js');

/**
 * Two guards added on top of the web-push implementation that landed on master,
 * both closing gaps its own comments flag as open.
 *
 * They are separate from `push-core.test.ts` and `push-delivery.test.ts` on
 * purpose: those belong to the implementation's author, and a second agent
 * editing them mid-flight is how two sessions clobber each other.
 */

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: 'x'.repeat(87), auth: 'y'.repeat(22) } });

describe('an endpoint must belong to a real push service, not merely a public host', () => {
  it('accepts the vendors', () => {
    expect(isValidWebPushSubscription(sub('https://fcm.googleapis.com/fcm/send/abc'))).toBe(true);
    expect(isValidWebPushSubscription(sub('https://updates.push.services.mozilla.com/wpush/v2/abc'))).toBe(true);
    expect(isValidWebPushSubscription(sub('https://web.push.apple.com/abc'))).toBe(true);
  });

  it('refuses an arbitrary PUBLIC host — the case the denylist lets through', () => {
    // The pre-existing checks reject loopback and RFC1918, and their own comment
    // says they are "not exhaustive". They pass every public address: a
    // signed-in user could register this and have the server POST a
    // VAPID-signed, encrypted payload to it on every notification thereafter.
    expect(isValidWebPushSubscription(sub('https://attacker.example/collect'))).toBe(false);
  });

  it('is not fooled by a hostname that merely contains a vendor domain', () => {
    // Why the check is a dot-suffix and not `includes`.
    expect(isKnownPushService('fcm.googleapis.com.attacker.example')).toBe(false);
    expect(isKnownPushService('notgoogleapis.com')).toBe(false);
    expect(isKnownPushService('fcm.googleapis.com')).toBe(true);
  });

  it('still refuses the things the original denylist refused', () => {
    // Guards the guard: the allowlist must ADD to those checks, not replace
    // them — an http:// vendor URL is still downgrade-able.
    expect(isValidWebPushSubscription(sub('http://fcm.googleapis.com/fcm/send/abc'))).toBe(false);
    expect(isValidWebPushSubscription(sub('https://127.0.0.1/x'))).toBe(false);
    expect(isValidWebPushSubscription(sub('https://169.254.169.254/latest/meta-data/'))).toBe(false);
    expect(isValidWebPushSubscription({ endpoint: 'https://fcm.googleapis.com/x' })).toBe(false); // no keys
  });
});

describe('a notification click cannot leave the app', () => {
  it('keeps a same-origin path', () => {
    expect(safeClickPath('/dashboard/campaigns')).toBe('/dashboard/campaigns');
  });

  it('refuses absolute and protocol-relative URLs', () => {
    expect(safeClickPath('https://evil.example/p')).toBe('/dashboard/notifications');
    expect(safeClickPath('//evil.example/p')).toBe('/dashboard/notifications');
    expect(safeClickPath('/\\evil.example/p')).toBe('/dashboard/notifications');
    expect(safeClickPath(undefined)).toBe('/dashboard/notifications');
  });

  it('the service worker enforces it independently — its copy is EXECUTED', () => {
    // A worker outlives the deploy that installed it, so a browser can run last
    // month's worker against today's server. Lift the worker's own function out
    // and run it against the server's cases; pattern-matching the file would not
    // catch the two drifting apart.
    const match = /function swSafeClickPath\(url\) \{[\s\S]*?\n\}/.exec(sw);
    expect(match, 'sw.js must define swSafeClickPath').not.toBeNull();
    const swSafe = new Function(`${match![0]}; return swSafeClickPath;`)() as (u: unknown) => string;

    for (const input of ['/dashboard', '/x?a=1', 'https://evil.example/p', '//evil.example/p', '/\\evil.example/p', '', 'dashboard']) {
      expect(swSafe(input), `sw.js disagreed with the server on ${JSON.stringify(input)}`)
        .toBe(safeClickPath(input));
    }
  });

  it('is applied at BOTH points the worker uses a url', () => {
    // The payload's url is stored on the notification, and read back on click.
    // Guarding only the read leaves the stored value unchecked for any other
    // consumer; guarding only the write trusts a notification created earlier.
    expect(sw).toMatch(/data: \{ url: swSafeClickPath\(payload\.url\) \}/);
    expect(sw).toMatch(/const target = swSafeClickPath\(/);
    expect(sw).not.toMatch(/data: \{ url: payload\.url \|\|/);
  });
});
