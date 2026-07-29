import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Pins the org-scoping shape from 20260814000000 against the generated schema.
//
// The invariant that matters is not "org_id exists somewhere" — it is WHICH
// tables carry it. Root tables own their scope; the six child tables derive it
// through their parent FK and must NOT have their own copy, because a child
// column can drift from its parent's and a child whose org_id disagrees with its
// parent is a cross-tenant leak that reads as correct in every query trusting
// the child.
//
// So this asserts both directions. A test that only checked the roots would pass
// happily while someone "helpfully" denormalised org_id onto the children.
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = readFileSync(join(process.cwd(), '..', '..', 'supabase', 'schema.sql'), 'utf8');

/** Tables that own their tenancy directly. */
const ROOTS = [
  'marketing_contacts', 'marketing_events', 'marketing_segments', 'marketing_campaigns',
  'marketing_automations', 'marketing_email_templates', 'marketing_utm_links',
  'marketing_referrals', 'marketing_forms', 'marketing_consent',
  'marketing_suppression_list', 'marketing_goals', 'marketing_opportunities',
  'marketing_campaign_plans', 'marketing_audit_logs',
] as const;

/** Tables whose scope comes from their parent. Adding org_id here is the bug. */
const CHILDREN = [
  'marketing_identities', 'marketing_segment_members', 'marketing_campaign_recipients',
  'marketing_automation_runs', 'marketing_campaign_plan_assets', 'marketing_form_submissions',
] as const;

function tableBody(name: string): string | null {
  const m = new RegExp(`CREATE TABLE public\\.${name} \\(([\\s\\S]*?)\\n\\);`).exec(SCHEMA);
  return m ? m[1] : null;
}

describe('marketing org scoping', () => {
  it('the schema mirror actually contains the marketing tables', () => {
    // Guards against the whole suite passing vacuously if schema.sql moved or
    // the regex stopped matching — every assertion below is regex-driven.
    expect(tableBody('marketing_contacts')).toBeTruthy();
    expect(SCHEMA.length).toBeGreaterThan(10_000);
  });

  it.each(ROOTS)('%s carries org_id', (table) => {
    const body = tableBody(table);
    expect(body, `${table} missing from schema.sql`).toBeTruthy();
    expect(body, `${table} should be org-scoped`).toContain('org_id');
  });

  it.each(CHILDREN)('%s does NOT carry its own org_id', (table) => {
    const body = tableBody(table);
    expect(body, `${table} missing from schema.sql`).toBeTruthy();
    // Derives scope from its parent. A local copy can drift, and a child that
    // disagrees with its parent leaks across tenants while looking correct.
    expect(body).not.toContain('org_id');
  });

  it('org_id is nullable everywhere — rows predate tenancy', () => {
    // NOT NULL would fail on existing data, and inventing a default org would
    // silently attribute real marketing history to a tenant that never owned it.
    for (const table of ROOTS) {
      const body = tableBody(table) ?? '';
      const line = body.split('\n').find((l) => l.includes('org_id')) ?? '';
      expect(line, `${table}.org_id must stay nullable until backfilled`).not.toMatch(/NOT NULL/);
    }
  });

  it('org_id references organizations, so a deleted org cannot orphan rows', () => {
    expect(SCHEMA).toMatch(/marketing_contacts[\s\S]{0,400}?REFERENCES public\.organizations/);
  });
});
