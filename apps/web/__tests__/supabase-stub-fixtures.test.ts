import { describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

type FixtureCampaign = {
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
  }, 15_000);
});
