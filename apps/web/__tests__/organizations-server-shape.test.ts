import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// `organizations`, `organization_members` and `brands` had NO reader in the
// application at all — shipped schema, unreachable from any code path. These
// tests pin the two properties that let a reader ship BEFORE its migration is
// applied, which is what kept the tables unread: waiting for the migration meant
// waiting indefinitely.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = readFileSync(join(__dirname, '..', 'lib', 'organizations-server.ts'), 'utf8');
const SCHEMA = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');

describe('the reader tolerates an unapplied migration', () => {
  it('treats 42P01 as "no organizations", not an error', () => {
    // Environments that have not run the migration answer 42P01. Treating that
    // as a failure would surface an error for a feature that is simply not
    // switched on yet.
    expect(SRC).toContain("code === '42P01'");
    expect(SRC).toMatch(/missingTable\([a-zA-Z]+\.code\)\) return \[\]/);
  });

  it('still distinguishes a REAL failure by returning null', () => {
    expect(SRC).toContain('return null');
    expect(SRC).toContain('console.warn');
  });
});

describe('it reads all three previously-unread tables', () => {
  for (const table of ['organizations', 'organization_members', 'brands']) {
    it(`queries ${table}`, () => {
      expect(SRC).toContain(`.from('${table}')`);
      expect(SCHEMA, `${table} must exist in the schema mirror`)
        .toContain(`CREATE TABLE public.${table} (`);
    });
  }
});

describe('it avoids the N+1 this repo audits for', () => {
  it('batches the organisation lookup with .in() rather than one query per membership', () => {
    expect(SRC).toContain('.in(');
    expect(SRC).toContain('memberships.map((m) => m.org_id)');
  });
});

describe('it reuses the shared role ladder', () => {
  it('imports isOrgRole rather than re-declaring the roles', () => {
    // organizations-core mirrors the SQL `is_org_member()` ladder. A second copy
    // here could disagree with RLS, which is the failure that module exists to
    // prevent.
    expect(SRC).toContain("from './organizations-core'");
    expect(SRC).toContain('isOrgRole');
    expect(SRC).not.toMatch(/const ORG_ROLES\s*=/);
  });
});
