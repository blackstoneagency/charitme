import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dedupeAeoEntries, getAeoFallbackRoute, normalizeAeoRoute } from '../lib/aeo';
import robots from '../app/robots';
import { isIndexableSitemapUrl, uniqueSitemapEntries } from '../app/sitemap';
import { isPublicRoute, normalizePublicRoute } from '../lib/public-route-policy';
import { INDEXABLE_PUBLIC_ROUTES } from '../lib/public-routes';
import { countStaleSeoContent, isStaleSeoContent } from '../lib/seo-audit';

describe('AEO route normalization', () => {
  it('normalizes public paths and trailing slashes', () => {
    expect(normalizeAeoRoute(' /pricing/ ')).toBe('/pricing');
    expect(normalizeAeoRoute('//trust-safety')).toBe('/trust-safety');
    expect(normalizePublicRoute('/pricing/')).toBe('/pricing');
    expect(isPublicRoute('/pricing?plan=pro')).toBe(false);
    expect(isPublicRoute('/dashboard')).toBe(false);
  });

  it('falls back safely for private or query-bearing paths', () => {
    expect(normalizeAeoRoute('/admin/users')).toBe('/faq');
    expect(normalizeAeoRoute('/dashboard?tab=campaigns')).toBe('/faq');
    expect(normalizeAeoRoute('/pricing?plan=pro')).toBe('/faq');
    expect(normalizeAeoRoute('/privacy-center')).toBe('/faq');
  });

  it('maps supported detail pages to their Supabase-backed collection answers', () => {
    expect(getAeoFallbackRoute('/campaigns/clean-water')).toBe('/campaigns');
    expect(getAeoFallbackRoute('/blog/fundraising-guide')).toBe('/blog');
    expect(getAeoFallbackRoute('/impact/clean-water')).toBe('/impact');
    expect(getAeoFallbackRoute('/campaigns')).toBeNull();
    expect(getAeoFallbackRoute('/dashboard/campaigns/clean-water')).toBeNull();
  });

  it('removes duplicate published questions before rendering AEO content', () => {
    const entries = [
      { question: 'What fees apply?', answer: 'A', topic: 'Fees', schema_type: 'FAQPage' as const, route: '/faq' },
      { question: ' what fees apply? ', answer: 'B', topic: 'Fees', schema_type: 'FAQPage' as const, route: '/faq' },
      { question: 'What fees apply?', answer: 'C', topic: 'Fees', schema_type: 'QAPage' as const, route: '/faq' },
    ];
    expect(dedupeAeoEntries(entries)).toHaveLength(2);
  });

  it('keeps private routes out of the indexable registry and crawler allowlist', () => {
    const indexedPaths = INDEXABLE_PUBLIC_ROUTES.map((route) => route.path);
    expect(indexedPaths).not.toContain('/achievements');
    expect(indexedPaths).not.toContain('/privacy-center');
    const rules = robots().rules;
    const firstRule = Array.isArray(rules) ? rules[0] : rules;
    const disallowed = firstRule.disallow ?? [];
    expect(disallowed).toContain('/events/manage');
    expect(disallowed).toContain('/offline');
    expect(disallowed).toContain('/go');
    expect(disallowed).toContain('/achievements');
    expect(disallowed).toContain('/privacy-center');
    expect(disallowed).toContain('/dashboard');
    expect(disallowed).toContain('/admin');
    expect(disallowed).toContain('/impact/manage');
    expect(disallowed).toContain('/matching/manage');
    expect(disallowed).toContain('/sponsor/manage');
  });

  it('requires every indexable route to wire SEO metadata and visible AEO content', () => {
    for (const route of INDEXABLE_PUBLIC_ROUTES) {
      const segments = route.path === '/' ? [] : route.path.slice(1).split('/');
      const routeDirectory = resolve(__dirname, '../app', ...segments);
      const candidates = [resolve(routeDirectory, 'page.tsx'), resolve(routeDirectory, 'layout.tsx')];
      const sourcePaths = candidates.filter((candidate) => existsSync(candidate));
      expect(sourcePaths.length, `Missing app entry for ${route.path}`).toBeGreaterThan(0);
      const source = sourcePaths.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');
      expect(source, `Missing Supabase SEO metadata integration for ${route.path}`).toMatch(/seoMetadata/);
      expect(source, `Missing AEO surface for ${route.path}`).toMatch(/AeoContent/);
    }
  });

  it('keeps the Supabase SEO seed aligned with every indexable route', () => {
    const migrationPath = resolve(__dirname, '../../../supabase/migrations/20260722130000_seed_public_seo_settings.sql');
    const migration = readFileSync(migrationPath, 'utf8');
    const seededRoutes = [...migration.matchAll(/^\s+\('([^']+)',/gm)].map((match) => match[1]);
    expect(new Set(seededRoutes)).toEqual(new Set(INDEXABLE_PUBLIC_ROUTES.map((route) => route.path)));
    expect(migration).toContain('og_image_url');
    expect(migration).toContain('canonical_url');
  });

  it('keeps sitemap entries canonical, public, and unique', () => {
    expect(isIndexableSitemapUrl('https://www.charitme.com/campaigns')).toBe(true);
    expect(isIndexableSitemapUrl('https://www.charitme.com/campaigns?category=Medical')).toBe(false);
    expect(isIndexableSitemapUrl('https://www.charitme.com/dashboard')).toBe(false);
    expect(isIndexableSitemapUrl('https://example.com/campaigns')).toBe(false);
    expect(uniqueSitemapEntries([
      { url: 'https://www.charitme.com/faq' },
      { url: 'https://www.charitme.com/faq' },
      { url: 'https://www.charitme.com/faq?topic=fees' },
    ])).toHaveLength(1);
  });

  it('flags content older than the freshness window deterministically', () => {
    const now = Date.parse('2026-07-22T00:00:00.000Z');
    expect(isStaleSeoContent('2026-04-22T00:00:00.000Z', now)).toBe(true);
    expect(isStaleSeoContent('2026-07-01T00:00:00.000Z', now)).toBe(false);
    expect(countStaleSeoContent([{ updated_at: '2026-01-01T00:00:00.000Z' }, { updated_at: null }], now)).toBe(1);
  });
});
