-- =============================================================================
-- CharitMe seed · 03 · Events & peer fundraising
--   fundraising_events, event_tickets, event_registrations, event_checkins,
--   peer_fundraisers — 120 rows each.
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
  v_event uuid[]; v_tick uuid[]; v_reg uuid[];
begin
  select array_agg(id) into v_users from public.profiles;
  n_users := coalesce(array_length(v_users, 1), 0);
  select array_agg(id) into v_camps from public.campaigns;
  n_camps := coalesce(array_length(v_camps, 1), 0);
  if n_users = 0 or n_camps = 0 then
    raise exception 'Need profiles and campaigns first. Run 00 and 01.';
  end if;

  with ins as (
    insert into public.fundraising_events
      (campaign_id, title, slug, event_type, starts_at, ends_at, location, virtual_url, status)
    select v_camps[1 + (g % n_camps)],
           'Seed Event ' || g || ' — ' || (array['Gala','Giving Day','Auction','Livestream'])[1 + (g % 4)],
           'seed-event-' || v_suffix || '-' || g,
           (array['fundraiser','gala','giving_day','livestream','auction'])[1 + (g % 5)],
           now() + (((g % 60) + 3) || ' days')::interval,
           now() + (((g % 60) + 4) || ' days')::interval,
           (array['Austin, TX','Denver, CO','Online','Miami, FL'])[1 + (g % 4)],
           case when g % 2 = 0 then 'https://example.org/live/' || g else null end,
           (array['draft','published','published','completed'])[1 + (g % 4)]
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_event from ins;

  with ins as (
    insert into public.event_tickets (event_id, title, price_cents, quantity_limit, sold_count)
    select v_event[g], (array['General','VIP','Table','Student'])[1 + (g % 4)] || ' Admission',
           ((g % 10) + 1) * 2500, ((g % 5) + 1) * 50, (g % 25)
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_tick from ins;

  with ins as (
    insert into public.event_registrations
      (event_id, ticket_id, attendee_id, attendee_email, attendee_name, quantity, amount_cents)
    select v_event[g], v_tick[g], v_users[1 + (g % n_users)],
           format('seed.attendee.%s@charitme.test', g), 'Attendee ' || g,
           1 + (g % 4), ((g % 10) + 1) * 2500
    from generate_series(1, 120) g
    returning id
  ) select array_agg(id) into v_reg from ins;

  -- One check-in per registration (registration_id is unique).
  insert into public.event_checkins (registration_id, event_id, checked_in_by)
  select v_reg[g], v_event[g], v_users[1 + (g % n_users)]
  from generate_series(1, 120) g
  on conflict do nothing;

  -- Peer / team fundraisers under a parent campaign.
  insert into public.peer_fundraisers
    (parent_campaign_id, fundraiser_id, slug, title, goal_amount, raised_amount, status)
  select v_camps[1 + (g % n_camps)], v_users[1 + (g % n_users)],
         'seed-peer-' || v_suffix || '-' || g,
         'Team Member ' || g || '''s Page', ((g % 10) + 1) * 100000, (g % 10) * 25000,
         (array['active','active','paused','completed'])[1 + (g % 4)]
  from generate_series(1, 120) g
  on conflict do nothing;

  raise notice 'CharitMe seed 03: events, tickets, registrations, check-ins, peer fundraisers seeded.';
end $$;
