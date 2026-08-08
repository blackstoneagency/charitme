import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEMO_BADGE_EXPLANATION,
  DEMO_BADGE_LABEL,
  isDemoCampaign,
} from '../lib/demo-campaign';

describe('isDemoCampaign', () => {
  it('is true only for an explicit boolean true', () => {
    expect(isDemoCampaign({ is_demo: true })).toBe(true);
  });

  it('is false for a row that is not flagged', () => {
    expect(isDemoCampaign({ is_demo: false })).toBe(false);
  });

  it('is false when the column does not exist yet', () => {
    // The migration is unapplied, so `select('*')` returns rows without the key.
    // This is the state the site is in RIGHT NOW — it must render no badge.
    expect(isDemoCampaign({})).toBe(false);
    expect(isDemoCampaign({ is_demo: undefined })).toBe(false);
    expect(isDemoCampaign({ is_demo: null })).toBe(false);
  });

  it('is false for a null or missing row', () => {
    expect(isDemoCampaign(null)).toBe(false);
    expect(isDemoCampaign(undefined)).toBe(false);
  });

  it('never marks a REAL campaign as fake on a truthy non-boolean', () => {
    // The migration says a wrong guess mislabelling a real fundraiser is worse
    // than no label at all. These rows pass through select('*') and loose casts,
    // so a stray string must not be treated as truthy.
    for (const value of ['false', 'true', '0', '1', 1, 'yes', {}, []]) {
      expect(isDemoCampaign({ is_demo: value }), `is_demo=${JSON.stringify(value)}`).toBe(false);
    }
  });
});

describe('badge copy', () => {
  it('says plainly that it is not a real fundraiser', () => {
    expect(DEMO_BADGE_EXPLANATION.toLowerCase()).toContain('not a real fundraiser');
  });

  it('does not hedge with words a donor would skim past', () => {
    // "sample data" or "test" invite a reader to assume it is still a real cause.
    expect(DEMO_BADGE_LABEL.toLowerCase()).toContain('demo');
  });
});

describe('the campaign page actually renders it', () => {
  const source = readFileSync(
    join(__dirname, '..', 'app', 'campaigns', '[slug]', '(detail)', 'page.tsx'),
    'utf8',
  );

  it('imports and calls the reader', () => {
    // Guards against the exact failure this fixes: a column that exists, a
    // migration that is applied, and no code that looks at either.
    expect(source).toContain('isDemoCampaign');
    expect(source).toContain('DEMO_BADGE_LABEL');
  });

  it('renders the badge conditionally, not unconditionally', () => {
    expect(source).toMatch(/isDemo\s*&&/);
  });
});
