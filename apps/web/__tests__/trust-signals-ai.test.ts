import { describe, it, expect } from 'vitest';
import {
  getTrustSignals,
  getTrustLabel,
  getTrustStatus,
  type CampaignTrustInput,
} from '../lib/ai-platform';

// Covers the ai-platform helpers not exercised by trust.test.ts:
// getTrustSignals() and getTrustLabel().

const empty: CampaignTrustInput = {};

describe('getTrustSignals', () => {
  it('returns the five fixed pillars in order', () => {
    const labels = getTrustSignals(empty).map((s) => s.label);
    expect(labels).toEqual(['Identity', 'Beneficiary', 'Payout destination', 'Story quality', 'Evidence']);
  });

  it('marks everything pending/watch for an empty campaign', () => {
    const byLabel = Object.fromEntries(getTrustSignals(empty).map((s) => [s.label, s.state]));
    expect(byLabel['Identity']).toBe('pending');
    expect(byLabel['Beneficiary']).toBe('pending');
    expect(byLabel['Payout destination']).toBe('pending');
    expect(byLabel['Story quality']).toBe('watch');
    expect(byLabel['Evidence']).toBe('pending');
  });

  it('flips signals to verified when the inputs are present', () => {
    const full: CampaignTrustInput = {
      identity_verified: true,
      beneficiary_verified: true,
      stripe_onboarded: true,
      description: 'x'.repeat(280),
      evidence_count: 2,
    };
    const states = getTrustSignals(full).map((s) => s.state);
    expect(states.every((s) => s === 'verified')).toBe(true);
  });

  it('treats a cover image alone as evidence', () => {
    const sig = getTrustSignals({ cover_image_url: 'https://x/y.jpg' }).find((s) => s.label === 'Evidence');
    expect(sig?.state).toBe('verified');
  });

  it('story just under the 280 threshold stays "watch"', () => {
    const sig = getTrustSignals({ description: 'x'.repeat(279) }).find((s) => s.label === 'Story quality');
    expect(sig?.state).toBe('watch');
  });

  it('every signal has a non-empty human-readable detail', () => {
    for (const s of getTrustSignals(empty)) {
      expect(s.detail.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('getTrustLabel', () => {
  it('mirrors getTrustStatus for non-review scores', () => {
    for (const score of [0, 50, 69, 70, 87, 88, 99]) {
      expect(getTrustLabel(score)).toBe(getTrustStatus(score));
    }
  });

  it('returns the expected band labels', () => {
    expect(getTrustLabel(95)).toBe('Verified');
    expect(getTrustLabel(75)).toBe('Strong Trust');
    expect(getTrustLabel(40)).toBe('Needs More Info');
  });
});
