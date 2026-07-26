import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  publishReadiness,
  PUBLISH_MIN_TITLE_CHARS,
  PUBLISH_MIN_STORY_CHARS,
  PUBLISH_MIN_GOAL_CENTS,
  type ReadinessInput,
} from '../lib/campaign-readiness';

// `campaign-readiness.ts` promises in its header that its `required` items
// "mirror EXACTLY what POST /api/campaigns enforces to publish". That claim was
// false: the API schema allowed description ≥ 1 char and goalAmount ≥ 1 cent for
// status='active', so a crafted request could publish a live, publicly-indexed,
// donatable campaign with a one-character story and a $0.01 goal — bypassing the
// wizard. These tests lock the contract shut from both sides.

const base: ReadinessInput = {
  title: 'A real campaign title',
  description: 'x'.repeat(PUBLISH_MIN_STORY_CHARS),
  goalCents: PUBLISH_MIN_GOAL_CENTS,
  category: 'Medical',
  country: 'US',
  coverImageUrl: 'https://example.com/c.jpg',
  forSelf: 'true',
  beneficiaryName: '',
  payoutLinked: true,
};

describe('publish minimums are a single source of truth', () => {
  it('exposes the thresholds the wizard and API both use', () => {
    expect(PUBLISH_MIN_TITLE_CHARS).toBe(3);
    expect(PUBLISH_MIN_STORY_CHARS).toBe(20);
    expect(PUBLISH_MIN_GOAL_CENTS).toBe(100);
  });

  it('blocks publishing exactly at the boundary for each required field', () => {
    expect(publishReadiness(base).readyToPublish).toBe(true);

    const shortStory = { ...base, description: 'x'.repeat(PUBLISH_MIN_STORY_CHARS - 1) };
    expect(publishReadiness(shortStory).readyToPublish).toBe(false);
    expect(publishReadiness(shortStory).missingRequired.map((i) => i.id)).toContain('story');

    const lowGoal = { ...base, goalCents: PUBLISH_MIN_GOAL_CENTS - 1 };
    expect(publishReadiness(lowGoal).readyToPublish).toBe(false);
    expect(publishReadiness(lowGoal).missingRequired.map((i) => i.id)).toContain('goal');

    const shortTitle = { ...base, title: 'ab' };
    expect(publishReadiness(shortTitle).readyToPublish).toBe(false);
    expect(publishReadiness(shortTitle).missingRequired.map((i) => i.id)).toContain('title');
  });

  it('a zero goal (an unset draft) is not publishable', () => {
    expect(publishReadiness({ ...base, goalCents: 0 }).readyToPublish).toBe(false);
  });
});

// Source-level assertions: the API route is a server module that pulls in
// Supabase/next-server at import time, so rather than booting it we assert the
// enforcement is present and wired to the shared constants. This fails loudly if
// anyone reintroduces the bypass or hardcodes a divergent literal.
describe('POST /api/campaigns enforces the publish gate server-side', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'api', 'campaigns', 'route.ts'), 'utf8');

  it('imports the shared minimums rather than hardcoding its own', () => {
    expect(src).toMatch(/import\s*\{[^}]*PUBLISH_MIN_STORY_CHARS[^}]*\}\s*from\s*['"].*campaign-readiness['"]/);
    expect(src).toContain('PUBLISH_MIN_GOAL_CENTS');
  });

  it('gates the story and goal minimums on status === active', () => {
    expect(src).toContain('superRefine');
    expect(src).toMatch(/v\.status\s*!==\s*'active'/);
    expect(src).toMatch(/description\.trim\(\)\.length\s*<\s*PUBLISH_MIN_STORY_CHARS/);
    expect(src).toMatch(/goalAmount\s*<\s*PUBLISH_MIN_GOAL_CENTS/);
  });

  it('still allows a draft to carry no goal (0) instead of a fabricated $1', () => {
    expect(src).toMatch(/goalAmount:\s*z\.number\(\)\.int\(\)\.min\(0\)/);
  });
});
