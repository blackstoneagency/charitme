import { describe, expect, it } from 'vitest';
import webpush from 'web-push';

// ─────────────────────────────────────────────────────────────────────────────
// The parts of push that had never been EXECUTED.
//
// `push-core.test.ts` covers the pure decisions. But the crypto path — VAPID JWT
// signing and aes128gcm payload encryption — had only ever been read, not run,
// and it is the half most likely to be wrong: it fails at the push service, on a
// user's device, with an error nobody sees.
//
// `generateRequestDetails` builds the exact request `sendNotification` would
// POST, without sending it. So the encryption and signing run for real, offline,
// against a keypair generated here — no secret is committed and none is needed.
//
// ⚠️ This file must NOT mock web-push. The pruning tests live in
// `push-pruning.test.ts` because `vi.mock` is hoisted to the whole module, so
// mocking the library there would replace the very crypto this file exists to
// execute — and the tests would still pass, proving nothing.
// ─────────────────────────────────────────────────────────────────────────────

const SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/fake-endpoint-for-tests',
  keys: {
    // A real P-256 public point and 16-byte auth secret, so encryption performs
    // genuine key agreement rather than erroring on malformed input.
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

describe('the crypto path actually runs', () => {
  it('signs a VAPID JWT and encrypts the payload', async () => {
    const keys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails('mailto:support@charitme.com', keys.publicKey, keys.privateKey);

    const payload = JSON.stringify({ title: 'You received a gift', body: '$50 from Ada', url: '/dashboard' });
    const details = webpush.generateRequestDetails(SUBSCRIPTION, payload, { TTL: 43200 });

    expect(details.method).toBe('POST');
    expect(details.endpoint).toBe(SUBSCRIPTION.endpoint);

    // VAPID: the push service authenticates us from this header.
    const auth = details.headers.Authorization ?? details.headers.authorization;
    expect(auth, 'no VAPID Authorization header — the push service would reject this').toMatch(/^vapid/i);
    expect(auth).toContain('t=');
    expect(auth).toContain('k=');

    expect(details.headers['Content-Encoding']).toBe('aes128gcm');
    expect(details.headers.TTL).toBe(43200);
  });

  it('sends CIPHERTEXT, not the message', async () => {
    // ⚠️ The assertion that matters. A push payload travels through a third-party
    // push service; if this were ever sent in the clear, the donor's name and the
    // amount would be readable by that service. Asserting "a body exists" would
    // pass even then.
    const keys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails('mailto:support@charitme.com', keys.publicKey, keys.privateKey);

    const secret = 'Ada Lovelace gave $500';
    const details = webpush.generateRequestDetails(SUBSCRIPTION, JSON.stringify({ title: secret }));

    expect(Buffer.isBuffer(details.body)).toBe(true);
    const body = details.body as Buffer;
    expect(body.length).toBeGreaterThan(50);
    expect(body.includes(Buffer.from(secret, 'utf8')), 'the payload is readable in transit').toBe(false);
    expect(body.includes(Buffer.from('Ada', 'utf8'))).toBe(false);
  });

  it('produces a different ciphertext each time, so nothing is replayable', () => {
    const keys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails('mailto:support@charitme.com', keys.publicKey, keys.privateKey);
    const payload = JSON.stringify({ title: 'same' });
    const a = webpush.generateRequestDetails(SUBSCRIPTION, payload).body as Buffer;
    const b = webpush.generateRequestDetails(SUBSCRIPTION, payload).body as Buffer;
    expect(a.equals(b)).toBe(false);
  });
});
