-- =============================================================================
-- CharitMe seed · 08 · Homepage sponsors
--
-- `public.sponsors` is the only user-facing table the 00–07 suite never seeded,
-- and it is also missing from 99_verify_counts.sql — so the gap was invisible to
-- the project's own coverage check. Production holds 50 rows against a target of
-- 120; measured 2026-07-29.
--
-- It is NOT the same table as `sponsorship_opportunities` / `sponsorship_requests`
-- (seeded by 02). Those are the marketplace where organizers offer sponsorships.
-- This one is the flat list of sponsor logos rendered by /sponsor and managed
-- through /admin/sponsors — see app/api/sponsors/route.ts.
--
-- IDEMPOTENT: tops up to 120 rather than inserting a fixed count, so re-running
-- neither duplicates rows nor overwrites real sponsors an admin has added.
-- =============================================================================

do $$
begin
  if coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true'
    or coalesce(current_setting('app.charitme_allow_demo_seed', true), '') <> 'true'
  then
    raise exception 'Demo seed blocked: this database is not marked as disposable.';
  end if;
end $$;

do $$
declare
  v_existing integer;
  v_target   constant integer := 120;
  v_needed   integer;
begin
  select count(*) into v_existing from public.sponsors;
  v_needed := greatest(0, v_target - v_existing);

  if v_needed = 0 then
    raise notice 'CharitMe seed 08: sponsors already at % rows (target %); nothing inserted.',
      v_existing, v_target;
    return;
  end if;

  -- `name` is NOT NULL with no unique constraint, so the suffix keeps seeded
  -- rows distinguishable from real ones and from each other across re-runs.
  insert into public.sponsors (name, logo_url, website, active, sort_order)
  select
    'Seed Sponsor ' || (v_existing + g),
    'https://picsum.photos/seed/charitme-sponsor-' || (v_existing + g) || '/240/120',
    'https://sponsor-' || (v_existing + g) || '.example.com',
    -- A realistic mix: most active, some archived, so /admin/sponsors and the
    -- public /sponsor page exercise both states.
    (mod(g, 7) <> 0),
    v_existing + g
  from generate_series(1, v_needed) g;

  raise notice 'CharitMe seed 08: sponsors topped up from % to % rows.',
    v_existing, v_existing + v_needed;
end $$;
