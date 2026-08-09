import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string): string => readFileSync(join(here, '..', path), 'utf8');

const chooser = read('app/create/choose-path/page.tsx');
const aiIntake = read('app/ai-campaign/page.tsx');
const sharedBuilder = read('app/create/page.tsx');
const legacyAiRoute = read('app/create/ai/page.tsx');
const imageUpload = read('app/api/upload/campaign-image/route.ts');
const sourceUpload = read('app/api/upload/campaign-source/route.ts');
const rollback = read('../../supabase/rollbacks/20260902000000_rollback_unified_campaign_builder.sql');
const migration = read('../../supabase/migrations/20260902000000_unified_campaign_builder.sql');
const ciWorkflow = read('../../.github/workflows/ci.yml');
const releaseWorkflow = read('../../.github/workflows/release.yml');
const databaseSmoke = read('../../scripts/campaign-builder-db-smoke.mjs');

describe('campaign creation has exactly two primary paths', () => {
  it('offers AI and guided creation from the choice screen', () => {
    expect(chooser.match(/<PathCard/g)).toHaveLength(2);
    expect(chooser).toContain('href="/ai-campaign"');
    expect(chooser).toContain('href="/create?path=guided"');
  });

  it('redirects the legacy AI URL into the shared builder', () => {
    expect(legacyAiRoute).toContain('/create?path=ai&ai=');
    expect(legacyAiRoute).not.toContain('AiCampaignFlow');
  });
});

describe('AI intake converges into the shared campaign model', () => {
  it('accepts voice, files, and links before entering the shared builder', () => {
    expect(aiIntake).toContain('SpeechRecognition');
    expect(aiIntake).toContain('cacheAiIntakeFiles(files)');
    expect(aiIntake).toContain('normalizeAiIntakeLinks');
    expect(aiIntake).toContain("'/create?path=ai&intake=1'");
  });

  it('loads the intake and persists the selected builder path', () => {
    expect(sharedBuilder).toContain('parseAiCampaignIntake');
    expect(sharedBuilder).toContain("setBuilderPath('ai')");
    expect(sharedBuilder).toContain("builderPath: builderPath ?? 'guided'");
    expect(sharedBuilder).toContain("fetch('/api/campaigns'");
  });
});

describe('both paths share preview and publish readiness', () => {
  it('provides all four required preview contexts', () => {
    expect(sharedBuilder).toContain("['mobile', 'desktop', 'social', 'checkout'] as const");
    expect(sharedBuilder).toContain('<ReadinessChecklist');
    expect(sharedBuilder).toContain('disabled={loading || !readiness.readyToPublish}');
  });
});

describe('builder storage remains owner-scoped and recoverable', () => {
  it('authenticates before charging upload rate limits to the user', () => {
    for (const source of [imageUpload, sourceUpload]) {
      const postHandler = source.slice(source.indexOf('export async function POST'));
      expect(postHandler.indexOf('auth.getUser()')).toBeLessThan(
        postHandler.indexOf('await checkRateLimitDurable('),
      );
      expect(postHandler).toContain('${user.id}');
      expect(source).toContain('${user.id}');
    }
  });

  it('never deletes campaign work during an application rollback', () => {
    expect(rollback).not.toContain('delete from storage.objects');
    expect(rollback).not.toContain('drop table');
    expect(rollback).not.toContain('drop column');
    expect(rollback).toContain('Preserve all');
  });

  it('versions both drafts and published campaign records', () => {
    expect(migration).toContain('builder_schema_version integer not null default 1');
    expect(migration).toContain("coalesce((p_payload->>'schema_version')::integer, 1)");
    expect(migration).toContain('campaign_wizard_draft_versions');
  });

  it('serializes remote autosaves and invalidates saves from superseded drafts', () => {
    expect(sharedBuilder).toContain('draftSaveQueueRef.current.catch(() => undefined).then');
    expect(sharedBuilder).toContain('generation !== draftGenerationRef.current');
    expect(sharedBuilder).toContain('sequence === draftSaveSequenceRef.current');
  });

  it('runs the real Supabase graph smoke in CI and the staging release gate', () => {
    expect(ciWorkflow).toContain('npm run test:campaign-builder-db');
    expect(releaseWorkflow).toContain('npm run test:campaign-builder-db');
    expect(databaseSmoke).toContain("client.rpc('create_campaign_from_builder'");
    expect(databaseSmoke).toContain("admin.rpc('create_campaign_from_builder'");
    expect(databaseSmoke).toContain("from('campaign-source-documents').download(sourcePath)");
  });
});
