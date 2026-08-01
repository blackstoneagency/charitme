import { describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

type FixtureCampaign = {
  cover_image_url?: unknown;
  slug?: unknown;
  status?: unknown;
  visibility?: unknown;
};

describe('Supabase browser-audit fixtures', () => {
  it('provides the public campaign used by the embed audit route', async () => {
    const fixtureUrl = pathToFileURL(
      path.join(__dirname, '..', 'scripts', 'supabase-stub-fixtures.mjs'),
    ).href;
    const fixtureModule: unknown = await import(fixtureUrl);

    expect(fixtureModule).toBeTypeOf('object');
    if (
      fixtureModule === null ||
      typeof fixtureModule !== 'object' ||
      !('buildFixtures' in fixtureModule) ||
      typeof fixtureModule.buildFixtures !== 'function'
    ) {
      throw new Error('Supabase stub fixture module does not export buildFixtures');
    }

    const fixtures: unknown = fixtureModule.buildFixtures();
    expect(fixtures).toBeTypeOf('object');
    if (
      fixtures === null ||
      typeof fixtures !== 'object' ||
      !('campaigns' in fixtures) ||
      !Array.isArray(fixtures.campaigns)
    ) {
      throw new Error('Supabase stub fixtures do not expose campaign rows');
    }

    const campaign = (fixtures.campaigns as FixtureCampaign[]).find(
      (row) => row.slug === 'security-header-fixture',
    );

    expect(campaign).toMatchObject({
      slug: 'security-header-fixture',
      status: 'active',
      visibility: 'public',
    });

    const coverUrls = (fixtures.campaigns as FixtureCampaign[])
      .map((row) => row.cover_image_url)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    expect(new Set(coverUrls).size).toBe(coverUrls.length);
  }, 15_000);
});
