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

  it('puts all three publish minimums on ONE screen', () => {
    // They were three separate steps: three Continue presses and two page
    // transitions to enter three fields. `essentials` holds all three, so a
    // draft becomes publishable without leaving the first screen.
    expect(CAMPAIGN_STEPS).toContain('essentials');
    for (const gone of ['title', 'story', 'goal']) {
      expect(CAMPAIGN_STEPS as readonly string[], `${gone} is still its own step`).not.toContain(gone);
    }
  });

  it('puts that screen before everything optional', () => {
    for (const later of ['basics', 'media', 'rewards', 'payout', 'verify', 'review'] as const) {
      expect(at(later), `${later} comes before the essentials`).toBeGreaterThan(at('essentials'));
    }
  });

  it('the builder opens on it', () => {
    const builderSrc = readFileSync(resolve(__dirname, '..', 'app/create/page.tsx'), 'utf8');
    expect(builderSrc).toContain("useState<WizardStep>('essentials')");
  });

  it('renders all three fields on that one screen', () => {
    // Guards the guard: the step could exist and render nothing. Each of the
    // three panels — title, story, goal — must be conditioned on it.
    const builderSrc = readFileSync(resolve(__dirname, '..', 'app/create/page.tsx'), 'utf8');
    expect((builderSrc.match(/\{step === 'essentials' && \(/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('migrates the three old keys, so drafts in flight still render', () => {
    // Drafts live 7 days in localStorage AND campaign_wizard_drafts, so people
    // are holding these keys right now. An unmapped key renders no branch —
    // a blank screen that looks exactly like their work being deleted.
    expect(normalizeStep('title')).toBe('essentials');
    expect(normalizeStep('story')).toBe('essentials');
    expect(normalizeStep('goal')).toBe('essentials');
    // And the earlier generations still migrate.
    expect(normalizeStep('category')).toBe('basics');
    expect(normalizeStep('summary')).toBe('review');
    expect(normalizeStep('live')).toBe('publish');
    // Every current key still round-trips.
    for (const k of CAMPAIGN_STEPS) expect(normalizeStep(k)).toBe(k);
  });

  it('never resolves to a step the wizard cannot render', () => {
    for (const raw of ['title', 'story', 'goal', 'type', 'category', 'location', 'summary', 'live', 'nonsense', '']) {
      const r = normalizeStep(raw);
      if (r !== null) expect(CAMPAIGN_STEPS as readonly string[]).toContain(r);
    }
  });
});
