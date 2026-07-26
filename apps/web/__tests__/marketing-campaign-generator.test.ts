import { describe, it, expect } from 'vitest';
import { generateCampaignPlan } from '../lib/marketing-campaign-generator';

describe('generateCampaignPlan', () => {
  const goal = {
    title: 'Grow education fundraisers in New Jersey',
    objective: 'Increase education fundraiser starts by 15% in New Jersey',
    category: 'Education',
    geography: 'New Jersey',
    audience: 'Parents & alumni',
    target_metric: 'fundraiser_starts',
  };

  it('produces a connected multichannel asset set', () => {
    const { plan, assets } = generateCampaignPlan(goal);
    const types = assets.map((a) => a.asset_type);
    expect(types).toContain('landing_page');
    expect(types).toContain('email');
    expect(types).toContain('seo_meta');
    expect(types).toContain('faq');
    expect(assets.filter((a) => a.asset_type === 'social_post').length).toBeGreaterThanOrEqual(3);
    expect(plan.title).toContain(goal.title);
    expect(plan.category).toBe('Education');
  });

  it('threads goal context (geography, category, audience) into the copy', () => {
    const { assets } = generateCampaignPlan(goal);
    const blob = assets.map((a) => `${a.title}\n${a.body}`).join('\n').toLowerCase();
    expect(blob).toContain('new jersey');
    expect(blob).toContain('education');
    expect(blob).toContain('parents');
  });

  it('assigns a unique, ordered sort_order to every asset', () => {
    const { assets } = generateCampaignPlan(goal);
    const orders = assets.map((a) => a.sort_order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('is brand-safe — no guarantees or tax-deductibility claims', () => {
    const blob = generateCampaignPlan(goal).assets.map((a) => a.body).join(' ').toLowerCase();
    expect(blob).not.toMatch(/guarantee|tax[- ]deductible|100% of|no fees/);
  });

  it('handles a bare goal with no category/geography/audience', () => {
    const { plan, assets } = generateCampaignPlan({ title: 'Raise more money' });
    expect(assets.length).toBeGreaterThanOrEqual(6);
    expect(plan.title).toContain('Raise more money');
  });
});
