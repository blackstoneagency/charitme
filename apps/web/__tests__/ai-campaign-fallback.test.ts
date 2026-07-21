import { describe, expect, it } from 'vitest';
import { fallbackAiCampaign, type AiCampaignRequest } from '../lib/openai';

// ─────────────────────────────────────────────────────────────────────────────
// The "Build with AI" path (/ai-campaign → /create?ai=<prompt>) relies on the
// AI campaign endpoint ALWAYS returning complete, reviewable content — even with
// no OpenAI key configured — via fallbackAiCampaign(). These tests lock that
// contract so the AI builder never drops the organizer into an empty draft.
// ─────────────────────────────────────────────────────────────────────────────

const base: AiCampaignRequest = {
  category: 'Medical',
  goalAmount: 500000,
  beneficiary: 'Sarah',
  notes: 'My neighbor’s house burned down and they need help replacing clothes and furniture.',
  tone: 'authentic',
};

describe('fallbackAiCampaign', () => {
  it('returns a complete, non-empty campaign draft', () => {
    const r = fallbackAiCampaign(base);
    expect(r.title.trim().length).toBeGreaterThan(0);
    expect(r.story.trim().length).toBeGreaterThan(20);
    expect(r.socialCaption.trim().length).toBeGreaterThan(0);
    expect(r.longPost.trim().length).toBeGreaterThan(0);
    expect(r.sms.trim().length).toBeGreaterThan(0);
    expect(r.email.trim().length).toBeGreaterThan(0);
  });

  it('carries the organizer prompt through into the generated story', () => {
    const r = fallbackAiCampaign(base);
    // The story must incorporate the user's own words so the AI path never
    // discards the prompt they typed on /ai-campaign.
    expect(r.story).toContain(base.notes);
    expect(r.title).toContain('Sarah');
  });

  it('produces valid, positive, ascending donation tiers', () => {
    const r = fallbackAiCampaign(base);
    expect(r.donationTiers.length).toBeGreaterThanOrEqual(3);
    for (const tier of r.donationTiers) {
      expect(tier.amount).toBeGreaterThan(0);
      expect(tier.label.trim().length).toBeGreaterThan(0);
    }
    const amounts = r.donationTiers.map(t => t.amount);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it('surfaces actionable trust signals and FAQs', () => {
    const r = fallbackAiCampaign(base);
    expect(r.donorFaq.length).toBeGreaterThan(0);
    expect(r.missingTrustSignals.length).toBeGreaterThan(0);
    expect(r.qualityScore).toBeGreaterThanOrEqual(0);
    expect(r.qualityScore).toBeLessThanOrEqual(100);
  });

  it('stays robust with empty/degenerate input', () => {
    const r = fallbackAiCampaign({ category: '', goalAmount: 50, beneficiary: '', notes: '' });
    expect(r.title.trim().length).toBeGreaterThan(0);
    expect(r.story.trim().length).toBeGreaterThan(0);
    // A tiny goal is floored to the $100 minimum rather than shown as-is.
    expect(r.longPost).toContain('$100');
  });
});
