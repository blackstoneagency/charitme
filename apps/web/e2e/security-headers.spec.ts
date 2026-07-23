import { expect, test } from '@playwright/test';

test('normal pages send baseline security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()['content-security-policy']).toBe("frame-ancestors 'self'");
  expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
});

test('campaign embeds remain frameable by third-party sites', async ({ request }) => {
  const response = await request.get('/campaigns/security-header-fixture/embed');
  expect(response.headers()['content-security-policy']).toBe('frame-ancestors *');
  expect(response.headers()['x-frame-options']).toBeUndefined();
});
