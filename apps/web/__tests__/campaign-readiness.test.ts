import { describe, expect, it } from 'vitest';
import { publishReadiness, type ReadinessInput } from '../lib/campaign-readiness';

const complete: ReadinessInput = {
  title: 'Help rebuild the community center',
  description: 'The center needs urgent repairs so local programs can safely reopen.',
  goalCents: 500_000,
  currency: 'USD',
  category: 'Community',
  country: 'United States',
  coverImageUrl: 'https://example.com/cover.jpg',
  forSelf: 'true',
  beneficiaryName: '',
  beneficiaryRelationship: '',
  payoutLinked: true,
  useOfFundsComplete: true,
  organizerComplete: true,
  verificationComplete: true,
  policyAccepted: true,
};

describe('publishReadiness', () => {
  it('marks a complete personal campaign ready', () => {
    const result = publishReadiness(complete);
    expect(result.readyToPublish).toBe(true);
    expect(result.status).toBe('ready_to_publish');
    expect(result.score).toBe(100);
  });

  it('requires every production launch dependency', () => {
    const empty = publishReadiness({
      ...complete,
      title: '', description: '', goalCents: 0, category: '', country: '',
      coverImageUrl: '', forSelf: '', payoutLinked: false,
      useOfFundsComplete: false, organizerComplete: false,
      verificationComplete: false, policyAccepted: false,
    });
    expect(empty.readyToPublish).toBe(false);
    expect(empty.missingRequired.map((item) => item.id)).toEqual([
      'title', 'organizer', 'beneficiary', 'category', 'location', 'goal',
      'plan', 'story', 'media', 'policy', 'payout', 'verification',
    ]);
  });

  it('requires beneficiary name and relationship for another person', () => {
    const result = publishReadiness({ ...complete, forSelf: 'false' });
    expect(result.missingRequired.map((item) => item.id)).toContain('beneficiary');
    expect(publishReadiness({
      ...complete,
      forSelf: 'false',
      beneficiaryName: 'Jordan Lee',
      beneficiaryRelationship: 'Friend',
    }).readyToPublish).toBe(true);
  });

  it('requires verification for every campaign', () => {
    const pending = publishReadiness({ ...complete, verificationComplete: false });
    expect(pending.missingRequired.map((item) => item.id)).toContain('verification');
    expect(publishReadiness({ ...complete, verificationComplete: true }).readyToPublish).toBe(true);
  });

  it('links every item to the screen that can resolve it', () => {
    for (const item of publishReadiness(complete).items) expect(item.step).not.toBe('');
  });

  it('formats goal guidance in the selected campaign currency', () => {
    const result = publishReadiness({ ...complete, goalCents: 0, currency: 'EUR' });
    expect(result.items.find((item) => item.id === 'goal')?.hint).toContain('€1');
  });
});
