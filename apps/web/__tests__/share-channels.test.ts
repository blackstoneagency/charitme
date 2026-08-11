import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const share = read('app/campaigns/[slug]/ShareButtons.tsx');
const api = read('app/api/share-events/route.ts');
const migration = read('../../supabase/migrations/20260905010000_share_events_native_channels.sql');
const rollback = read('../../supabase/rollbacks/20260905010000_rollback_share_events_native_channels.sql');

/**
 * Three lists have to agree, and nothing made them:
 *
 *   the channels the UI can EMIT ⊆ the API's zod enum ⊆ the DB CHECK constraint
 *
 * They did not. The Messenger tile has always posted `channel: 'messenger'`,
 * which the zod enum rejected with a 400 — and the client fires that request
 * with `void fetch(...)`, so the rejection was discarded and the share never
 * reached attribution. Invisible from the UI, invisible in the data, and it only
 * renders when NEXT_PUBLIC_FACEBOOK_APP_ID is set, which is why it lasted.
 */

/** Channels the component can send: the `Channel` union, which types every call. */
function uiChannels(): string[] {
  const union = /type Channel =([^;]+);/.exec(stripComments(share));
  if (!union) throw new Error('the Channel union has moved — this guard is now vacuous');
  return [...union[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]!).sort();
}

function apiChannels(): string[] {
  const list = /const CHANNELS = \[([^\]]+)\]/.exec(stripComments(api));
  if (!list) throw new Error('the API channel list has moved — this guard is now vacuous');
  return [...list[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]!).sort();
}

function dbChannels(): string[] {
  const add = /ADD CONSTRAINT share_events_channel_check CHECK \(([\s\S]*?)\);/.exec(migration);
  if (!add) throw new Error('the migration constraint has moved — this guard is now vacuous');
  return [...add[1].matchAll(/'([a-z]+)'::text/g)].map((m) => m[1]!).sort();
}

describe('every channel the UI can emit is one the API accepts', () => {
  it('the API enum covers the UI union', () => {
    const missing = uiChannels().filter((c) => !apiChannels().includes(c));
    expect(
      missing,
      `These channels are sent by ShareButtons.tsx but rejected by the API's zod\n` +
        `enum, which means a 400 the client discards and a share that is never\n` +
        `recorded. Add them to CHANNELS in app/api/share-events/route.ts:\n  ` +
        missing.join('\n  '),
    ).toEqual([]);
  });

  it('is non-vacuous: it really sees both lists', () => {
    // If either regex stopped matching, the check above would pass by comparing
    // nothing to nothing.
    expect(uiChannels().length).toBeGreaterThan(4);
    expect(apiChannels().length).toBeGreaterThan(4);
    expect(uiChannels()).toContain('messenger');
    expect(uiChannels()).toContain('native');
  });

  it('would have caught the bug it was written for', () => {
    // The pre-fix enum, verbatim. Proves the comparison detects a real gap
    // rather than passing because both lists happen to be equal today.
    const before = ['link', 'email', 'sms', 'facebook', 'twitter', 'instagram', 'linkedin', 'whatsapp', 'qr', 'other'];
    expect(uiChannels().filter((c) => !before.includes(c))).toEqual(['messenger', 'native']);
  });
});

describe('the database constraint is the third list, and it lags on purpose', () => {
  it('the migration permits everything the API accepts', () => {
    expect(apiChannels().filter((c) => !dbChannels().includes(c))).toEqual([]);
  });

  it('the API does not depend on that migration being applied', () => {
    // 50 migrations are pending and cannot be applied from here. Inserting a
    // value the LIVE constraint rejects raises 23514 and loses the event —
    // which is the bug being fixed, so it must not come back from this side.
    const code = stripComments(api);
    expect(code).toMatch(/error\?\.code === '23514'/);
    expect(code).toMatch(/messenger: 'facebook'/);
    expect(code).toMatch(/native: 'other'/);
  });

  it('each fallback is itself a value the old constraint allowed', () => {
    // A fallback outside the live constraint would fail exactly like the value
    // it replaced, turning the retry into a second lost event.
    const oldConstraint = ['link', 'email', 'sms', 'facebook', 'twitter', 'instagram', 'linkedin', 'whatsapp', 'qr', 'other'];
    for (const fallback of ['facebook', 'other']) expect(oldConstraint).toContain(fallback);
  });

  it('the rollback folds the new values before narrowing the constraint', () => {
    // Re-adding the narrower CHECK against rows holding 'native' fails outright,
    // and a DROP that succeeds followed by an ADD that does not leaves the table
    // with NO channel constraint at all.
    const updatesFirst = rollback.indexOf('UPDATE public.share_events');
    const narrowsAfter = rollback.indexOf('ADD CONSTRAINT');
    expect(updatesFirst).toBeGreaterThan(-1);
    expect(updatesFirst).toBeLessThan(narrowsAfter);
    expect(rollback).toMatch(/SET channel = 'facebook' WHERE channel = 'messenger'/);
    expect(rollback).toMatch(/SET channel = 'other' +WHERE channel = 'native'/);
  });
});

describe('the native share sheet', () => {
  it('is offered only where the OS actually provides one', () => {
    // Rendering it unconditionally leaves a dead tile on every desktop browser
    // without navigator.share.
    const code = stripComments(share);
    expect(code).toMatch(/typeof navigator\.share === 'function'/);
    expect(code).toMatch(/\{canNativeShare && \(/);
  });

  it('detects after mount, not during render', () => {
    // `navigator` does not exist on the server; branching on it in the render
    // body is a hydration mismatch.
    expect(stripComments(share)).toMatch(/useEffect\(\(\) => \{ setCanNativeShare/);
  });

  it('does not count a dismissed sheet as a share', () => {
    // Dismissing rejects with AbortError. Counting it would inflate the panel an
    // organizer uses to decide where to put their effort.
    expect(stripComments(share)).toMatch(/name === 'AbortError'\) return;/);
  });

  it('records the share only after the sheet resolves', () => {
    // recordShare must follow the await, not precede it — otherwise every tap is
    // a share regardless of what the person did next.
    const fn = /const handleNativeShare = async \(\) => \{[\s\S]*?\n  \};/.exec(stripComments(share))![0];
    expect(fn.indexOf('await navigator.share')).toBeLessThan(fn.indexOf("recordShare('native')"));
  });
});
