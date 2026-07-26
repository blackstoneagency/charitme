-- =============================================================================
-- RaiseMoney / CharitMe — seed data
-- Creates 250 fake entries per seeded table for testing
-- =============================================================================
-- HOW TO USE:
--   1. Sign up at least ONE account through your app first.
--   2. Paste this entire file into Supabase SQL Editor and run it.
--   The seed automatically uses the first signed-up user as the organizer.
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
declare
  v_admin_id       uuid;
  v_donor_id       uuid;
  v_suffix         text := to_hex(floor(extract(epoch from now()))::bigint);
  v_campaign_ids   uuid[] := array[]::uuid[];
  v_campaign_id    uuid;
  v_categories     text[] := array[
    'Medical', 'Disaster Relief', 'Education', 'Animals', 'Community',
    'Memorial', 'Emergency', 'Sports', 'Faith', 'Nonprofit'
  ];
  v_titles         text[] := array[
    'Help Sarah Fight Cancer',
    'Rebuild Millbrook After Tornado',
    'STEM Scholarships for Girls',
    'Emergency Surgery Fund for Max',
    'Support the Johnson Family After Fire',
    'Clean Water for Rural Families',
    'Youth Soccer Travel Fund',
    'Memorial Fund for Coach Mike',
    'Save the Community Food Pantry',
    'Medical Bills for Baby Emma'
  ];
  v_statuses       text[] := array['active', 'active', 'active', 'active', 'paused'];
  v_trust_statuses text[] := array['Verified', 'Established', 'Highly Trusted'];
  v_messages       text[] := array[
    'Sending love and support.',
    'Praying for a full recovery.',
    'Happy to help this wonderful cause.',
    'Stay strong — your community is with you.',
    'Education changes everything.',
    'Every little bit helps.',
    'Wishing you strength and hope.',
    'Thank you for organizing this.',
    'In honor of everyone impacted.',
    'Keep going — you are not alone.'
  ];
  v_goal_amount    integer;
  v_raised_amount  integer;
  v_backer_count   integer;
  v_score          integer;
  v_trust_status   text;
  v_title          text;
  v_slug_title     text;
  i                integer;
begin

  -- -------------------------------------------------------------------------
  -- Find real users from auth.users (must exist before running seed)
  -- -------------------------------------------------------------------------
  select id into v_admin_id from auth.users order by created_at asc limit 1;
  select id into v_donor_id from auth.users order by created_at asc offset 1 limit 1;

  if v_admin_id is null then
    raise exception 'No users found in auth.users. Sign up at least one account through the app first, then re-run this seed.';
  end if;

  -- If only one user exists, use them as both organizer and donor
  if v_donor_id is null then
    v_donor_id := v_admin_id;
  end if;

  -- -------------------------------------------------------------------------
  -- Promote first user to admin + fundraiser role
  -- -------------------------------------------------------------------------
  update public.profiles
  set roles = '["admin","fundraiser","donor"]'::jsonb
  where id = v_admin_id;

  -- -------------------------------------------------------------------------
  -- Campaigns: 250 fake entries
  -- Amounts are stored in cents.
  -- -------------------------------------------------------------------------
  for i in 1..250 loop
    v_campaign_id := gen_random_uuid();
    v_campaign_ids := array_append(v_campaign_ids, v_campaign_id);

    v_title := v_titles[((i - 1) % array_length(v_titles, 1)) + 1] || ' #' || i;
    v_slug_title := lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g'));
    v_goal_amount := (50000 + ((i * 173) % 950000)) * 100;
    v_raised_amount := floor(v_goal_amount * (0.05 + (((i * 37) % 80)::numeric / 100)))::integer;
    v_backer_count := 5 + ((i * 11) % 495);
    v_score := 60 + ((i * 7) % 40);
    v_trust_status := case
      when v_score >= 90 then 'Highly Trusted'
      when v_score >= 75 then 'Verified'
      else 'Established'
    end;

    insert into public.campaigns(
      id, user_id, slug, title, tagline, description, category,
      goal_amount, raised_amount, backer_count, status, deadline,
      trust_status, campaign_health_score
    ) values (
      v_campaign_id,
      v_admin_id,
      v_slug_title || '-' || v_suffix,
      v_title,
      'A test campaign created for QA, demo, performance, and workflow validation.',
      'This is realistic fake seed data for testing the RaiseMoney / CharitMe fundraising platform. '
      || 'The campaign includes a meaningful story, a measurable goal, donor activity, trust status, '
      || 'and enough variation to test search, filtering, dashboards, reporting, campaign pages, and admin workflows. '
      || 'Campaign number ' || i || ' is safe to edit or delete during QA testing.',
      v_categories[((i - 1) % array_length(v_categories, 1)) + 1],
      v_goal_amount,
      v_raised_amount,
      v_backer_count,
      v_statuses[((i - 1) % array_length(v_statuses, 1)) + 1],
      current_date + (((i * 3) % 120) + 7) * interval '1 day',
      v_trust_status,
      v_score
    ) on conflict (slug) do nothing;
  end loop;

  -- -------------------------------------------------------------------------
  -- Trust scores: 250 fake entries, one per campaign
  -- -------------------------------------------------------------------------
  for i in 1..250 loop
    v_score := 60 + ((i * 7) % 40);
    v_trust_status := case
      when v_score >= 90 then 'Highly Trusted'
      when v_score >= 75 then 'Verified'
      else 'Established'
    end;

    insert into public.trust_scores(campaign_id, score, status, signals, model) values (
      v_campaign_ids[i],
      v_score,
      v_trust_status,
      case
        when v_score >= 90 then '["identity_verified","nonprofit_verified","description_complete","cover_image","active_backers"]'::jsonb
        when v_score >= 75 then '["identity_verified","description_complete","cover_image","active_backers"]'::jsonb
        else '["description_complete","cover_image","active_backers"]'::jsonb
      end,
      'deterministic'
    ) on conflict do nothing;
  end loop;

  -- -------------------------------------------------------------------------
  -- Donations: 250 fake entries
  -- -------------------------------------------------------------------------
  for i in 1..250 loop
    insert into public.donations(
      campaign_id, donor_id, amount_cents, message, anonymous, status
    ) values (
      v_campaign_ids[((i - 1) % array_length(v_campaign_ids, 1)) + 1],
      v_donor_id,
      (500 + ((i * 137) % 49500)),
      case when i % 5 = 0 then null else v_messages[((i - 1) % array_length(v_messages, 1)) + 1] end,
      (i % 4 = 0),
      case when i % 20 = 0 then 'pending' else 'completed' end
    ) on conflict do nothing;
  end loop;

  raise notice 'Seed complete. Created up to 250 campaigns, 250 trust scores, and 250 donations. Admin user: %, Donor user: %', v_admin_id, v_donor_id;

end $$;
