import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '../../.github/workflows/release.yml'),
  'utf8',
);
const rlsSmoke = readFileSync(
  resolve(process.cwd(), '../../scripts/rls-live-smoke.mjs'),
  'utf8',
);

describe('production release workflow', () => {
  it('runs production releases only from semantic version tags', () => {
    expect(workflow).toMatch(/tags:\s*\r?\n\s*-\s*'v\*\.\*\.\*'/);
    expect(workflow).not.toContain('workflow_dispatch:');
  });

  it('replays the complete migration chain before staging', () => {
    expect(workflow).toContain('npx supabase db reset --local');
    expect(workflow).toMatch(/staging:[\s\S]*needs:\s*\[verify,\s*migration-replay\]/);
  });

  it('starts only the database service needed by migration replay', () => {
    const replay = workflow.match(/migration-replay:[\s\S]*?\n  staging:/)?.[0] ?? '';
    expect(replay).toContain('npx supabase db start');
    expect(replay).not.toMatch(/npx supabase start(?:\s|$)/);
    expect(replay).not.toContain('SUPABASE_REPLAY_EXCLUDES');
    expect(replay).not.toContain('--ignore-health-check');
  });

  it('requires staging verification before production', () => {
    expect(workflow).toMatch(/production:[\s\S]*needs:\s*staging/);
    expect(workflow).toContain(
      'STAGING_VERIFIED_COMMIT: ${{ needs.staging.outputs.commit }}',
    );
    expect(workflow).toContain("ALLOW_PRODUCTION_DATABASE_PUSH: 'true'");
  });

  it('runs three critical browser specs against isolated staging', () => {
    expect(workflow).toContain('npx supabase start');
    expect(workflow).toContain('npm run build --workspace=apps/web');
    expect(workflow).toContain('npm start --workspace=apps/web');
    expect(workflow).toContain('e2e/smoke.spec.ts');
    expect(workflow).toContain('e2e/auth-gates.spec.ts');
    expect(workflow).toContain('e2e/security-headers.spec.ts');
    expect(workflow).toContain('PLAYWRIGHT_BASE_URL: http://127.0.0.1:3000');
  });

  it('requires authenticated cross-persona RLS checks in staging', () => {
    expect(workflow).toContain("REQUIRE_AUTHENTICATED_RLS_PERSONAS: 'true'");
    expect(workflow).toContain("BOOTSTRAP_LOCAL_RLS_PERSONAS: 'true'");
    expect(rlsSmoke).toContain("randomBytes(32).toString('base64url')");
    expect(rlsSmoke).toContain('requireLocalSupabaseUrl(supabaseUrl)');
    expect(rlsSmoke).toContain('localPersonas.admin.auth.admin.deleteUser(userId)');
  });

  it('uses protected GitHub environments and deploys production explicitly', () => {
    expect(workflow).toMatch(/staging:[\s\S]*environment:\s*staging/);
    expect(workflow).toMatch(/production:[\s\S]*environment:\s*production/);
    expect(workflow).toContain('npx vercel deploy --prod --yes');
  });
});
