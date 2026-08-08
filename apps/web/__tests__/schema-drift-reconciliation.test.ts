import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260829000000_reconcile_live_schema_columns.sql'),
  'utf8',
).toLowerCase();
const rollback = readFileSync(
  resolve(process.cwd(), '../../supabase/rollbacks/20260829000000_rollback_reconcile_live_schema_columns.sql'),
  'utf8',
).toLowerCase();

describe('live schema drift reconciliation', () => {
  it('reproduces all 49 independently owned production columns', () => {
    expect([...migration.matchAll(/add column if not exists/g)]).toHaveLength(49);
    expect(migration).toContain("result jsonb default '{}'::jsonb not null");
    expect(migration).toContain('sort_order integer default 0 not null');
    expect(migration).toContain('plan text');
    expect(migration).toContain('alter column plan set not null');
    expect(migration).toContain('doc_type text');
    expect(migration).toContain('alter column doc_type set not null');
  });

  it('reproduces the live relational and validation contract', () => {
    expect(migration).toContain('campaign_reports_resolved_by_fkey');
    expect(migration).toContain('donor_crm_contacts_donor_id_fkey');
    expect(migration).toContain('refunds_requested_by_fkey');
    expect(migration).toContain('subscriptions_plan_check');
    expect(migration).toContain('verification_documents_doc_type_check');
    expect(migration).toContain('verification_documents_verified_by_fkey');
    expect(migration).toContain('nonprofit_profiles_ein_key unique (ein)');
    expect(migration).toContain('create index if not exists idx_refunds_requested_by');
    const trustChecks = new Set(
      [...migration.matchAll(/trust_scores_\w+_score_check/g)].map(([name]) => name),
    );
    expect(trustChecks).toHaveLength(4);
  });

  it('marks only newly created columns so rollback preserves production drift repairs', () => {
    expect(migration).toContain('charitme:migration:20260829000000');
    expect(rollback).toContain("col_description(relation.oid, attribute.attnum) = 'charitme:migration:20260829000000'");
    expect(rollback).toContain("'alter table %i.%i drop column %i'");
    expect(rollback).not.toContain('drop table');
  });
});
