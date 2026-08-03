-- Rollback for 20260807000000_organizations_multitenancy.sql
--
-- ⚠️ DESTRUCTIVE. `drop table ... cascade` removes the table and every row in it,
-- along with its indexes, policies and triggers. That is what rolling back a
-- table-creating migration means, but it is not recoverable — take a dump first
-- if the table has production rows.
--
-- Written and rehearsed with `scripts/rehearse-migrations.sh`: the full
-- migration set is replayed, this script is applied, and the objects are
-- asserted gone. Cascade is deliberate — the indexes, RLS policies and touch
-- triggers created alongside each table have no independent existence.
-- ⚠️⚠️ THIS ROLLBACK IS NOT SAFE TO RUN ALONE. EXPECTED_FK_LOSS=15
--
-- Measured by scripts/rehearse-rollbacks.sh: dropping `organizations` cascades
-- into FIFTEEN foreign keys on tables that SURVIVE — the whole marketing
-- subsystem is org-scoped by 20260814000000_marketing_org_scoping:
--
--   marketing_contacts, marketing_events, marketing_segments,
--   marketing_campaigns, marketing_automations, marketing_email_templates,
--   marketing_utm_links, marketing_referrals, marketing_forms,
--   marketing_consent, marketing_suppression_list, marketing_goals,
--   marketing_opportunities, marketing_campaign_plans, marketing_audit_logs
--
-- Every one keeps its `org_id` column and loses the constraint, so the rows stay
-- and nothing enforces them any more. That is worse than either applying or
-- fully reverting: it is a half-reverted schema that still looks scoped.
--
-- **Roll back 20260814000000_marketing_org_scoping FIRST**, then this. The
-- table-only check missed this entirely — every table survived, so it reported
-- "no collateral" while the constraints went.

-- Dropped child-first so a cascade is never relied on for a FK we know about.
drop table if exists public.brands cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations cascade;
