import { describe, expect, it } from 'vitest';
import { normalizeAeoRoute } from '../lib/aeo';

describe('AEO route normalization', () => {
  it('normalizes public paths and trailing slashes', () => {
    expect(normalizeAeoRoute(' /pricing/ ')).toBe('/pricing');
    expect(normalizeAeoRoute('//trust-safety')).toBe('/trust-safety');
  });

  it('falls back safely for private or query-bearing paths', () => {
    expect(normalizeAeoRoute('/admin/users')).toBe('/faq');
    expect(normalizeAeoRoute('/dashboard?tab=campaigns')).toBe('/faq');
    expect(normalizeAeoRoute('/pricing?plan=pro')).toBe('/faq');
  });
});
