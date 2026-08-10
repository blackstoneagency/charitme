import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDonationPush,
  clampNotificationText,
  formatAmount,
  isGoneStatus,
  isSendableSubscription,
  safeNotificationPath,
} from '../lib/push-core';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Web Push — the mitigation mobileGo.md records for Apple's "minimum
// functionality" rejection risk (donation alerts are the reason to install the
// app at all).
//
// The tests that matter here are not "does it send". They are the three ways
// this feature could hurt somebody:
//   1. a notification opening an attacker's URL under CharitMe's name,
//   2. a lock-screen banner naming a donor who chose to be anonymous,
//   3. a push failure taking down the webhook that records money.
// ─────────────────────────────────────────────────────────────────────────────

describe('a notification can only ever open this site', () => {
  it.each([
    ['https://evil.example/phish', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/'],
    [null, '/'],
    [undefined, '/'],
    [42, '/'],
  ])('rejects %s', (input, expected) => {
    expect(safeNotificationPath(input as unknown)).toBe(expected);
  });

  it('keeps an ordinary same-origin path', () => {
    expect(safeNotificationPath('/campaigns/help-sarah')).toBe('/campaigns/help-sarah');
  });

  it('the service worker applies the SAME rule, not just the sender', () => {
    // A payload arrives encrypted, which proves it came from us — but the rule
    // has to hold on BOTH sides, or a future sender bug becomes a redirect.
    const sw = read('public/sw.js');
    expect(sw).toContain('function samePathOnly');
    expect(sw).toMatch(/raw\.startsWith\('\/\/'\)/);
    expect(sw).toMatch(/raw\.includes\('\\\\'\)/);
    // And the click handler must route through it rather than using data.url raw.
    expect(sw).toMatch(/samePathOnly\(event\.notification\.data/);
  });
});

describe('the donation alert does not leak the donor', () => {
  const payload = buildDonationPush({
    amountCents: 2500,
    campaignTitle: 'Help Sarah rebuild after the fire',
    campaignSlug: 'help-sarah',
  });

  it('names the amount and the campaign, and nobody else', () => {
    expect(payload.title).toBe('$25 donation received');
    expect(payload.body).toBe('Help Sarah rebuild after the fire');
  });

  it('carries no donor field at all', () => {
    // A notification renders on a lock screen, in front of whoever is holding
    // the phone. An anonymous donation has to stay anonymous there too — so the
    // payload has no donor name to leak in the first place.
    expect(Object.keys(payload).sort()).toEqual(['body', 'tag', 'title', 'url']);
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('donor');
  });

  it('groups by campaign so ten gifts are one buzz, not ten', () => {
    expect(payload.tag).toBe('donation-help-sarah');
    const other = buildDonationPush({ amountCents: 100, campaignTitle: 'X', campaignSlug: 'other' });
    expect(other.tag).not.toBe(payload.tag);
  });

  it('clamps a long title instead of letting it push the amount off the banner', () => {
    const long = buildDonationPush({
      amountCents: 100,
      campaignTitle: 'A'.repeat(200),
      campaignSlug: 's',
    });
    expect(long.body.length).toBeLessThanOrEqual(80);
    expect(long.body.endsWith('…')).toBe(true);
  });
});

describe('clamping is by grapheme budget, not a hard slice', () => {
  it('collapses runs of whitespace so a padded title does not eat the budget', () => {
    expect(clampNotificationText('a   b\n\nc', 40)).toBe('a b c');
  });

  it('leaves a short string untouched', () => {
    expect(clampNotificationText('Help Sarah', 40)).toBe('Help Sarah');
  });

  it('ends on the ellipsis, never mid-space', () => {
    const out = clampNotificationText('word '.repeat(40), 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/ …$/);
  });
});

describe('amounts read like money', () => {
  it.each([
    [2500, '$25'],
    [2550, '$25.50'],
    [100, '$1'],
    [0, '$0'],
  ])('%s cents → %s', (cents, expected) => {
    expect(formatAmount(cents)).toBe(expected);
  });

  it('never renders NaN or a negative to a user', () => {
    expect(formatAmount(Number.NaN)).toBe('$0');
    expect(formatAmount(-500)).toBe('$0');
  });
});

describe('only a real tombstone expires a subscription', () => {
  it('404 and 410 mean gone', () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
  });

  it.each([429, 500, 502, 503, 0])('%s is transient and must NOT expire the row', (status) => {
    // The failure this prevents: one bad afternoon at a push service silently
    // unsubscribing the entire user base, with no way to tell it happened.
    expect(isGoneStatus(status)).toBe(false);
  });
});

describe('a subscription without encryption material is refused early', () => {
  it('accepts a complete one', () => {
    expect(isSendableSubscription({ endpoint: 'https://fcm.example/x', p256dh: 'k', auth: 'a' })).toBe(true);
  });

  it.each([
    [{ endpoint: 'https://x/y', p256dh: 'k' }, 'no auth'],
    [{ endpoint: 'https://x/y', auth: 'a' }, 'no p256dh'],
    [{ endpoint: 'http://x/y', p256dh: 'k', auth: 'a' }, 'not https'],
    [{ p256dh: 'k', auth: 'a' }, 'no endpoint'],
    [null, 'null'],
  ])('refuses %#: %s', (input, _why) => {
    expect(isSendableSubscription(input)).toBe(false);
  });
});

describe('push can never break the money path', () => {
  const webhook = read('app/api/stripe/webhook/route.ts');

  it('the donation alert is inside a try/catch that only warns', () => {
    expect(webhook).toMatch(/\[push\] donation alert failed \(non-blocking\)/);
  });

  it('is guarded by alreadyDone, so a redelivered event does not buzz twice', () => {
    const block = webhook.slice(webhook.indexOf('Push the organiser a donation alert'));
    expect(block.slice(0, 900)).toMatch(/if \(!alreadyDone\)/);
  });

  it('the sender itself is documented as never throwing', () => {
    const push = read('lib/push.ts');
    expect(push).toMatch(/FAILS SOFT/i);
    // Every await on the push service is wrapped; nothing escapes sendPushToUser.
    expect(push).toMatch(/catch\s*\{/);
  });

  it('degrades to off when VAPID keys are absent, rather than erroring', () => {
    const push = read('lib/push.ts');
    expect(push).toMatch(/if \(!publicKey \|\| !privateKey\)/);
  });
});

describe('the subscription endpoint is a capability, so it is guarded', () => {
  const route = read('app/api/push/subscribe/route.ts');

  it('requires a session and takes user_id from it, never from the body', () => {
    // ⚠️ Matched against CODE, not comments. The first version asserted
    // `toContain('requireUser()')` and passed green AFTER the route stopped
    // using it — it was matching the comment that explains why it was dropped.
    // That is the comment-matching trap todo.md records; strip comments first.
    const code = route
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    expect(code).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(code, 'a page helper would redirect an API caller').not.toMatch(/\brequireUser\s*\(/);
    expect(code).toContain('user_id: user.id');
    // The body schema must not carry a user id at all.
    expect(code).not.toMatch(/user_id:\s*z\./);
  });

  it('upserts on endpoint so one device cannot become two rows', () => {
    expect(route).toMatch(/onConflict: 'endpoint'/);
  });

  it('scopes DELETE to the caller, so one account cannot unsubscribe another', () => {
    const del = route.slice(route.indexOf('export async function DELETE'));
    expect(del).toMatch(/\.eq\('user_id', user\.id\)/);
  });

  it('answers 503 (not 500) when push is unconfigured or the table is missing', () => {
    expect(route).toMatch(/PUSH_NOT_CONFIGURED[\s\S]*?503/);
    expect(route).toMatch(/PUSH_TABLE_MISSING[\s\S]*?503/);
  });
});

describe('the opt-in control is honest about when it cannot work', () => {
  const optin = read('app/dashboard/notifications/PushOptIn.tsx');

  it('renders NOTHING when push is unsupported or unconfigured', () => {
    // A control that does nothing when tapped reads as a broken product — and on
    // iOS a Safari tab genuinely cannot subscribe at all.
    expect(optin).toMatch(/if \(state === 'checking' \|\| state === 'unsupported' \|\| state === 'unconfigured'\) return null;/);
  });

  it('rolls the browser subscription back when the server refuses it', () => {
    // Otherwise the browser believes this device is subscribed while the server
    // has no row: opted-in forever, receiving nothing.
    expect(optin).toMatch(/await sub\.unsubscribe\(\)[\s\S]{0,200}setError/);
  });

  it('uses the AA-safe green, not the brand fill', () => {
    // --green is #12a653 = 3.18:1 on white; this button is 14px/650, so AA needs
    // 4.5:1. --green-dark is 5.73:1.
    expect(optin).toContain('var(--green-dark)');
    expect(optin).not.toMatch(/background:[^;]*var\(--green\)/);
  });

  it('keeps a 44px touch target', () => {
    expect(optin).toMatch(/minHeight: 44/);
  });
});

describe('the service worker version was bumped with the handlers', () => {
  it('is v4, so an existing install actually picks up push', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("const CACHE_VERSION = 'v4'");
    expect(sw).toContain("addEventListener('push'");
    expect(sw).toContain("addEventListener('notificationclick'");
  });

  it('always shows something, because a silent push can cost the subscription', () => {
    const sw = read('public/sw.js');
    expect(sw).toMatch(/silent push/i);
    expect(sw).toContain('showNotification');
  });
});
