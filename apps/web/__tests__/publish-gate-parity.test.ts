import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLISH_MIN_GOAL_CENTS,
  PUBLISH_MIN_STORY_CHARS,
  publishReadiness,
  type ReadinessInput,
} from '../lib/campaign-readiness';

const complete: ReadinessInput = {
  title: 'A real campaign title', description: 'x'.repeat(PUBLISH_MIN_STORY_CHARS),
  goalCents: PUBLISH_MIN_GOAL_CENTS, category: 'Medical', country: 'United States',
  coverImageUrl: 'https://example.com/c.jpg', forSelf: 'true', beneficiaryName: '',
  beneficiaryRelationship: '', payoutLinked: true, useOfFundsComplete: true,
  organizerComplete: true, verificationComplete: true,
  policyAccepted: true,
};

describe('client and server launch gates', () => {
  const route = readFileSync(join(__dirname, '..', 'app', 'api', 'campaigns', 'route.ts'), 'utf8');

  it('shares story and goal boundaries', () => {
    expect(publishReadiness(complete).readyToPublish).toBe(true);
    expect(publishReadiness({ ...complete, description: 'short' }).readyToPublish).toBe(false);
    expect(publishReadiness({ ...complete, goalCents: 99 }).readyToPublish).toBe(false);
    expect(route).toContain('PUBLISH_MIN_STORY_CHARS');
    expect(route).toContain('PUBLISH_MIN_GOAL_CENTS');
  });

  it('enforces media, budget, policy, payout, organizer, and verification server-side', () => {
    expect(route).toContain("path: ['useOfFunds']");
    expect(route).toContain("path: ['coverImageUrl']");
    expect(route).toContain("path: ['policyAccepted']");
    expect(route).toContain("code: 'PAYOUT_NOT_READY'");
    expect(route).toContain("code: 'ORGANIZER_INCOMPLETE'");
    expect(route).toContain("code: 'IDENTITY_VERIFICATION_REQUIRED'");
    expect(route).toContain("code: 'VERIFICATION_REQUIRED'");
  });

  it('uses one atomic database function for the campaign graph', () => {
    expect(route).toContain("rpc('create_campaign_from_builder'");
    expect(route).not.toContain(".from('campaigns')\n        .insert");
  });
});
