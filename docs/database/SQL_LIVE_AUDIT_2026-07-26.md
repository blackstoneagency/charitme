# SQL and Live Supabase Audit - 2026-07-26

## Scope

The audit covered every SQL file in the repository:

| Category | Files | Treatment |
|---|---:|---|
| `supabase/migrations` | 87 | Compared with live tables, columns, functions, indexes, triggers, policies, RLS, and the Supabase migration ledger |
| `supabase/rollbacks` | 2 | Checked for the two migrations that require explicit rollback handling |
| Seed SQL | 11 | Parsed for insert targets and compared with live table existence and row counts |
| Schema/repair/generator SQL | 4 | Classified as reference or recovery artifacts, not release migrations |
| **Total** | **104** | Complete repository SQL inventory |

The live comparison used a read-only PostgreSQL schema dump and direct catalog
queries against Supabase project `yanexccimwooursawynm`. No production data was
changed during discovery or validation.

## Findings

1. The Supabase migration ledger had no entries for any local migration. The
   live schema had been created out of band, so `supabase migration list` showed
   all migrations as local-only even where their objects were live.
2. Twelve migration versions were duplicated and one legacy migration used an
   invalid eight-digit version. These collisions made future `db push` behavior
   ambiguous. Every migration now has a unique 14-digit version.
3. The migration corpus originally omitted six live tables:
   `admin_settings`, `campaign_faqs`, `campaign_milestones`,
   `campaign_owner_replies`, `coach_sessions`, and `feature_flags`.
   `20260805000000_reconcile_runtime_tables.sql` now defines their current live
   shape, indexes, RLS, policies, and grants idempotently.
4. Six code-referenced tables were declared but absent from live Supabase:
   `banner_settings`, `campaign_wizard_drafts`, `marketing_goals`,
   `marketing_opportunities`, `marketing_campaign_plans`, and
   `marketing_campaign_plan_assets`.
5. `marketing_contacts_user_id_uq` was declared but absent. A live duplicate
   audit returned zero duplicate non-null `user_id` values, so the unique index
   can be applied safely.
6. All 50 unique `ALTER TABLE ... ADD COLUMN` requirements for existing tables
   are live. The seven absent columns belong only to the two absent tables:
   campaign draft `id`/`title` and the five new banner content fields.
7. All five literal RPCs used by application code are live:
   `check_rate_limit`, `claim_campaign_reward`, `decrement_campaign_stats`,
   `get_admin_system_resource_usage`, and `record_donation`.
8. All 208 statically declared policies are live except the four owner policies
   for the absent campaign draft table. All other missing indexes and triggers
   belong to the six absent tables or the missing marketing-contact index.
9. Seed SQL targets 63 relations. Every public target table is live; the apparent
   `auth` target is `auth.users`, not a missing public table. Eleven seeded
   feature tables currently have zero rows, matching modules that are marked
   Planned or have no active production records.

## Application Coverage

Static application scanning found every literal PostgREST `.from()` table now
has a reproducible migration definition. A committed Vitest guard enforces:

- valid, unique 14-digit migration versions;
- no literal PostgREST table reference without migration coverage.

There are 38 schema tables with no literal application query. These are not
missing schema; they are reserved, audit, processor, or planned-feature tables.
The feature catalog separately prevents modules with no implementation from
claiming Production Ready.

## Release Split

The 87 migrations reconcile into:

- **78 baseline migrations:** their required live objects/data were verified and
  should be recorded as applied without replaying destructive historical DDL.
- **9 pending migrations:** these must execute in order:
  1. `20260725050000_marketing_contact_user_uniqueness.sql`
  2. `20260729000000_marketing_goals.sql`
  3. `20260730000000_marketing_opportunities.sql`
  4. `20260731000000_marketing_campaign_plans.sql`
  5. `20260801000000_banner_settings.sql`
  6. `20260801010000_campaign_wizard_drafts.sql`
  7. `20260802010000_campaign_wizard_drafts_multi.sql`
  8. `20260804000000_banner_content_and_recovery.sql`
  9. `20260805000000_reconcile_runtime_tables.sql`

The nine pending migrations were executed together against the live schema
inside a single transaction with postcondition checks, then rolled back. Table
creation, dependency order, indexes, RLS, policies, banner content columns, and
campaign-draft re-keying all passed. A post-rollback query confirmed none of the
pending objects remained.

## Production Completion Criteria

Production reconciliation is complete only when:

1. PR #74 is merged after CI and Playwright pass.
2. The 78 verified baseline versions are recorded as applied.
3. The nine validated pending migrations are applied in order.
4. `supabase migration list --linked` shows all 87 local and remote versions
   aligned.
5. A fresh catalog audit reports 150/150 declared/live public tables, no missing
   required columns, indexes, triggers, policies, or app-used RPCs.
6. The super-admin banner Save, show/hide, and editable copy flow is verified on
   the production domain.
