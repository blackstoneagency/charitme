import { describe, expect, it } from 'vitest';
import { calculateTrustScore, getTrustStatus, scoreCampaignQuality } from '../lib/ai-platform';

describe('AI trust engine', () => {
  it('rewards verified trust signals', () => {
    const score = calculateTrustScore({
      identity_verified: true,
      beneficiary_verified: true,
      stripe_onboarded: true,
      description: 'A detailed story. '.repeat(40),
      cover_image_url: 'https://example.com/photo.jpg',
      evidence_count: 2,
      backer_count: 10,
      admin_review_status: 'approved',
      status: 'active',
    });

    expect(score).toBeGreaterThanOrEqual(88);
    expect(getTrustStatus(score)).toBe('Verified');
  });

  it('scores campaign quality deterministically', () => {
    expect(scoreCampaignQuality({
      title: 'Help a family rebuild after flooding',
      story: 'because '.repeat(80),
      goalCents: 500_000,
      hasMedia: true,
    })).toBeGreaterThan(70);
  });
});
