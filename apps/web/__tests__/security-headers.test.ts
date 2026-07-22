import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('content security policy contract', () => {
  const middleware = readFileSync(resolve(__dirname, '../middleware.ts'), 'utf8');
  const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8');
  const aeo = readFileSync(resolve(__dirname, '../components/AeoContent.tsx'), 'utf8');

  it('creates a request nonce and sends a restrictive CSP with required providers', () => {
    expect(middleware).toContain("const nonce = btoa(crypto.randomUUID());");
    expect(middleware).toContain("requestHeaders.set('x-nonce', nonce);");
    expect(middleware).toContain("script-src 'self' 'nonce-${nonce}' 'strict-dynamic'");
    expect(middleware).toContain("connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.stripe.com");
    expect(middleware).toContain("object-src 'none'");
  });

  it('preserves the third-party campaign embed framing exception', () => {
    expect(middleware).toContain('`frame-ancestors ${isEmbed ? \'*\' : "\'self\'"}`');
    expect(middleware).toContain("response.headers.delete('X-Frame-Options');");
  });

  it('propagates the nonce to application and AEO inline scripts', () => {
    expect(layout).toContain("(await headers()).get('x-nonce')");
    expect(layout).toContain('<script nonce={nonce}');
    expect(aeo).toContain('<script key={index} nonce={nonce}');
  });
});
