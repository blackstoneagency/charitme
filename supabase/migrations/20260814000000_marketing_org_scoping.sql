-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER_SPEC §7 — scope the marketing tables to an organization.
--
-- Follows 20260807000000, which added `organizations` / `organization_members` /
-- `brands`. This attaches the marketing data to them.
--
-- ── What this DOES and does NOT do ───────────────────────────────────────────
--
-- It adds a nullable `org_id` to the 15 ROOT marketing tables and indexes it.
--
-- It does NOT, on its own, isolate tenants. Every `marketing_*` table is
-- service-role-only (RLS on, no anon/authenticated policies), so today the
-- column is a scoping *key*, not an enforcement mechanism. Isolation arrives
-- with the tenant-facing policies, when there is a tenant-facing UI to need
-- them. Saying "multi-tenancy is done" because a column exists would be exactly
-- the kind of claim this repo keeps having to retract.
--
-- ── Why nullable, and what NULL means ────────────────────────────────────────
--
-- `NOT NULL` would fail outright: rows exist that predate tenancy, and there is
-- no correct organization to assign them to — inventing a "default org" would
-- silently attribute real marketing history to a tenant that never owned it.
--
-- So NULL means *pre-tenancy / platform-owned*, and it is a deliberate, readable
-- state rather than missing data. Once the owner designates a home organization,
-- a follow-up migration can `UPDATE ... WHERE org_id IS NULL` and only then
-- tighten to NOT NULL. Doing that in one step here would guess on the owner's
-- behalf about who owns their existing audience.
--
-- ── Why only the ROOT tables ─────────────────────────────────────────────────
--
-- Six tables are children that derive scope through their parent FK:
--   marketing_identities        → marketing_contacts
--   marketing_segment_members   → marketing_segments
--   marketing_campaign_recipients → marketing_campaigns
--   marketing_automation_runs   → marketing_automations
--   marketing_campaign_plan_assets → marketing_campaign_plans
--   marketing_form_submissions  → marketing_forms
--
-- Denormalising `org_id` onto them is the conventional move for RLS speed, and
-- it is the wrong trade here: a child column can DRIFT from its parent's, and a
-- child whose org_id disagrees with its parent is a cross-tenant leak that reads
-- as correct in every query that trusts the child. One authoritative owner per
-- record. If profiling later proves the join is a bottleneck, denormalise then —
-- with a trigger or generated column keeping the two in lockstep, not by hand.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  root_table text;
  root_tables constant text[] := array[
    'marketing_contacts',
    'marketing_events',
    'marketing_segments',
    'marketing_campaigns',
    'marketing_automations',
    'marketing_email_templates',
    'marketing_utm_links',
    'marketing_referrals',
    'marketing_forms',
    'marketing_consent',
    'marketing_suppression_list',
    'marketing_goals',
    'marketing_opportunities',
    'marketing_campaign_plans',
    'marketing_audit_logs'
  ];
begin
  foreach root_table in array root_tables loop
    -- Skip tables a given deployment has not created yet, rather than failing the
    -- whole migration. These arrived across several migrations and an environment
    -- part-way through the series is a legitimate state.
    if to_regclass('public.' || root_table) is null then
      raise notice 'skipping %, table not present', root_table;
      continue;
    end if;

    execute format(
      'alter table public.%I add column if not exists org_id uuid references public.organizations(id) on delete cascade',
      root_table
    );

    -- Partial index: NULL is the pre-tenancy bucket and is never the target of a
    -- tenant-scoped lookup, so indexing those rows would be dead weight.
    execute format(
      'create index if not exists %I on public.%I (org_id) where org_id is not null',
      root_table || '_org_id_idx',
      root_table
    );
  end loop;
end $$;

comment on column public.marketing_contacts.org_id is
  'Owning organization. NULL = pre-tenancy / platform-owned, not missing data. See 20260814000000.';
