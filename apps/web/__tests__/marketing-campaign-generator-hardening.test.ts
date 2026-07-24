import { describe, it, expect } from 'vitest';
import {
  generateCampaignPlan,
  fitSeo,
  SEO_TITLE_MAX,
  SEO_DESCRIPTION_MAX,
  type GoalLike,
} from '../lib/marketing-campaign-generator';

// Hardening pass for the goal → multichannel campaign generator: edge-case and
// production-safety coverage complementing the happy-path suite. Guards the
// search-result length limits and the brand-safety claims the generator promises
// in its own header comment (no guarantees, no fee/tax claims, no fabricated stats).

const seo = (g: GoalLike) => generateCampaignPlan(g).assets.find((a) => a.asset_type === 'seo_meta')!;

describe('fitSeo', () => {
  it('returns the first candidate that fits', () => {
    expect(fitSeo(['short', 'shorter'], 10)).toBe('short');
  });

  it('sheds optional detail when the richer candidate is too long', () => {
    expect(fitSeo(['a very long detailed variant', 'short one'], 12)).toBe('short one');
  });

  it('clamps at a word boundary when even the shortest candidate overflows', () => {
    const out = fitSeo(['Supercalifragilistic Expialidocious Fundraising Campaign'], 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('never exceeds the limit for any input', () => {
    for (const max of [10, 20, 60, 160]) {
      for (const s of ['x'.repeat(500), 'word '.repeat(80), '']) {
        expect(fitSeo([s], max).length).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe('generated SEO metadata respects search-result limits', () => {
  it('fits a long geography + audience (previously overflowed to 85/189 chars)', () => {
    const a = seo({
      title: 'Grow community fundraisers',
      category: 'Community',
      geography: 'the Greater Philadelphia Metropolitan Area',
      audience: 'Parents, alumni, and corporate giving partners',
    });
    expect((a.meta.seo_title as string).length).toBeLessThanOrEqual(SEO_TITLE_MAX);
    expect((a.meta.seo_description as string).length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
  });

  it('holds the limits across a range of goal shapes', () => {
    const goals: GoalLike[] = [
      { title: 'G' },
      { title: 'G', category: 'Medical' },
      { title: 'G', category: 'Environment', geography: 'New Jersey' },
      { title: 'G', category: 'Education', geography: 'San Francisco Bay Area', audience: 'School district partners and PTA leaders' },
      { title: 'G', category: 'X'.repeat(80), geography: 'Y'.repeat(80), audience: 'Z'.repeat(80) },
    ];
    for (const g of goals) {
      const a = seo(g);
      expect((a.meta.seo_title as string).length).toBeLessThanOrEqual(SEO_TITLE_MAX);
      expect((a.meta.seo_description as string).length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
    }
  });

  it('keeps the SEO body in sync with its meta fields', () => {
    const a = seo({ title: 'G', category: 'Animal', geography: 'Denver' });
    expect(a.body).toContain(a.meta.seo_title as string);
    expect(a.body).toContain(a.meta.seo_description as string);
  });
});

describe('generator edge cases', () => {
  it('is safe for a bare goal (title only)', () => {
    const { plan, assets } = generateCampaignPlan({ title: 'Raise more' });
    expect(assets).toHaveLength(7);
    expect(plan.objective).toBe('Raise more');
    for (const a of assets) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.body.length).toBeGreaterThan(0);
      expect(a.body).not.toContain('undefined');
      expect(a.body).not.toContain('null');
      expect(a.body).not.toContain('NaN');
    }
  });

  it('treats an empty-string audience as absent rather than crashing', () => {
    // The audience is capitalised via audience[0] — an empty string must fall back.
    expect(() => generateCampaignPlan({ title: 'G', audience: '' })).not.toThrow();
    const { assets } = generateCampaignPlan({ title: 'G', audience: '' });
    const social = assets.find((a) => a.meta.variant === 'audience')!;
    expect(social.body.startsWith('Organizers and donors')).toBe(true);
  });

  it('is deterministic — the same goal always yields the same plan', () => {
    const g: GoalLike = { title: 'G', category: 'Faith', geography: 'Austin', audience: 'Congregations' };
    expect(generateCampaignPlan(g)).toEqual(generateCampaignPlan(g));
  });

  it('assigns unique, gapless sort_order values', () => {
    const orders = generateCampaignPlan({ title: 'G' }).assets.map((a) => a.sort_order);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('drops a null geography from SEO keywords (no null in the array)', () => {
    const a = seo({ title: 'G', category: 'Sports' });
    expect(a.meta.keywords as string[]).not.toContain(null);
    expect((a.meta.keywords as string[]).every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
  });
});

describe('brand safety — the guarantees the generator claims in its own header', () => {
  const bodies = (g: GoalLike) => generateCampaignPlan(g).assets.map((a) => a.body).join('\n');

  it('makes no outcome guarantees or fabricated statistics', () => {
    const text = bodies({ title: 'G', category: 'Medical', geography: 'Ohio', audience: 'Patients' }).toLowerCase();
    for (const claim of ['guarantee', 'guaranteed', 'we promise', 'risk-free', '% of donors', 'studies show', 'proven to']) {
      expect(text).not.toContain(claim);
    }
  });

  it('makes no fee or tax-deductibility claims (compliance-sensitive)', () => {
    const text = bodies({ title: 'G', category: 'Nonprofit' }).toLowerCase();
    for (const claim of ['tax-deductible', 'tax deductible', 'write-off', '0% fee', 'no fees', 'fee-free']) {
      expect(text).not.toContain(claim);
    }
  });

  it('keeps the required unsubscribe token in the email asset (CAN-SPAM)', () => {
    const email = generateCampaignPlan({ title: 'G' }).assets.find((a) => a.asset_type === 'email')!;
    expect(email.body).toContain('{{unsubscribe_url}}');
  });
});
