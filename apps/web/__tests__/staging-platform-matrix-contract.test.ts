import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), '../../scripts/staging-platform-matrix.mjs'),
  'utf8',
);
const workflow = readFileSync(
  resolve(process.cwd(), '../../.github/workflows/release.yml'),
  'utf8',
);
const ciWorkflow = readFileSync(
  resolve(process.cwd(), '../../.github/workflows/ci.yml'),
  'utf8',
);

describe('staging platform matrix contract', () => {
  it('is restricted to disposable loopback environments', () => {
    expect(source).toContain("['127.0.0.1', 'localhost', '::1'].includes(hostname)");
    expect(source).toContain('only runs against a loopback Supabase URL');
    expect(source).toContain('realtime: { transport: DisabledRealtimeTransport }');
    expect(source).toContain('await cleanup()');
  });

  it('covers every platform role and plan, including lapsed subscriptions', () => {
    for (const role of ['donor', 'organizer', 'beneficiary', 'nonprofit', 'admin', 'super_admin']) {
      expect(source).toContain(`'${role}'`);
    }
    for (const plan of ['free', 'starter', 'pro', 'enterprise']) {
      expect(source).toContain(`plan: '${plan}'`);
    }
    expect(source).toContain("subscriptionStatus: 'past_due'");
    expect(source).toContain('periodEnd: now - day');
  });

  it('exercises authentication lifecycle and protected data boundaries', () => {
    for (const operation of [
      'auth.signUp',
      'auth.signInWithPassword',
      'auth.refreshSession',
      'auth.signOut',
      'auth.admin.generateLink',
      "verifyOtp({ type: 'recovery'",
      "from('profiles')",
      "from('campaigns')",
      "from('donations')",
      "from('tax_receipts')",
      "from('direct_messages')",
      "from('tasks')",
    ]) {
      expect(source).toContain(operation);
    }
  });

  it('covers tenant isolation and all production storage classes', () => {
    expect(source).toContain("from('organizations')");
    expect(source).toContain("from('organization_members')");
    expect(source).toContain("from('marketing_contacts')");
    expect(source).toContain("from('marketing_events')");
    for (const bucket of ['campaign-media', 'verification-documents', 'receipts', 'avatars']) {
      expect(source).toContain(`'${bucket}'`);
    }
  });

  it('is a mandatory staging release gate before the application build', () => {
    const matrixIndex = workflow.indexOf('npm run test:platform-matrix');
    const buildIndex = workflow.indexOf('npm run build --workspace=apps/web', matrixIndex);
    expect(matrixIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(matrixIndex);
  });

  it('runs against a fully replayed Supabase stack in pull-request CI', () => {
    const resetIndex = ciWorkflow.indexOf('npx supabase db reset --local');
    const matrixIndex = ciWorkflow.indexOf('npm run test:platform-matrix');
    expect(ciWorkflow).toContain('npx supabase start');
    expect(ciWorkflow).toContain('npx supabase status --output env');
    expect(matrixIndex).toBeGreaterThan(resetIndex);
  });
});
