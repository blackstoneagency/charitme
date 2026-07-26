import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/api/marketing/unsubscribe/route.ts'),
  'utf8',
);

describe('unsubscribe endpoint', () => {
  it('rate-limits BOTH handlers, not just POST', () => {
    // Both GET and POST suppress an arbitrary address with no authentication.
    // POST carried a durable limit and GET did not, so the protection was
    // bypassed by switching verb. Limiting one of two identical capabilities
    // bounds nothing.
    const handlers = SRC.split(/export async function /).filter(h => /^(GET|POST)/.test(h));
    expect(handlers, 'expected a GET and a POST handler').toHaveLength(2);
    for (const h of handlers) {
      expect(h, `${h.slice(0, 4).trim()} must rate-limit`).toMatch(/checkRateLimitDurable/);
    }
  });

  it('uses the durable limiter, not the per-instance one', () => {
    // A per-process counter is worth limit x instanceCount on Vercel.
    expect(SRC).not.toMatch(/[^e]checkRateLimit\(/);
  });
});
