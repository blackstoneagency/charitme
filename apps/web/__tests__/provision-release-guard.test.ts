import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), '../../scripts/provision-supabase-vercel.mjs'),
  'utf8',
);

describe('Supabase provisioning release guard', () => {
  it('has no default production project', () => {
    expect(source).toContain("const projectRef = process.env.SUPABASE_PROJECT_REF ?? ''");
    expect(source).not.toMatch(/SUPABASE_PROJECT_REF\s*\?\?\s*['"][a-z]{20}['"]/);
  });

  it('requires explicit environment and production confirmation', () => {
    expect(source).toContain("requireEnv('DEPLOY_ENVIRONMENT')");
    expect(source).toContain("requireEnv('SUPABASE_PRODUCTION_PROJECT_REF')");
    expect(source).toContain("process.env.ALLOW_PRODUCTION_DATABASE_PUSH !== 'true'");
  });

  it('requires the exact production commit to pass staging', () => {
    expect(source).toContain("requireEnv('STAGING_VERIFIED_COMMIT')");
    expect(source).toContain("output('git', ['rev-parse', 'HEAD']).trim()");
    expect(source).toContain('verifiedCommit !== currentCommit');
  });

  it('does not copy production credentials into preview or development', () => {
    expect(source).toMatch(
      /deployEnvironment\s*===\s*'production'\s*\?\s*\['production'\]\s*:\s*\['preview',\s*'development'\]/,
    );
    expect(source).not.toContain("const targets = ['production', 'preview', 'development']");
  });

  it('redacts database credentials from command logs', () => {
    expect(source).toContain("new Set(['--db-url', '--password'])");
    expect(source).toContain("return '[REDACTED]'");
    expect(source).toContain('redactArgs(args).join');
    expect(source).not.toContain("console.log(`> ${command} ${args.join(' ')}`)");
  });

  it('uses the linked project when only a database password is configured', () => {
    expect(source).toContain("return process.env.SUPABASE_DB_URL ?? null");
    expect(source).toContain("['link', '--project-ref', projectRef, '--yes']");
    expect(source).toContain("['db', 'push', '--linked', '--include-all', '--yes']");
    expect(source).not.toContain('@db.${projectRef}.supabase.co:5432/postgres');
  });

  it('can leave Vercel deployment to the verified GitHub integration after database push', () => {
    expect(source).toContain("process.env.SKIP_VERCEL_CONFIGURATION === 'true'");
    expect(source.indexOf("process.env.SKIP_VERCEL_CONFIGURATION === 'true'"))
      .toBeGreaterThan(source.indexOf("run(supabase, pushArgs)"));
  });
});
