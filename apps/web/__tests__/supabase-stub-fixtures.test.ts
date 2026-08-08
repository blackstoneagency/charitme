import { describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

type FixtureCampaign = {
  id?: unknown;
  cover_image_url?: unknown;
  slug?: unknown;
  status?: unknown;
  visibility?: unknown;
};

type SavedCampaignFixture = {
  campaign_id?: unknown;
  user_id?: unknown;
};

type CampaignUpdateFixture = {
  body?: unknown;
  campaign_id?: unknown;
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

    if (
      !('saved_campaigns' in fixtures) ||
      !Array.isArray(fixtures.saved_campaigns) ||
      !('campaign_updates' in fixtures) ||
      !Array.isArray(fixtures.campaign_updates)
    ) {
      throw new Error('Supabase stub fixtures do not expose saved causes and campaign updates');
    }

    const campaignIds = new Set(
      (fixtures.campaigns as FixtureCampaign[])
        .map((row) => row.id)
        .filter((value): value is string => typeof value === 'string'),
    );
    const savedCampaigns = fixtures.saved_campaigns as SavedCampaignFixture[];
    expect(savedCampaigns).toHaveLength(12);
    expect(savedCampaigns.every((row) => row.user_id === '00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(savedCampaigns.every((row) => typeof row.campaign_id === 'string' && campaignIds.has(row.campaign_id))).toBe(true);

    const updates = fixtures.campaign_updates as CampaignUpdateFixture[];
    expect(updates.some((row) =>
      row.campaign_id === 'camp0000-0000-4000-8000-000000000001' &&
      typeof row.body === 'string' &&
      row.body.length > 100,
    )).toBe(true);
  }, 15_000);
});
