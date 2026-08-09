import { describe, expect, it } from 'vitest';
import { AiCampaignResponseSchema, fallbackAiCampaign, type AiCampaignRequest } from '../lib/openai';
import { readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────────
// The "Build with AI" path (/ai-campaign → /create?ai=<prompt>) relies on the
// AI campaign endpoint ALWAYS returning complete, reviewable content — even with
// no OpenAI key configured — via fallbackAiCampaign(). These tests lock that
// contract so the AI builder never drops the organizer into an empty draft.
// ─────────────────────────────────────────────────────────────────────────────

const base: AiCampaignRequest = {
  category: 'Medical',
  goalAmount: 500000,
  currency: 'USD',
  beneficiary: 'Sarah',
  notes: 'My neighbor’s house burned down and they need help replacing clothes and furniture.',
  tone: 'authentic',
};

describe('fallbackAiCampaign', () => {
  it('returns a complete, non-empty campaign draft', () => {
    const r = fallbackAiCampaign(base);
    expect(r.title.trim().length).toBeGreaterThan(0);
    expect(r.summary.trim().length).toBeGreaterThan(0);
    expect(r.story.trim().length).toBeGreaterThan(20);
    expect(r.socialCaption.trim().length).toBeGreaterThan(0);
    expect(r.longPost.trim().length).toBeGreaterThan(0);
    expect(r.sms.trim().length).toBeGreaterThan(0);
    expect(r.email.trim().length).toBeGreaterThan(0);
    expect(AiCampaignResponseSchema.safeParse(r).success).toBe(true);
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
      expect(tier.amountCents).toBeGreaterThan(0);
      expect(tier.label.trim().length).toBeGreaterThan(0);
    }
    const amounts = r.donationTiers.map(t => t.amountCents);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it('surfaces actionable trust signals and FAQs', () => {
    const r = fallbackAiCampaign(base);
    expect(r.donorFaq.length).toBeGreaterThan(0);
    expect(r.donorFaq.every((faq) => faq.question && faq.answer)).toBe(true);
    expect(r.useOfFunds.reduce((sum, item) => sum + item.amountCents, 0)).toBe(r.suggestedGoalCents);
    expect(r.milestones.at(-1)?.targetCents).toBe(r.suggestedGoalCents);
    expect(r.missingTrustSignals.length).toBeGreaterThan(0);
    expect(r.qualityScore).toBeGreaterThanOrEqual(0);
    expect(r.qualityScore).toBeLessThanOrEqual(100);
  });

  it('stays robust with empty/degenerate input', () => {
    const r = fallbackAiCampaign({ category: 'Community', goalAmount: 50, beneficiary: '', notes: '' });
    expect(r.title.trim().length).toBeGreaterThan(0);
    expect(r.story.trim().length).toBeGreaterThan(0);
    // A tiny cent value is floored to the API's $1.00 minimum.
    expect(r.longPost).toContain('$1.00');
  });

  it('keeps fallback copy publishable for long names and non-USD campaigns', () => {
    const r = fallbackAiCampaign({
      ...base,
      beneficiary: 'A'.repeat(120),
      currency: 'EUR',
    });
    expect(AiCampaignResponseSchema.safeParse(r).success).toBe(true);
    expect(r.title.length).toBeLessThanOrEqual(100);
    expect(r.summary.length).toBeLessThanOrEqual(160);
    expect(r.longPost).toContain('€5,000.00');
  });
});

describe('AI campaign route output contract', () => {
  it('requests strict schema output and records fallback truthfully', () => {
    const source = readFileSync(new URL('../app/api/ai/campaign/route.ts', import.meta.url), 'utf8');
    expect(source).toContain("zodTextFormat(AiCampaignResponseSchema, 'campaign_draft')");
    expect(source).toContain("let modelUsed = 'fallback'");
    expect(source).toContain('model: modelUsed');
  });
});
