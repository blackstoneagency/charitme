-- =============================================================================
-- RaiseMoney / CharitMe — seed data
-- =============================================================================
-- Local reset data. The synthetic identities have no password and use the
-- reserved .invalid domain, so they cannot receive mail or authenticate.
-- =============================================================================

do $$
begin
  if exists (
    select 1
    from auth.users
    where coalesce(lower(email), '') not like '%@charitme.invalid'
      and coalesce(lower(email), '') not like '%@charitme.test'
      and coalesce(lower(email), '') not like '%@example.test'
  ) then
    raise exception 'Local demo seed blocked: non-demo auth users already exist.';
  end if;
end $$;

set charitme.allow_demo_seed = 'true';
set app.charitme_allow_demo_seed = 'true';

do $$
declare
  v_admin_id   uuid := '10000000-0000-4000-8000-000000000001';
  v_donor_id   uuid := '10000000-0000-4000-8000-000000000002';
  v_c1_id      uuid := gen_random_uuid();
  v_c2_id      uuid := gen_random_uuid();
  v_c3_id      uuid := gen_random_uuid();
  v_suffix     text := to_hex(floor(extract(epoch from now()))::bigint);
begin

  -- -------------------------------------------------------------------------
  -- Create deterministic synthetic users without login credentials.
  -- -------------------------------------------------------------------------
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values
    (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'seed-organizer@charitme.invalid',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Seed Organizer"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_donor_id,
      'authenticated',
      'authenticated',
      'seed-donor@charitme.invalid',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Seed Donor"}'::jsonb,
      now(),
      now()
    )
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------------
  -- Assign representative roles to the synthetic users.
  -- -------------------------------------------------------------------------
  update public.profiles
  set roles = '["admin","super_admin","organizer","donor"]'::jsonb,
      is_demo = true
  where id = v_admin_id;

  update public.profiles
  set roles = '["donor"]'::jsonb,
      is_demo = true
  where id = v_donor_id;

  -- -------------------------------------------------------------------------
  -- Campaigns
  -- -------------------------------------------------------------------------
  insert into public.campaigns(
    id, user_id, slug, title, tagline, description, category,
    goal_amount, raised_amount, backer_count, status, deadline,
    trust_status, campaign_health_score, is_demo
  ) values
    (
      v_c1_id, v_admin_id,
      'help-sarah-fight-cancer-' || v_suffix,
      'Help Sarah Fight Cancer',
      'Sarah is a single mom battling stage 3 breast cancer. Your support covers treatment costs.',
      'Sarah was diagnosed with stage 3 breast cancer six months ago. As a single mother of two, '
      'she is fighting for her life while trying to keep her family together. Treatment costs have '
      'already exceeded $40,000 and the bills keep coming. Every dollar you donate goes directly '
      'to her medical bills, childcare during chemo, and living expenses. Sarah has submitted her '
      'medical records and identity documents for verification. 100% of donations go directly to '
      'Sarah — CharitMe charges no platform fee.',
      'Medical',
      1500000, 427850, 83, 'active',
      current_date + interval '45 days',
      'Verified', 82, true
    ),
    (
      v_c2_id, v_admin_id,
      'rebuild-millbrook-after-tornado-' || v_suffix,
      'Rebuild Millbrook After Tornado',
      'An EF-3 tornado destroyed 47 homes. Help our community get back on its feet.',
      'On March 12th, an EF-3 tornado tore through Millbrook, destroying 47 homes and displacing '
      'more than 180 residents. The town has little insurance coverage for damage of this magnitude. '
      'We are raising funds to provide temporary housing, clear debris, and begin rebuilding. Local '
      'volunteers are already on the ground. Every dollar is tracked through our transparency ledger. '
      '100% of donations go to affected families — CharitMe charges no platform fee.',
      'Emergency',
      5000000, 1823400, 312, 'active',
      current_date + interval '30 days',
      'Established', 74, true
    ),
    (
      v_c3_id, v_admin_id,
      'stem-scholarships-for-girls-' || v_suffix,
      'STEM Scholarships for 20 Girls',
      'Send 20 underprivileged girls to STEM summer camp — changing futures one girl at a time.',
      'Our nonprofit has been running free STEM camps for low-income girls since 2018. This year '
      'we want to send 20 girls to a 2-week residential camp covering robotics, coding, and '
      'biomedical engineering. Each scholarship covers tuition ($1,200), travel, housing, and meals. '
      'Past campers have earned engineering degrees at MIT, Stanford, and Georgia Tech. '
      '100% of donations fund scholarships — CharitMe charges no platform fee.',
      'Education',
      2400000, 965000, 148, 'active',
      current_date + interval '60 days',
      'Highly Trusted', 91, true
    )
  on conflict (slug) do nothing;

  -- -------------------------------------------------------------------------
  -- Trust scores
  -- -------------------------------------------------------------------------
  insert into public.trust_scores(campaign_id, score, status, signals, model) values
    (v_c1_id, 82, 'Verified',
      '["identity_verified","description_complete","cover_image"]'::jsonb, 'deterministic'),
    (v_c2_id, 74, 'Established',
      '["description_complete","cover_image","active_backers"]'::jsonb, 'deterministic'),
    (v_c3_id, 91, 'Highly Trusted',
      '["identity_verified","nonprofit_verified","description_complete","cover_image","active_backers"]'::jsonb, 'deterministic')
  on conflict do nothing;

  -- -------------------------------------------------------------------------
  -- Sample donations
  -- -------------------------------------------------------------------------
  insert into public.donations(
    campaign_id, donor_id, amount_cents, message, anonymous, status, is_demo
  ) values
    (v_c1_id, v_donor_id,  5000, 'Sending love and prayers, Sarah!', false, 'completed', true),
    (v_c1_id, null,       10000, null,                                true,  'completed', true),
    (v_c2_id, v_donor_id,  2500, 'Stay strong, Millbrook!',          false, 'completed', true),
    (v_c3_id, v_donor_id, 15000, 'Education changes everything.',    false, 'completed', true)
  on conflict do nothing;

  raise notice 'Seed complete. Admin user: %, Donor user: %', v_admin_id, v_donor_id;

end $$;
