import { describe, expect, it } from 'vitest';
import { isApprovedDemoSeedSlug } from '../lib/demo-data-core';

describe('demo data candidate recognition', () => {
  it.each([
    'seed-campaign-health-001',
    'seed-campaign-1',
    'campaign-42-1a2b3c4d',
  ])('accepts known seed slug %s', (slug) => {
    expect(isApprovedDemoSeedSlug(slug)).toBe(true);
  });

  it.each([
    'campaign-help-our-school',
    'campaign-42-1A2B3C4D',
    'campaign-42-1a2b3c4d-extra',
    'real-campaign',
  ])('rejects non-seed slug %s', (slug) => {
    expect(isApprovedDemoSeedSlug(slug)).toBe(false);
  });
});
