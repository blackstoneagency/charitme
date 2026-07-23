import { expect, test } from '@playwright/test';

test('normal pages send baseline security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBeLessThan(400);
  const policy = response.headers()['content-security-policy'];
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("frame-ancestors 'self'");
  expect(policy).toMatch(/script-src[^;]*nonce-[^ ;]+/);
  expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(response.headers()['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
});

test('campaign embeds remain frameable by third-party sites', async ({ request }) => {
  const response = await request.get('/campaigns/security-header-fixture/embed');
  const policy = response.headers()['content-security-policy'];
  expect(policy).toContain('frame-ancestors *');
  expect(policy).toMatch(/script-src[^;]*nonce-[^ ;]+/);
  expect(response.headers()['x-frame-options']).toBeUndefined();
});

test('JSON-LD scripts receive the request nonce', async ({ request }) => {
  for (const path of ['/', '/help', '/pricing', '/faq']) {
    const response = await request.get(path);
    expect(response.status(), path).toBeLessThan(400);
    const html = await response.text();
    const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>/g) ?? [];
    expect(scripts.length, path).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script, path).toMatch(/nonce="[^"]+"/);
    }
  }
});

test('representative pages produce no CSP console violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy|refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  for (const path of ['/', '/campaigns', '/campaigns/security-header-fixture/embed']) {
    await page.goto(path, { waitUntil: 'networkidle' });
  }

  expect(violations).toEqual([]);
});
