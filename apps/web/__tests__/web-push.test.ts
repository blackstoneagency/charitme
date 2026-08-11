import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAX_PAYLOAD_BYTES,
  donationPushPayload,
  fitToPayloadBudget,
  isGoneStatus,
  isSupportedEndpoint,
  pushConfigured,
  safeClickPath,
  shortUserAgent,
} from '../lib/push-core';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
/** Comments explain the bugs below; a guard must match the CODE, not the prose. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sw = read('public/sw.js');
const route = read('app/api/push/subscribe/route.ts');
const webhook = read('app/api/stripe/webhook/route.ts');
const sender = read('lib/push.ts');

/**
 * Web push is `mobileGo.md` item 5 — the mitigation for Apple's Guideline 4.2
 * "repackaged website" rejection, and the only item on that list that is repo
 * work rather than store credentials.
 *
 * None of it can be executed end to end here: a real subscription needs a
 * browser permission grant and a live vendor push service, neither of which
 * exists in a sandbox. So the decisions live in `lib/push-core.ts` and are
 * executed; the wiring is asserted against source, and the last describe block
 * says plainly which is which.
 */

describe('a click target can never leave the app', () => {
  it('keeps a same-origin path', () => {
    expect(safeClickPath('/dashboard/campaigns')).toBe('/dashboard/campaigns');
  });

  it('refuses an absolute URL', () => {
    // The service worker resolves whatever it is given and calls openWindow, so
    // this would open an arbitrary site FROM the installed app — which on a
    // phone is indistinguishable from the app navigating there itself.
    expect(safeClickPath('https://evil.example/phish')).toBe('/dashboard');
  });

  it('refuses a protocol-relative URL', () => {
    // Same first character as a safe path, different origin. This is the one
    // that gets missed by a `startsWith('/')` check alone.
    expect(safeClickPath('//evil.example/phish')).toBe('/dashboard');
    expect(safeClickPath('/\\evil.example/phish')).toBe('/dashboard');
  });

  it('refuses a non-string', () => {
    expect(safeClickPath(undefined as unknown as string)).toBe('/dashboard');
  });

  it('is enforced in the service worker too — the worker copy is EXECUTED', () => {
    // A service worker outlives the deploy that installed it: a browser can run
    // last month's worker against today's server, so the check has to exist on
    // both sides. Rather than pattern-match the file, lift the worker's own
    // function out and run it against the same cases as the server's — which is
    // the only way to catch the two drifting apart.
    const match = /function safeClickPath\(url\) \{[\s\S]*?\n\}/.exec(sw);
    expect(match, 'sw.js must define safeClickPath').not.toBeNull();
    const swSafeClickPath = new Function(`${match![0]}; return safeClickPath;`)() as typeof safeClickPath;

    for (const input of ['/dashboard/campaigns', '/x?a=1', 'https://evil.example/p', '//evil.example/p', '/\\evil.example/p', '', 'dashboard']) {
      expect(swSafeClickPath(input), `sw.js disagreed with the server on ${JSON.stringify(input)}`)
        .toBe(safeClickPath(input));
    }
    expect(swSafeClickPath('//evil.example/p')).toBe('/dashboard');
    expect(stripComments(sw)).toMatch(/data: \{ url: safeClickPath\(payload\.url\) \}/);
  });
});

describe('only a real push service is ever dialled', () => {
  it('accepts the vendor endpoints', () => {
    expect(isSupportedEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isSupportedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isSupportedEndpoint('https://web.push.apple.com/abc')).toBe(true);
  });

  it('refuses anything else', () => {
    // The stored endpoint is a URL this server later POSTs to. Without a gate,
    // a row is an SSRF with a signed request attached.
    expect(isSupportedEndpoint('https://evil.example/collect')).toBe(false);
    expect(isSupportedEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false); // not https
    expect(isSupportedEndpoint('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSupportedEndpoint('not a url')).toBe(false);
  });

  it('is not fooled by a hostname that merely contains a vendor domain', () => {
    expect(isSupportedEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(isSupportedEndpoint('https://evil.example/?x=push.apple.com')).toBe(false);
  });

  it('is checked on the way IN and on the way OUT', () => {
    // Rejecting at write time alone leaves rows written before the gate existed;
    // rejecting only at send time stores junk that reads as a live device.
    expect(stripComments(route)).toMatch(/if \(!isSupportedEndpoint\(endpoint\)\)/);
    expect(stripComments(sender)).toMatch(/if \(!isSupportedEndpoint\(sub\.endpoint\)\)/);
  });
});

describe('the payload fits what the protocol will carry', () => {
  it('leaves a small payload alone', () => {
    const p = { title: 'New donation: $25', body: 'Someone donated.', url: '/dashboard' };
    expect(fitToPayloadBudget(p)).toEqual(p);
  });

  it('truncates an oversized body', () => {
    const p = { title: 'New donation: $25', body: 'x'.repeat(5000), url: '/dashboard' };
    const fitted = fitToPayloadBudget(p);
    expect(new TextEncoder().encode(JSON.stringify(fitted)).length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    expect(fitted.body.endsWith('…')).toBe(true);
    expect(fitted.title).toBe(p.title);
  });

  it('keeps as much of the body as fits, rather than throwing it all away', () => {
    // The assertion that caught the first version: its size check closed over
    // the ORIGINAL payload instead of the copy being shrunk, so the loop only
    // ever stopped when the body ran out — every oversized notification came
    // out as a bare "…", and the byte-budget and ends-with-ellipsis assertions
    // above both passed on it.
    const fitted = fitToPayloadBudget({ title: 'T', body: 'x'.repeat(5000), url: '/x' });
    expect(fitted.body.length).toBeGreaterThan(2000);
    expect(new TextEncoder().encode(JSON.stringify(fitted)).length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });

  it('measures BYTES, not characters', () => {
    // A 4-byte emoji counts four times over. A character-length check passes a
    // payload the push service then silently drops — the failure mode is a
    // notification that never arrives, with no error anywhere.
    const p = { title: 'New donation: $25', body: '🎁'.repeat(1200), url: '/dashboard' };
    const fitted = fitToPayloadBudget(p);
    expect(new TextEncoder().encode(JSON.stringify(p)).length).toBeGreaterThan(MAX_PAYLOAD_BYTES);
    expect(new TextEncoder().encode(JSON.stringify(fitted)).length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
  });

  it('never splits a multi-byte character in half', () => {
    const fitted = fitToPayloadBudget({ title: 'T', body: '🎁'.repeat(1200), url: '/x' });
    expect(fitted.body).not.toContain('�');
    expect([...fitted.body].every((c) => c === '🎁' || c === '…')).toBe(true);
    // …and it kept most of them, rather than collapsing to the ellipsis.
    expect([...fitted.body].length).toBeGreaterThan(500);
  });
});

describe('a donation alert cannot name an anonymous donor', () => {
  it('prints exactly the display name it was handed', () => {
    const p = donationPushPayload({
      donorDisplayName: 'An anonymous donor',
      amountFormatted: '$500.00',
      campaignTitle: 'Help Maria rebuild',
      campaignId: 'c1',
    });
    expect(p.body).toContain('An anonymous donor');
    expect(p.title).toBe('New donation: $500.00');
    expect(p.tag).toBe('donation-c1');
  });

  it('guards the guard: a named donor IS named', () => {
    // Without this, the assertion above would pass on a function that returned
    // "An anonymous donor" unconditionally.
    const p = donationPushPayload({
      donorDisplayName: 'Jane Doe',
      amountFormatted: '$25.00',
      campaignTitle: 'Help Maria rebuild',
      campaignId: 'c1',
    });
    expect(p.body).toContain('Jane Doe');
  });

  it('takes a display name, and has no way to look one up', () => {
    // The redaction is two gates deep in the webhook (per-gift `anonymous` plus
    // account-wide Profile Visibility). A channel that re-read `full_name`
    // would announce an anonymous donor on the organiser's LOCK SCREEN — the
    // most public place this app can print a name.
    // Comments stripped first: this file's own docs explain the bug in terms of
    // `full_name`, and a guard that matched its own explanation would fail on a
    // correct implementation.
    const core = stripComments(read('lib/push-core.ts'));
    expect(core).not.toMatch(/full_name/);
    expect(core).not.toMatch(/supabase/i);
    const hook = stripComments(webhook);
    expect(hook).toMatch(/donationPushPayload\(\{\s*\n\s*donorDisplayName,/);
  });

  it('is fired without being able to fail the donation', () => {
    // A donation Stripe has already taken must not be retried because a
    // notification failed. Lazy import + void + catch, all three.
    const hook = stripComments(webhook);
    expect(hook).toMatch(/void import\('\.\.\/\.\.\/\.\.\/\.\.\/lib\/push'\)/);
    expect(hook).toMatch(/\.catch\(\(\) => \{\}\)/);
  });
});

describe('dead endpoints are pruned, live ones are kept', () => {
  it('treats 404 and 410 as gone', () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
  });

  it('keeps a row on a transient failure', () => {
    // Deleting on a 500 or a rate limit would unsubscribe a working device
    // because the push service had a bad minute.
    expect(isGoneStatus(429)).toBe(false);
    expect(isGoneStatus(500)).toBe(false);
    expect(isGoneStatus(undefined)).toBe(false);
  });

  it('the sender acts on that distinction', () => {
    const code = stripComments(sender);
    expect(code).toMatch(/if \(isGoneStatus\(statusCode\)\) gone\.push\(sub\.id\)/);
    expect(code).toMatch(/\.from\('push_subscriptions'\)\s*\n?\s*\.delete\(\)\s*\n?\s*\.in\('id', gone\)/);
  });
});

describe('push degrades instead of failing', () => {
  it('reports unconfigured when either key is missing', () => {
    // Same rule as RESEND_API_KEY / OPENAI_API_KEY / UNSPLASH_ACCESS_KEY: an
    // unset optional integration is a no-op, never a hard failure.
    expect(pushConfigured({})).toBe(false);
    expect(pushConfigured({ VAPID_PUBLIC_KEY: 'pub' })).toBe(false);
    expect(pushConfigured({ VAPID_PRIVATE_KEY: 'priv' })).toBe(false);
  });

  it('reports configured when both are present', () => {
    expect(pushConfigured({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })).toBe(true);
    expect(pushConfigured({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })).toBe(true);
  });

  it('never calls setVapidDetails at module scope', () => {
    // A throw there takes down every route importing this file, including the
    // Stripe webhook.
    const code = stripComments(sender);
    expect(code).toMatch(/function ensureConfigured\(\)/);
    expect(code).not.toMatch(/^webpush\.setVapidDetails/m);
    expect(code).toMatch(/if \(!ensureConfigured\(\)\) \{ result\.skipped = true; return result; \}/);
  });

  it('refuses to store an endpoint it could never push to', () => {
    // Storing one would show the toggle "on" while nothing ever arrived.
    expect(stripComments(route)).toMatch(/if \(!pushConfigured\(process\.env\)\)/);
  });
});

describe('a subscription is per device, and owned', () => {
  it('upserts on the endpoint rather than inserting', () => {
    // A browser returns the SAME endpoint until permission is revoked, so a
    // re-register must update. Inserting gives a returning device a duplicate
    // of every future alert.
    expect(stripComments(route)).toMatch(/onConflict: 'endpoint'/);
  });

  it('scopes the delete to the caller', () => {
    // The endpoint alone is enough to push to a device, so deleting by endpoint
    // without an owner check lets anyone holding one unsubscribe that device.
    const code = stripComments(route);
    expect(code).toMatch(/\.delete\(\)\s*\n\s*\.eq\('user_id', user\.id\)\s*\n\s*\.eq\('endpoint',/);
  });

  it('requires a session on both verbs', () => {
    const code = stripComments(route);
    expect(code.match(/if \(!user\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/g))
      .toHaveLength(2);
  });

  it('trims the stored user agent', () => {
    expect(shortUserAgent('x'.repeat(500))).toHaveLength(180);
    expect(shortUserAgent(null)).toBeNull();
  });
});

describe('the service worker handles the events that keep push alive', () => {
  it('shows a notification for a push with data', () => {
    const code = stripComments(sw);
    expect(code).toMatch(/self\.addEventListener\('push'/);
    expect(code).toMatch(/self\.registration\.showNotification/);
  });

  it('ignores a data-less push instead of showing a generic one', () => {
    // "Something happened" trains people to ignore the real ones.
    expect(stripComments(sw)).toMatch(/if \(!event\.data\) return;/);
  });

  it('focuses an open tab rather than stacking windows', () => {
    const code = stripComments(sw);
    expect(code).toMatch(/self\.addEventListener\('notificationclick'/);
    expect(code).toMatch(/matchAll\(\{ type: 'window', includeUncontrolled: true \}\)/);
    expect(code).toMatch(/return client\.focus\(\)/);
  });

  it('re-registers when the push service rotates a subscription', () => {
    // Without this the device goes quiet and neither side can tell: the old
    // endpoint 410s and the new one is only ever offered in this event.
    const code = stripComments(sw);
    expect(code).toMatch(/self\.addEventListener\('pushsubscriptionchange'/);
    expect(code).toMatch(/pushManager\.subscribe\(/);
    expect(code).toMatch(/'\/api\/push\/subscribe'/);
  });

  it('does not cache the new API route', () => {
    // /api/push/subscribe is a POST to a per-user resource. The allowlist in
    // this worker is a security boundary — see its header comment.
    const code = stripComments(sw);
    expect(code).not.toMatch(/PRECACHE_URLS[\s\S]{0,200}api\/push/);
  });
});

describe('what this suite does NOT prove', () => {
  it('cannot deliver a real notification here, and says so', () => {
    // A real subscription needs a browser permission grant and a live vendor
    // push service (fcm.googleapis.com, web.push.apple.com). Neither exists in
    // this sandbox, and `dl.google.com` is refused by the agent proxy anyway.
    //
    // So: everything decidable without a socket is EXECUTED above; the wiring is
    // read from source. This test exists so the limit is recorded next to the
    // assertions it qualifies rather than inferred.
    expect(stripComments(sender)).toMatch(/webpush\.sendNotification\(/);
  });
});
