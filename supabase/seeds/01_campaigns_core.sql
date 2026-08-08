-- =============================================================================
-- CharitMe seed · 01 · Campaigns core
--   campaigns (ensures >=120), campaign_updates, campaign_faqs,
--   campaign_milestones, campaign_rewards, donations, saved_campaigns,
--   notifications  — 120 rows each.
-- Requires: at least one profile (run 00_test_users.sql first for full coverage).
-- Run once. Re-running appends more rows (not idempotent for child tables).
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
  -- ⚠️ `coalesce` is load-bearing. `current_setting(..., true)` returns NULL when
  -- the setting is absent, and `NULL <> 'true'` is NULL — so `if NULL then` never
  -- fired and this guard was INERT in exactly the case it exists for: a database
  -- that was never marked as a disposable demo target. Verified on PostgreSQL 16.
  --
  -- Either setting is accepted. The file header documents
  -- `charitme.allow_demo_seed`, so requiring `app.charitme_allow_demo_seed` alone
  -- would have made the documented instructions fail once this guard started
  -- working.
  if coalesce(current_setting('app.charitme_allow_demo_seed', true), '') <> 'true'
     and coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true' then
    raise exception 'Demo seed blocked. Set app.charitme_allow_demo_seed = true only on a disposable staging/demo project.';
  end if;
end $$;

do $$
declare
  v_users   uuid[];
  v_camps   uuid[];
  n_users   int;
  n_camps   int;
  v_suffix  text := to_hex(floor(extract(epoch from now()))::bigint);
  v_cats    text[] := array['Medical','Emergency','Education','Community','Animal',
                            'Environment','Sports','Family','Nonprofit','Memorial'];
  v_stat    text[] := array['active','active','active','completed','paused'];
  v_new     uuid[];
begin
  select array_agg(id) into v_users from public.profiles;
  n_users := coalesce(array_length(v_users, 1), 0);
  if n_users = 0 then
    raise exception 'No profiles found. Run 00_test_users.sql or sign up an account first.';
  end if;

  -- Ensure at least 120 campaigns exist (some feature tables are 1:1 with a campaign).
  select array_agg(id) into v_camps from public.campaigns;
  n_camps := coalesce(array_length(v_camps, 1), 0);

  if n_camps < 120 then
    with ins as (
      insert into public.campaigns
        (user_id, slug, title, tagline, description, category, goal_amount,
         raised_amount, backer_count, status, trust_status, campaign_health_score,
         is_demo)
      select
        v_users[1 + (g % n_users)],
        'seed-campaign-' || v_suffix || '-' || g,
        'Seed Campaign ' || g || ' — ' || v_cats[1 + (g % 10)] || ' Fund',
        'Help us reach our goal for cause #' || g,
        'This is seed campaign number ' || g || ', created to exercise CharitMe features ' ||
          'end to end: donations, updates, FAQs, milestones, rewards, impact tracking, and more. ' ||
          'Thank you for supporting this test cause.',
        v_cats[1 + (g % 10)],
        ((g % 20) + 1) * 500000,               -- goal: $5,000 .. $100,000 (cents)
        ((g % 20)) * 25000,                     -- raised (cents)
        (g % 40),                               -- backers
        v_stat[1 + (g % 5)],
        (array['Verified','Established','Highly Trusted','Needs More Info'])[1 + (g % 4)],
        (g % 101),
        true
      from generate_series(1, 120) g
      returning id
    )
    select array_agg(id) into v_new from ins;
    v_camps := coalesce(v_camps, array[]::uuid[]) || v_new;
    n_camps := array_length(v_camps, 1);
  end if;

  -- campaign_updates ---------------------------------------------------------
  insert into public.campaign_updates (campaign_id, user_id, title, body, ai_generated)
  select v_camps[1 + (g % n_camps)], v_users[1 + (g % n_users)],
         'Update #' || g || ': progress report',
         'We hit a new milestone this week thanks to your support. Update body #' || g || '.',
         (g % 3 = 0)
  from generate_series(1, 120) g;

  -- campaign_faqs (guarded — table lives in schema.sql, may not be on every DB) -
  if to_regclass('public.campaign_faqs') is not null then
    insert into public.campaign_faqs (campaign_id, question, answer, sort_order, is_public, ai_generated)
    select v_camps[1 + (g % n_camps)],
           'How will donation #' || g || ' be used?',
           'Every dollar goes directly to the beneficiary; CharitMe charges a 0% platform fee. (seed ' || g || ')',
           (g % 10), true, (g % 4 = 0)
    from generate_series(1, 120) g;
  else
    raise notice 'skipping campaign_faqs (table not present)';
  end if;

  -- campaign_milestones (guarded — same reason) ------------------------------
  if to_regclass('public.campaign_milestones') is not null then
    insert into public.campaign_milestones (campaign_id, title, description, target_amount, sort_order)
    select v_camps[1 + (g % n_camps)],
           'Milestone ' || g, 'Reach the next funding tier.', ((g % 10) + 1) * 100000, (g % 10)
    from generate_series(1, 120) g;
  else
    raise notice 'skipping campaign_milestones (table not present)';
  end if;

  -- campaign_rewards ---------------------------------------------------------
  insert into public.campaign_rewards
    (campaign_id, title, description, amount_cents, estimated_delivery, item_limit, sort_order)
  select v_camps[1 + (g % n_camps)],
         'Reward Tier ' || g, 'A thank-you gift for supporters.',
         ((g % 10) + 1) * 2500, 'Ships in ' || (2 + (g % 6)) || ' weeks',
         case when g % 3 = 0 then 100 else null end, (g % 10)
  from generate_series(1, 120) g;

  -- donations ----------------------------------------------------------------
  -- Columns limited to those present in every deployed variant. tip_cents /
  -- processing_fee_cents (schema.sql only) default to 0 where they exist.
  insert into public.donations
    (campaign_id, donor_id, amount_cents, status, anonymous, message, currency,
     created_at, is_demo)
  select v_camps[1 + (g % n_camps)],
         case when g % 5 = 0 then null else v_users[1 + (g % n_users)] end,
         ((g % 20) + 1) * 2500,                                   -- $25 .. $500
         (array['completed','completed','completed','completed','refunded'])[1 + (g % 5)],
         (g % 5 = 0),
         (array['Sending love and support.','Praying for a full recovery.','Happy to help!','Stay strong.'])[1 + (g % 4)],
         'usd',
         now() - ((g % 90) || ' days')::interval,
         true
  from generate_series(1, 120) g;

  -- saved_campaigns (unique user+campaign) -----------------------------------
  insert into public.saved_campaigns (user_id, campaign_id)
  select v_users[1 + (g % n_users)], v_camps[g]
  from generate_series(1, least(120, n_camps)) g
  on conflict do nothing;

  -- notifications ------------------------------------------------------------
  insert into public.notifications (user_id, kind, title, body, link, meta)
  select v_users[1 + (g % n_users)],
         (array['receipt','payout_paid','campaign_review','sponsorship_offer','match_claim'])[1 + (g % 5)],
         'Notification #' || g,
         'This is a seeded notification to populate the bell menu.',
         '/dashboard',
         jsonb_build_object('seed', true, 'n', g)
  from generate_series(1, 120) g;

  raise notice 'CharitMe seed 01: campaigns=%, seeded 120 each of updates/faqs/milestones/rewards/donations/notifications.', n_camps;
end $$;
