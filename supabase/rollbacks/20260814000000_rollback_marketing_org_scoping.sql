-- Rollback for 20260814000000_marketing_org_scoping.sql
--
-- ⚠️ DESTRUCTIVE. `drop column` deletes the data in that column for every row.
-- That is what reverting an added column means, and it is not recoverable — take
-- a dump first if these columns hold production data.
--
-- Contents MEASURED, not parsed: `scripts/diff-migration.sh 20260814000000` replays every
-- earlier migration, snapshots the schema, applies this one and diffs. Several
-- of these columns are added inside DO blocks that build statements with
-- format(), which a grep over the SQL does not see.
-- Rehearsed by `scripts/rehearse-rollbacks.sh`.
--
-- ⚠️ ORDER MATTERS. Run this BEFORE
-- 20260807000000_rollback_organizations_multitenancy. These fifteen `org_id`
-- columns carry the foreign keys that the organizations rollback would otherwise
-- cascade away, leaving every marketing table with an unconstrained org_id — a
-- half-reverted schema that still looks scoped. Dropping the columns here
-- removes the constraints cleanly first.--
-- EXPECTED_FK_LOSS=15
--
-- These fifteen foreign keys belong to the fifteen `org_id` columns being
-- dropped, so they go WITH the target rather than being collateral. The
-- rehearsal harness cannot tell the two apart on its own: it counts FKs by
-- surviving TABLE, and these tables do survive — only their column goes. Hence
-- the explicit declaration.
--
-- Contrast 20260807000000_rollback_organizations_multitenancy, where the same
-- count of 15 means the opposite: there the columns survive and lose their
-- constraint, which is the dangerous case.
-- Indexes are dropped with their columns automatically; listed here only where
-- the migration created one that outlives its column.
alter table if exists public.marketing_audit_logs drop column if exists org_id;
alter table if exists public.marketing_automations drop column if exists org_id;
alter table if exists public.marketing_campaign_plans drop column if exists org_id;
alter table if exists public.marketing_campaigns drop column if exists org_id;
alter table if exists public.marketing_consent drop column if exists org_id;
alter table if exists public.marketing_contacts drop column if exists org_id;
alter table if exists public.marketing_email_templates drop column if exists org_id;
alter table if exists public.marketing_events drop column if exists org_id;
alter table if exists public.marketing_forms drop column if exists org_id;
alter table if exists public.marketing_goals drop column if exists org_id;
alter table if exists public.marketing_opportunities drop column if exists org_id;
alter table if exists public.marketing_referrals drop column if exists org_id;
alter table if exists public.marketing_segments drop column if exists org_id;
alter table if exists public.marketing_suppression_list drop column if exists org_id;
alter table if exists public.marketing_utm_links drop column if exists org_id;
