-- =============================================================================
-- CharitMe seed · 02 · Marketplaces
--   sponsorship_opportunities/requests, grants (+deadlines/applications/
--   documents/matches), matching_programs/claims, volunteer_opportunities/
--   profiles/applications, nonprofit_profiles — 120 rows each (profiles table
--   is per-user, so it reaches min(120, #users)).
-- Requires: profiles (00) and campaigns (01).
-- =============================================================================
do $$
begin
  if current_setting('app.charitme_allow_demo_seed', true) <> 'true' then
    raise exception 'Demo seed blocked. Set app.charitme_allow_demo_seed = true only on a disposable staging/demo project.';
  end if;
end $$;

do $$
declare
  v_users uuid[]; v_camps uuid[];
  n_users int;    n_camps int;
  v_suffix text := to_hex(floor(extract(epoch from now()))::bigint);
  v_opp uuid[]; v_grant uuid[]; v_gapp uuid[]; v_prog uuid[]; v_vopp uuid[];
begin
  select array_agg(id) into v_users from public.profiles;
  n_users := coalesce(array_length(v_users, 1), 0);
  select array_agg(id) into v_camps from public.campaigns;
  n_camps := coalesce(array_length(v_camps, 1), 0);
  if n_users = 0 or n_camps = 0 then
    raise exception 'Need profiles and campaigns first. Run 00 and 01.';
  end if;

  -- ── Sponsorships ──────────────────────────────────────────────────────────
  with ins as (
    insert into public.sponsorship_opportunities
      (organizer_id, campaign_id, title, description, category, benefits,
       min_amount_cents, target_amount_cents, raised_amount_cents, status)
    select v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
           'Sponsor Opportunity ' || g || ' — Community Partner',
           'We are seeking sponsors to support this initiative. Seed opportunity #' || g || '.',
           (array['Community','Sports','Education','Health'])[1 + (g % 4)],
           'Logo placement, social shoutouts, and an event booth.',
           ((g % 10) + 1) * 50000,
           ((g % 10) + 5) * 100000,
           (g % 5) * 50000,
           (array['open','open','open','draft','fulfilled'])[1 + (g % 5)]
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_opp from ins;

  insert into public.sponsorship_requests
    (opportunity_id, sponsor_id, company_name, amount_cents, message, benefits_requested, status)
  select v_opp[g], v_users[1 + (g % n_users)],
         'Acme Co ' || g, ((g % 10) + 1) * 25000,
         'We would love to sponsor this. Seed request #' || g || '.',
         'Logo on the event banner.',
         (array['pending','pending','accepted','declined','fulfilled'])[1 + (g % 5)]
  from generate_series(1, 120) g
  on conflict do nothing;

  -- ── Grants ────────────────────────────────────────────────────────────────
  with ins as (
    insert into public.grants
      (slug, title, funder_name, funder_type, summary, description, category, focus_areas,
       eligibility, eligible_entity_types, amount_min, amount_max, currency, location, country,
       application_url, deadline_at, rolling_deadline, status, source, created_by, verified)
    select 'seed-grant-' || v_suffix || '-' || g,
           'Seed Grant ' || g || ' for ' || (array['Education','Health','Environment','Arts'])[1 + (g % 4)],
           (array['Ford Foundation','Gates Foundation','City of Austin','Acme Corp Giving'])[1 + (g % 4)],
           (array['foundation','government','corporate','community'])[1 + (g % 4)],
           'A grant opportunity for mission-driven organizations. Seed #' || g || '.',
           'Full description of grant #' || g || ', including priorities and review criteria.',
           (array['Education','Health','Environment','Arts'])[1 + (g % 4)],
           array['education','community'], 'Open to registered nonprofits and fiscally sponsored projects.',
           array['nonprofit','individual'],
           ((g % 5) + 1) * 100000, ((g % 5) + 10) * 100000, 'USD', 'United States', 'US',
           'https://example.org/grants/' || g,
           now() + (((g % 60) + 5) || ' days')::interval,
           (g % 5 = 0),
           (array['open','open','upcoming','closed'])[1 + (g % 4)],
           'seed', v_users[1 + (g % n_users)], (g % 2 = 0)
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_grant from ins;

  insert into public.grant_deadlines (grant_id, label, kind, due_at)
  select v_grant[g], 'Deadline ' || g, (array['loi','application','report','award'])[1 + (g % 4)],
         now() + (((g % 90) + 7) || ' days')::interval
  from generate_series(1, 120) g;

  with ins as (
    insert into public.grant_applications
      (grant_id, applicant_user_id, campaign_id, organization_name, status,
       amount_requested, narrative, submitted_at)
    select v_grant[g], v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
           'Nonprofit ' || g,
           (array['draft','submitted','under_review','awarded','rejected'])[1 + (g % 5)],
           ((g % 8) + 1) * 50000, 'Our proposal narrative for grant #' || g || '.',
           case when g % 5 = 0 then null else now() - ((g % 30) || ' days')::interval end
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_gapp from ins;

  insert into public.grant_documents (application_id, uploaded_by, file_url, file_name, doc_type)
  select v_gapp[g], v_users[1 + (g % n_users)],
         'https://example.org/docs/' || g || '.pdf', 'proposal-' || g || '.pdf',
         (array['budget','narrative','990','letter'])[1 + (g % 4)]
  from generate_series(1, 120) g;

  insert into public.grant_matches (grant_id, user_id, campaign_id, score, reasons)
  select v_grant[g], v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
         round((40 + (g % 60))::numeric, 2),
         jsonb_build_array('focus area match', 'geography match')
  from generate_series(1, 120) g
  on conflict do nothing;

  -- ── Matching gifts ────────────────────────────────────────────────────────
  with ins as (
    insert into public.matching_programs
      (sponsor_id, company_name, description, match_ratio, annual_cap_cents,
       min_donation_cents, categories, status)
    select v_users[1 + (g % n_users)], 'Employer ' || g || ' Inc',
           'Corporate matching program. Seed #' || g || '.',
           (array[1.0, 1.0, 2.0, 0.5])[1 + (g % 4)]::numeric,
           ((g % 10) + 1) * 1000000, ((g % 5) + 1) * 1000,
           array['Education','Health'], (array['active','active','paused','closed'])[1 + (g % 4)]
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_prog from ins;

  insert into public.matching_claims
    (program_id, employee_id, campaign_id, donation_amount_cents, match_amount_cents, status, note)
  select v_prog[g], v_users[1 + (g % n_users)], v_camps[1 + (g % n_camps)],
         ((g % 10) + 1) * 5000, ((g % 10) + 1) * 5000,
         (array['pending','approved','declined','paid'])[1 + (g % 4)],
         'Matching claim #' || g
  from generate_series(1, 120) g;

  -- ── Volunteers ────────────────────────────────────────────────────────────
  with ins as (
    insert into public.volunteer_opportunities
      (slug, title, org_name, summary, description, category, skills, location, country,
       is_remote, slots, time_commitment, campaign_id, status, verified, created_by)
    select 'seed-vol-' || v_suffix || '-' || g,
           'Volunteer Role ' || g, 'Helping Hands ' || g,
           'Join us to make a difference. Seed #' || g || '.',
           'Detailed description for volunteer role #' || g || '.',
           (array['Events','Outreach','Admin','Fundraising'])[1 + (g % 4)],
           array['communication','teamwork'],
           (array['Austin, TX','Remote','Denver, CO','Miami, FL'])[1 + (g % 4)], 'US',
           (g % 3 = 0), ((g % 10) + 5), (2 + (g % 8)) || ' hrs/week',
           v_camps[1 + (g % n_camps)],
           (array['open','open','upcoming','closed'])[1 + (g % 4)], (g % 2 = 0),
           v_users[1 + (g % n_users)]
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_vopp from ins;

  insert into public.volunteer_applications
    (opportunity_id, applicant_user_id, message, status, hours_logged, hours_verified)
  select v_vopp[g], v_users[1 + (g % n_users)],
         'I would love to help. Seed application #' || g || '.',
         (array['applied','accepted','declined','completed'])[1 + (g % 4)],
         round(((g % 20))::numeric, 2), (g % 3 = 0)
  from generate_series(1, 120) g;

  -- volunteer_profiles: PK is user_id → one per user (reaches min(120, #users)).
  insert into public.volunteer_profiles
    (user_id, headline, bio, skills, interests, location, country, availability, remote_ok, is_public)
  select u, 'Passionate volunteer', 'I care about my community and want to help.',
         array['communication','logistics'], array['education','environment'],
         'Austin, TX', 'US', 'Weekends', true, true
  from unnest(v_users) u
  on conflict do nothing;

  -- ── Nonprofit profiles ────────────────────────────────────────────────────
  insert into public.nonprofit_profiles (owner_id, name, slug, mission, tax_id, website_url, verified)
  select v_users[1 + (g % n_users)], 'Seed Nonprofit ' || g,
         'seed-nonprofit-' || v_suffix || '-' || g,
         'Our mission is to serve the community. Seed #' || g || '.',
         '00-' || lpad(g::text, 7, '0'), 'https://example.org/np/' || g, (g % 2 = 0)
  from generate_series(1, 120) g
  on conflict do nothing;

  raise notice 'CharitMe seed 02: marketplaces seeded (sponsorships, grants, matching, volunteers, nonprofits).';
end $$;
