import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HEALTH_ROUTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/api/health/route.ts');
const RELOAD_MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations/20260811000000_secure_schema_cache_reload.sql',
);

describe('health endpoint contract', () => {
  const source = readFileSync(HEALTH_ROUTE, 'utf8');

  it('keeps public health responses minimal', () => {
    expect(source).toContain("if (!details) return NextResponse.json({ status: 'ok', ts: Date.now() });");
    expect(source).toContain("const user = await verifyAdmin();");
    expect(source).toContain("code: 'ADMIN_REQUIRED'");
  });

  it('only exposes detailed diagnostics through the explicit details flag', () => {
    expect(source).toContain("searchParams.get('details') === '1'");
  });

  it('does not return raw database error messages', () => {
    expect(source).not.toMatch(/e[123]\? `error: \$\{e[123].*message/);
    expect(source).toContain("{ status: 'error', code: e1.code ?? 'QUERY_FAILED' }");
    expect(source).toContain("{ status: 'error', code: e2.code ?? 'QUERY_FAILED' }");
    expect(source).toContain("{ status: 'error', code: e3.code ?? 'QUERY_FAILED' }");
  });

  // Deploy identity was added so "is my merge live?" is answerable directly
  // rather than by probing behaviour. It must stay ADMIN-ONLY: the public branch
  // returns before verifyAdmin(), so anything added there is world-readable.
  it('exposes deploy identity, and only behind the admin gate', () => {
    expect(source).toContain('checks.deployment');
    expect(source).toContain('VERCEL_GIT_COMMIT_SHA');
    // It must appear AFTER the admin check, never in the public early return.
    const adminGate = source.indexOf('const user = await verifyAdmin();');
    expect(adminGate).toBeGreaterThan(-1);
    expect(source.indexOf('checks.deployment')).toBeGreaterThan(adminGate);
  });

  it('reloads the schema cache without changing database privileges', () => {
    expect(source).toContain("supabaseAdmin.rpc('reload_postgrest_schema_cache')");
    expect(source).not.toMatch(/\bgrant\s+(?:all|usage)\b/i);
    expect(source).not.toContain('SUPABASE_ACCESS_TOKEN');
    expect(source).not.toContain('api.supabase.com/v1/projects');
  });

  it('fails closed when reload or verification fails', () => {
    expect(source).toContain("code: 'SCHEMA_RELOAD_FAILED'");
    expect(source).toContain("code: 'SCHEMA_CACHE_UNAVAILABLE'");
    expect(source).toContain('{ status: 503 }');
    expect(source).not.toContain('catch { /* ignore */ }');
  });

  it('keeps the reload function service-role only', () => {
    const migration = readFileSync(RELOAD_MIGRATION, 'utf8').toLowerCase();

    expect(migration).toContain('create or replace function public.reload_postgrest_schema_cache()');
    expect(migration).toContain("select pg_notify('pgrst', 'reload schema')");
    expect(migration).toMatch(
      /revoke all on function public\.reload_postgrest_schema_cache\(\)\s+from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.reload_postgrest_schema_cache\(\)\s+to service_role/,
    );
    expect(migration).not.toMatch(/\bgrant\s+(?:all|usage)\s+on\s+(?:all\s+)?(?:tables|sequences|routines|schema)\b/);
  });
});
