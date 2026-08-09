import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAMPAIGN_STEPS, normalizeStep, type CampaignStep } from '../lib/campaign-flow-core';
import {
  publishReadiness,
  PUBLISH_MIN_TITLE_CHARS,
  PUBLISH_MIN_STORY_CHARS,
  PUBLISH_MIN_GOAL_CENTS,
} from '../lib/campaign-readiness';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const builder = read('app/create/page.tsx');
const css = read('app/globals.css');

const base = {
  title: 'A campaign title',
  description: 'A story comfortably past the twenty character minimum for publishing.',
  goalCents: 500_000,
  category: '',
  country: '',
  coverImageUrl: '',
  forSelf: '',
  beneficiaryName: '',
  payoutLinked: false,
};

/**
 * The flow's central friction was that the publish GATE and the publish PATH
 * disagreed. The gate wants three things; the builder walked people through six
 * more screens before offering the button. These tests pin the agreement.
 */
describe('the publish gate really is only three things', () => {
  it('a title, a story and a goal are enough — nothing else is required', () => {
    const r = publishReadiness(base);
    expect(r.readyToPublish).toBe(true);
    expect(r.missingRequired).toEqual([]);
  });

  it('category, location, beneficiary, cover and payout are recommendations', () => {
    // If any of these ever becomes required, the "Publish now" button starts
    // lying about what the server will accept — so this is pinned, not assumed.
    const required = publishReadiness(base).items.filter((i) => i.required).map((i) => i.step);
    expect(new Set(required)).toEqual(new Set(['title', 'story', 'goal']));
  });

  it('is not satisfiable with less', () => {
    // Guards the guard: without this, `readyToPublish` could be hardcoded true
    // and every assertion above would still pass.
    expect(publishReadiness({ ...base, title: 'x'.repeat(PUBLISH_MIN_TITLE_CHARS - 1) }).readyToPublish).toBe(false);
    expect(publishReadiness({ ...base, description: 'x'.repeat(PUBLISH_MIN_STORY_CHARS - 1) }).readyToPublish).toBe(false);
    expect(publishReadiness({ ...base, goalCents: PUBLISH_MIN_GOAL_CENTS - 1 }).readyToPublish).toBe(false);
  });
});

describe('the builder offers publishing as soon as it is possible', () => {
  it('computes readiness once, for every step', () => {
    // It used to be computed inline on the review step only, which is exactly
    // why the button could not exist anywhere else. One computation also means
    // the checklist and the button can never disagree.
    expect(builder.match(/publishReadiness\(\{/g)?.length).toBe(1);
    expect(builder).toContain('const readiness = publishReadiness({');
    expect(builder).toContain('readiness={readiness}');
  });

  it('shows the publish control exactly when the draft is publishable', () => {
    expect(builder).toContain("{readiness.readyToPublish && step !== 'review' && !CAMPAIGN_STEP_META[step].postPublish && (");
  });

  it('never offers it after the campaign is already live', () => {
    // publish/share are postPublish steps. Offering "Publish now" there would
    // invite a second campaign from someone who has already made one.
    expect(builder).toContain('!CAMPAIGN_STEP_META[step].postPublish');
  });

  it('gates guests the same way the review step does', () => {
    const guarded = builder.match(
      /if \(isGuest !== false\) \{ setLoginIntent\('publish'\); setShowLoginModal\(true\); \} else \{ void publish\(\); \}/g,
    ) ?? [];
    // Review's launch button, the review-pane button, and now this one.
    expect(guarded.length).toBeGreaterThanOrEqual(3);
  });

  it('is actually styled — an unstyled button is a silent no-op', () => {
    // This repo has shipped a control whose class had no rule and rendered as a
    // default grey box. The class is asserted at a word boundary so a longer
    // class starting with the same name cannot satisfy it.
    expect(css).toMatch(/\.cr2-nav-publish-now(?![\w-])/);
    expect(css).toMatch(/\.cr2-nav-publish-now:disabled/);
  });
});

describe('the flow asks for the publishable fields first', () => {
  const at = (s: CampaignStep) => CAMPAIGN_STEPS.indexOf(s);

  it('title, story and goal come before everything optional', () => {
    // They used to sit at 3, 4 and 6, with `basics` in front and `media` wedged
    // between story and goal — five screens before a draft was publishable at
    // all. This is the assertion that stops that creeping back.
    const last = Math.max(at('title'), at('story'), at('goal'));
    for (const later of ['basics', 'media', 'rewards', 'payout', 'verify', 'review'] as const) {
      expect(at(later), `${later} comes before a publish-minimum step`).toBeGreaterThan(last);
    }
  });

  it('they are consecutive, so nothing interrupts the run to publishable', () => {
    const idx = [at('title'), at('story'), at('goal')].sort((a, b) => a - b);
    expect(idx[2] - idx[0]).toBe(2);
  });

  it('the builder opens on the first of them', () => {
    const builderSrc = readFileSync(resolve(__dirname, '..', 'app/create/page.tsx'), 'utf8');
    expect(builderSrc).toContain("useState<WizardStep>('title')");
  });

  it('reordering did not rename anything, so live drafts still resolve', () => {
    // The order changed; the KEYS did not. That distinction is what keeps a
    // draft saved mid-flow rendering the screen it was on rather than a blank
    // one — the failure mode campaign-flow-core's migration note describes.
    for (const key of ['path', 'title', 'story', 'goal', 'basics', 'media', 'rewards', 'payout', 'verify', 'review', 'publish', 'share']) {
      expect(normalizeStep(key), `${key} no longer resolves`).toBe(key);
    }
    // And the two older generations still migrate.
    expect(normalizeStep('category')).toBe('basics');
    expect(normalizeStep('summary')).toBe('review');
    expect(normalizeStep('live')).toBe('publish');
  });
});
