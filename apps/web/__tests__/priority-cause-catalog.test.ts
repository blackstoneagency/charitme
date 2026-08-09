import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCause } from '../lib/causes';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const migration = read('../../supabase/migrations/20260831000000_seed_priority_cause_catalogs.sql');
const rollback = read('../../supabase/rollbacks/20260831000000_rollback_seed_priority_cause_catalogs.sql');
const page = read('app/causes/[slug]/page.tsx');
const card = read('components/CampaignCard.tsx');
const detail = read('app/campaigns/[slug]/(detail)/page.tsx');
const sitemap = read('app/sitemap.ts');

const prioritySlugs = ['health-wellness', 'education', 'faith-belief'] as const;

describe('priority cause content', () => {
  it.each(prioritySlugs)('%s has five unique fallback answers', (slug) => {
    const cause = getCause(slug);
    expect(cause?.faqs).toHaveLength(5);
    expect(new Set(cause?.faqs?.map((faq) => faq.question.toLowerCase())).size).toBe(5);
    expect(cause?.intro?.length).toBeGreaterThan(50);
    expect(cause?.helps).toHaveLength(5);
  });

  it('uses one Supabase answer source for visible copy and FAQPage schema', () => {
    expect(page).toContain('getPublishedAeoEntries(`/causes/${cause.slug}`');
    expect(page).toContain("'@type': 'FAQPage'");
    expect(page).toContain('faqs.map((faq, index)');
  });

  it('publishes complete search metadata and canonical URLs', () => {
    for (const marker of ['keywords:', 'alternates: { canonical }', 'openGraph:', 'twitter:', 'robots:']) {
      expect(page).toContain(marker);
    }
  });
});

describe('priority cause production catalog migration', () => {
  it('creates exactly 50 deterministic examples for each priority category', () => {
    expect(migration).toContain('cross join generate_series(1, 50)');
    expect(migration).toContain("array['Medical', 'Education', 'Faith']");
    expect(migration).toContain('if row_count <> 50 then');
    expect(migration).toContain('uuid_generate_v5(');
    expect(migration).toContain('on conflict (id) do nothing');
  });

  it('cannot fabricate donations, verification, paid placement, or trust', () => {
    for (const marker of [
      "'Needs More Info'",
      'raised_amount <> 0',
      'backer_count <> 0',
      'or accept_donations',
      'or nonprofit_verified',
      'or featured',
      'or pinned',
      'not is_demo',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  it('seeds five published route-specific FAQs per cause and verifies all 15', () => {
    for (const slug of prioritySlugs) {
      expect(migration.match(new RegExp(`/causes/${slug}`, 'g'))?.length).toBeGreaterThanOrEqual(6);
    }
    expect(migration).toContain('<> 15 then');
    expect(migration).toContain("'FAQPage'");
  });

  it('has a rollback that removes only its deterministic catalog data', () => {
    expect(rollback).toContain("'30000000-0000-4000-8000-000000000001'::uuid");
    expect(rollback).toContain("slug like 'charitme-example-%'");
    expect(rollback).toContain('uuid_generate_v5(');
    expect(rollback).not.toContain('truncate');
  });
});

describe('example campaigns are transparent on every public surface', () => {
  it('selects the demo flag wherever campaign cards are populated', () => {
    for (const path of [
      'app/api/campaigns/route.ts',
      'app/campaigns/(list)/page.tsx',
      'app/causes/[slug]/page.tsx',
      'app/search/page.tsx',
      'app/supporter-space/page.tsx',
    ]) {
      expect(read(path), `${path} must select is_demo`).toContain('is_demo');
    }
  });

  it('labels demo cards and suppresses verification claims', () => {
    expect(card).toContain('DEMO_BADGE_LABEL');
    expect(card).toContain('const isVerified = !isDemo');
    expect(card).toContain('!isDemo && c.nonprofit_verified');
  });

  it('keeps example detail pages out of search results', () => {
    expect(detail).toContain('const isDemo = isDemoCampaign(campaign');
    expect(detail).toContain('index: false, follow: true');
    expect(sitemap).toContain(".eq('is_demo', false)");
    expect(page).toContain('visibleCampaigns.filter((campaign) => campaign.is_demo !== true)');
  });
});
