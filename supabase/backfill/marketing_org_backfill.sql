-- ─────────────────────────────────────────────────────────────────────────────
-- Assign pre-tenancy marketing rows to a home organization.
--
-- Companion to 20260814000000_marketing_org_scoping.sql, which added a NULLABLE
-- `org_id` to the 15 root `marketing_*` tables. NULL there means *pre-tenancy /
-- platform-owned* — real history that existed before organizations did.
--
-- This is deliberately NOT a migration. Migrations run automatically on every
-- deploy, and this step needs a human to answer a question no migration can:
-- **which organization actually owns the existing audience?** Guessing that in
-- an auto-applied migration would silently attribute real marketing history to a
-- tenant that never owned it — and you would not find out until a tenant saw
-- someone else's contacts.
--
-- ── How to run ───────────────────────────────────────────────────────────────
--
--   psql "$DATABASE_URL" \
--     -v org_slug=your-org-slug \
--     -f supabase/backfill/marketing_org_backfill.sql
--
-- It runs in a single transaction and prints a per-table count before
-- committing, so a wrong slug is visible and rolls back rather than half-applies.
--
-- ── Safety properties ────────────────────────────────────────────────────────
--
-- * Only touches rows where `org_id IS NULL`. Re-running is a no-op, and it can
--   never move a row that already belongs to a tenant.
-- * Fails loudly if the slug does not resolve, instead of updating 0 rows and
--   reporting success — the "reported success for work it never did" shape this
--   repo has hit repeatedly.
-- * Leaves the columns NULLABLE. Tightening to NOT NULL belongs in a later
--   migration, once you have confirmed the counts below are what you expect.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

begin;

-- psql substitutes :'org_slug' here (a plain statement) and quotes it. It cannot
-- substitute inside the dollar-quoted block below, which is why the value is
-- handed over through a GUC rather than interpolated into the PL/pgSQL.
set local my.org_slug = :'org_slug';

do $$
declare
  target_org uuid;
  target_slug text := current_setting('my.org_slug', true);
  t text;
  n bigint;
  total bigint := 0;
  root_tables constant text[] := array[
    'marketing_contacts', 'marketing_events', 'marketing_segments',
    'marketing_campaigns', 'marketing_automations', 'marketing_email_templates',
    'marketing_utm_links', 'marketing_referrals', 'marketing_forms',
    'marketing_consent', 'marketing_suppression_list', 'marketing_goals',
    'marketing_opportunities', 'marketing_campaign_plans', 'marketing_audit_logs'
  ];
begin
  if target_slug is null or target_slug = '' then
    raise exception
      'No organization slug supplied. Run with:  psql -v org_slug=your-slug -f this_file.sql';
  end if;

  select id into target_org from organizations where slug = target_slug and deleted_at is null;

  -- Fail rather than update nothing and look successful.
  if target_org is null then
    raise exception 'No active organization with slug %. Nothing was changed.', target_slug;
  end if;

  raise notice 'Backfilling pre-tenancy marketing rows to org % (%)', target_slug, target_org;

  foreach t in array root_tables loop
    if to_regclass('public.' || t) is null then
      raise notice '  % — table absent, skipped', t;
      continue;
    end if;

    execute format('update public.%I set org_id = $1 where org_id is null', t)
      using target_org;
    get diagnostics n = row_count;
    total := total + n;
    raise notice '  % — % row(s)', t, n;
  end loop;

  raise notice 'Total rows assigned: %', total;
end $$;

commit;
