import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Pruning, at the integration level.
//
// `isGoneForever` is unit-tested in push-core.test.ts, but what matters is
// whether `pushToUser` actually DELETES on a 410 and actually does NOT on a 500.
// A correct predicate wired to the wrong branch passes every test that only
// checks the predicate.
//
// Separate file because `vi.mock` is hoisted module-wide: mocking web-push
// alongside the real-crypto tests would silently replace what those assert.
// ─────────────────────────────────────────────────────────────────────────────


const deleted: string[][] = [];
let rows: unknown[] = [];
let sendBehaviour: (endpoint: string) => void = () => {};

vi.mock('web-push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('web-push')>();
  return {
    default: {
      ...actual,
      setVapidDetails: () => {},
      sendNotification: (sub: { endpoint: string }) => {
        sendBehaviour(sub.endpoint);
        return Promise.resolve({ statusCode: 201 });
      },
    },
  };
});

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        update: () => chain,
        limit: () => Promise.resolve({ data: rows, error: null }),
        delete: () => ({ in: (_col: string, ids: string[]) => { deleted.push(ids); return Promise.resolve({ error: null }); } }),
      };
      return chain;
    },
  },
}));

describe('a failed delivery prunes only when it is final', () => {
  beforeEach(() => {
    vi.resetModules();
    deleted.length = 0;
    process.env.VAPID_PUBLIC_KEY = 'test-public';
    process.env.VAPID_PRIVATE_KEY = 'test-private';
    rows = [
      { id: 'sub-gone', platform: 'web', endpoint: 'https://push.example/gone', p256dh: 'x', auth: 'y' },
      { id: 'sub-flaky', platform: 'web', endpoint: 'https://push.example/flaky', p256dh: 'x', auth: 'y' },
    ];
  });

  it('deletes the subscription the push service has dropped', async () => {
    sendBehaviour = (endpoint) => {
      if (endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    };
    const { pushToUser } = await import('../lib/push-server');
    await pushToUser('user-1', { kind: 'donation', title: 'Gift', body: '', link: '/dashboard' });
    expect(deleted.flat()).toEqual(['sub-gone']);
  });

  it('KEEPS a subscription that merely failed', async () => {
    // ⚠️ The one that protects users during an outage. A push service returning
    // 500 for everyone would otherwise unsubscribe the entire platform, silently
    // and permanently.
    sendBehaviour = () => {
      throw Object.assign(new Error('server error'), { statusCode: 500 });
    };
    const { pushToUser } = await import('../lib/push-server');
    await pushToUser('user-1', { kind: 'donation', title: 'Gift', body: '', link: '/dashboard' });
    expect(deleted.flat()).toEqual([]);
  });

  it('never attempts a native token through the web transport', async () => {
    // An iOS row cannot be delivered by web-push. Skipped, not attempted — so a
    // future APNs build cannot be fooled into thinking these were delivered.
    rows = [{ id: 'ios-1', platform: 'ios', endpoint: null, p256dh: null, auth: null }];
    let attempts = 0;
    sendBehaviour = () => { attempts++; };
    const { pushToUser } = await import('../lib/push-server');
    const sent = await pushToUser('user-1', { kind: 'donation', title: 'Gift', body: '', link: '/dashboard' });
    expect(attempts).toBe(0);
    expect(sent).toBe(0);
  });

  it('sends nothing at all when VAPID is unconfigured', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    let attempts = 0;
    sendBehaviour = () => { attempts++; };
    const { pushToUser } = await import('../lib/push-server');
    expect(await pushToUser('user-1', { kind: 'donation', title: 'Gift', body: '', link: '/dashboard' })).toBe(0);
    expect(attempts).toBe(0);
  });
});
