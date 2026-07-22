import { describe, expect, it } from 'vitest';
import { normalizeAeoRoute } from '../lib/aeo';
import robots from '../app/robots';
import { INDEXABLE_PUBLIC_ROUTES } from '../lib/public-routes';

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

  it('keeps private routes out of the indexable registry and crawler allowlist', () => {
    const indexedPaths = INDEXABLE_PUBLIC_ROUTES.map((route) => route.path);
    expect(indexedPaths).not.toContain('/achievements');
    expect(indexedPaths).not.toContain('/privacy-center');
    const rules = robots().rules;
    const firstRule = Array.isArray(rules) ? rules[0] : rules;
    const disallowed = firstRule.disallow ?? [];
    expect(disallowed).toContain('/events/manage');
    expect(disallowed).toContain('/impact/manage');
    expect(disallowed).toContain('/matching/manage');
    expect(disallowed).toContain('/sponsor/manage');
  });
});
