-- =============================================================================
-- CharitMe seed · 04 · Impact tracking & gamification
--   impact_plans (1:1 with a campaign), impact_plan_items, impact_updates,
--   impact_evidence, impact_metrics, challenges, challenge_participants,
--   user_badges — 120 rows each (participants/badges reach min(120, #users)).
-- Requires: profiles (00) and >=120 campaigns (01).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- DEMO-SEED GUARD — refuses to run unless this database is explicitly marked as
-- a disposable demo/staging target.
--
-- Why: scripts/seed-guard.mjs already protects the JS seed runners, but THESE
-- files are pasted straight into the Supabase SQL editor, which bypasses it
-- entirely — and that is the path that actually loaded demo data into
-- production. These seeds are also NOT idempotent (see the header note: "Run
-- once. Re-running appends more rows"), so an accidental re-run silently
-- duplicates campaigns and donations.
--
-- To run against a throwaway project, execute this FIRST in the same session:
--     set charitme.allow_demo_seed = 'true';
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true' then
    raise exception 'Demo seed blocked: this database is not marked as a disposable demo/staging target.'
      using hint = 'If this really is a throwaway project, run  set charitme.allow_demo_seed = ''true'';  in the SAME session, then re-run this file.';
  end if;
end $$;

do $$
begin
  if coalesce(current_setting('app.charitme_allow_demo_seed', true), '') <> 'true'
     and coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true' then
    raise exception 'Demo seed blocked. Mark only a disposable staging/demo project before seeding.';
  end if;
end $$;

do $$
declare
  v_users uuid[]; v_camps uuid[];
  n_users int;    n_camps int; n_plan int;
  v_suffix text := to_hex(floor(extract(epoch from now()))::bigint);
  v_plan uuid[]; v_upd uuid[]; v_chal uuid[];
begin
  select array_agg(id) into v_users from public.profiles;
  n_users := coalesce(array_length(v_users, 1), 0);
  select array_agg(id) into v_camps from public.campaigns;
  n_camps := coalesce(array_length(v_camps, 1), 0);
  if n_users = 0 or n_camps = 0 then
    raise exception 'Need profiles and campaigns first. Run 00 and 01.';
  end if;

  -- impact_plans: campaign_id is UNIQUE → one plan per campaign.
  n_plan := least(120, n_camps);
  with ins as (
    insert into public.impact_plans (campaign_id, created_by, title, summary, total_budget_cents, status)
    select v_camps[g], v_users[1 + (g % n_users)],
           'Impact Plan ' || g, 'How funds for campaign #' || g || ' will be spent.',
           ((g % 20) + 1) * 100000, (array['draft','published','published'])[1 + (g % 3)]
    from generate_series(1, n_plan) g
    returning id
  ) select array_agg(id) into v_plan from ins;

  insert into public.impact_plan_items (plan_id, label, category, planned_amount_cents, spent_amount_cents, sort)
  select v_plan[1 + (g % array_length(v_plan, 1))],
         (array['Direct aid','Supplies','Logistics','Staffing'])[1 + (g % 4)] || ' #' || g,
         (array['aid','supplies','ops','staff'])[1 + (g % 4)],
         ((g % 10) + 1) * 25000, (g % 10) * 10000, (g % 10)
  from generate_series(1, 120) g;

  with ins as (
    insert into public.impact_updates (campaign_id, author_id, title, body, amount_spent_cents, status)
    select v_camps[1 + (g % n_camps)], v_users[1 + (g % n_users)],
           'Impact Update ' || g,
           'Here is how your support made a difference this period. Seed update #' || g || '.',
           ((g % 10) + 1) * 15000, (array['draft','published','published'])[1 + (g % 3)]
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_upd from ins;

  insert into public.impact_evidence (update_id, kind, url, caption)
  select v_upd[g], (array['image','receipt','video','document','link'])[1 + (g % 5)],
         'https://example.org/evidence/' || g || '.jpg', 'Evidence for update #' || g
  from generate_series(1, 120) g;

  insert into public.impact_metrics (campaign_id, label, unit, target_value, current_value, sort)
  select v_camps[1 + (g % n_camps)],
         (array['Meals served','Families housed','Trees planted','Students funded'])[1 + (g % 4)],
         (array['meals','families','trees','students'])[1 + (g % 4)],
         ((g % 50) + 10) * 10, (g % 50) * 8, (g % 10)
  from generate_series(1, 120) g;

  -- ── Gamification ──────────────────────────────────────────────────────────
  with ins as (
    insert into public.challenges (slug, title, description, metric, goal_value, starts_at, ends_at, status)
    select 'seed-challenge-' || v_suffix || '-' || g,
           'Challenge ' || g || ': ' || (array['Give Five','$100 Hero','Three-Cause Champion'])[1 + (g % 3)],
           'A community giving challenge. Seed #' || g || '.',
           (array['donation_count','total_cents','campaign_count'])[1 + (g % 3)],
           ((g % 10) + 1) * 5, now() - ((g % 10) || ' days')::interval,
           now() + (((g % 30) + 5) || ' days')::interval,
           (array['active','active','completed'])[1 + (g % 3)]
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_chal from ins;

  -- unique(challenge_id, user_id): pair each challenge with one user.
  insert into public.challenge_participants (challenge_id, user_id, progress_value, completed_at)
  select v_chal[g], v_users[1 + (g % n_users)], (g % 20),
         case when g % 4 = 0 then now() - ((g % 5) || ' days')::interval else null end
  from generate_series(1, 120) g
  on conflict do nothing;

  -- unique(user_id, badge_id): badge id is unique per row.
  insert into public.user_badges (user_id, badge_id)
  select v_users[1 + (g % n_users)],
         (array['first-gift','generous-heart','streak-keeper','campaign-starter','community-champion'])[1 + (g % 5)]
           || '-' || g
  from generate_series(1, 120) g
  on conflict do nothing;

  raise notice 'CharitMe seed 04: impact tracking and gamification seeded.';
end $$;
