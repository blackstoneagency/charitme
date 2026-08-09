import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { builderSteps, normalizeStep } from '../lib/campaign-flow-core';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const builder = read('app/create/page.tsx');
const chooser = [
  read('app/create/choose-path/page.tsx'),
  read('app/create/CampaignPathChoice.tsx'),
].join('\n');
const aiIntake = read('app/ai-campaign/page.tsx');

describe('two paths, one campaign builder', () => {
  it('offers exactly AI and guided entry paths', () => {
    expect(chooser).toContain('href="/ai-campaign"');
    expect(chooser).toContain('href="/create?path=guided"');
    expect(chooser.match(/<PathCard/g)?.length).toBe(2);
  });

  it('sends AI intake into the same shared form and draft model', () => {
    expect(aiIntake).toContain("'/create?path=ai&intake=1'");
    expect(builder).toContain("setBuilderPath('ai')");
    expect(builder).toContain("setBuilderPath('guided')");
    expect(builder).toContain('builderPath: builderPath ??');
  });

  it('uses the same twelve screens regardless of entry path', () => {
    expect(builderSteps()).toHaveLength(12);
    for (const step of builderSteps()) expect(builder).toContain(`step === '${step}'`);
  });

  it('migrates old drafts into rendered screens', () => {
    for (const key of ['path', 'basics', 'essentials', 'title', 'rewards', 'summary', 'live']) {
      expect(normalizeStep(key)).not.toBeNull();
    }
  });
});

describe('preview and readiness convergence', () => {
  it('computes readiness once and shares it with checklist and launch controls', () => {
    expect(builder.match(/publishReadiness\(\{/g)?.length).toBe(1);
    expect(builder).toContain('readiness={readiness}');
    expect(builder).toContain('canLaunch={readiness.readyToPublish}');
    expect(builder).toContain('disabled={loading || !readiness.readyToPublish}');
  });

  it('previews phone, desktop, social, and checkout contexts', () => {
    expect(builder).toContain("['mobile', 'desktop', 'social', 'checkout']");
    expect(builder).toContain('cb-social-preview');
    expect(builder).toContain('cb-checkout-preview');
  });

  it('keeps publication behind the review/readiness state', () => {
    expect(builder).toContain("{step === 'review' && (");
    expect(builder).toContain('if (!readiness.readyToPublish)');
  });
});
