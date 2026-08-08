-- =============================================================================
-- CharitMe seed · 09 · Deterministic full-platform volume and tenant isolation
-- =============================================================================

do $$
begin
  if coalesce(current_setting('charitme.allow_demo_seed', true), '') <> 'true'
    or coalesce(current_setting('app.charitme_allow_demo_seed', true), '') <> 'true'
  then
    raise exception 'Demo seed blocked: this database is not marked as disposable.';
  end if;
end
$$;

do $$
declare
  users uuid[];
  user_count integer;
  org_a constant uuid := md5('charitme-seed09-org-a')::uuid;
  org_b constant uuid := md5('charitme-seed09-org-b')::uuid;
  mismatch_count bigint;
  row_count bigint;
begin
  select array_agg(id order by created_at, id)
  into users
  from (
    select id, created_at
    from public.profiles
    where is_demo
    order by created_at, id
    limit 120
  ) demo_users;

  user_count := coalesce(array_length(users, 1), 0);
  if user_count < 2 then
    raise exception 'Seed 09 requires at least two demo profiles.';
  end if;

  insert into public.organizations (id, slug, name, description, plan, status, created_by)
  values
    (org_a, 'seed09-tenant-a', 'Seed 09 Tenant A', 'Disposable tenant-isolation fixture.', 'pro', 'active', users[1]),
    (org_b, 'seed09-tenant-b', 'Seed 09 Tenant B', 'Disposable tenant-isolation fixture.', 'starter', 'active', users[2])
  on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      description = excluded.description,
      plan = excluded.plan,
      status = excluded.status,
      created_by = excluded.created_by,
      deleted_at = null,
      updated_at = now();

  insert into public.organization_members (id, org_id, user_id, role, invited_by)
  values
    (md5('charitme-seed09-member-a')::uuid, org_a, users[1], 'owner', users[1]),
    (md5('charitme-seed09-member-b')::uuid, org_b, users[2], 'owner', users[2])
  on conflict (id) do update
  set org_id = excluded.org_id,
      user_id = excluded.user_id,
      role = excluded.role,
      invited_by = excluded.invited_by,
      deleted_at = null,
      updated_at = now();

  insert into public.campaigns (
    id, user_id, slug, title, description, category, goal_amount, raised_amount,
    backer_count, deadline, status, visibility, is_demo
  )
  select
    md5('charitme-seed09-campaign:' || series)::uuid,
    users[1 + mod(series - 1, user_count)],
    'seed09-campaign-' || lpad(series::text, 4, '0'),
    'Seed 09 Campaign ' || series,
    'Disposable high-volume campaign fixture for CRUD, reporting, and relationship verification.',
    (array['Medical', 'Education', 'Community', 'Environment', 'Nonprofit'])[1 + mod(series - 1, 5)],
    100000 + (series * 100),
    0,
    0,
    date '2099-12-31',
    case when mod(series, 5) = 0 then 'draft' else 'active' end,
    case when mod(series, 7) = 0 then 'private' else 'public' end,
    true
  from generate_series(1, 500) series
  on conflict (id) do update
  set user_id = excluded.user_id,
      slug = excluded.slug,
      title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      goal_amount = excluded.goal_amount,
      deadline = excluded.deadline,
      status = excluded.status,
      visibility = excluded.visibility,
      is_demo = true,
      deleted_at = null,
      updated_at = now();

  insert into public.donations (
    id, campaign_id, donor_id, amount_cents, message, anonymous, status,
    payment_method, source, currency, is_demo
  )
  select
    md5('charitme-seed09-donation:' || series)::uuid,
    md5('charitme-seed09-campaign:' || series)::uuid,
    users[1 + mod(series, user_count)],
    1000 + (mod(series, 100) * 100),
    'Seed 09 donation ' || series,
    mod(series, 10) = 0,
    'completed',
    'seed',
    'seed09',
    'usd',
    true
  from generate_series(1, 500) series
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      donor_id = excluded.donor_id,
      amount_cents = excluded.amount_cents,
      message = excluded.message,
      anonymous = excluded.anonymous,
      status = excluded.status,
      payment_method = excluded.payment_method,
      source = excluded.source,
      currency = excluded.currency,
      is_demo = true,
      updated_at = now();

  update public.campaigns campaign
  set raised_amount = donation.amount_cents,
      backer_count = 1,
      updated_at = now()
  from public.donations donation
  where campaign.id = donation.campaign_id
    and donation.source = 'seed09';

  insert into public.campaign_updates (id, campaign_id, user_id, title, body, ai_generated)
  select
    md5('charitme-seed09-update:' || series)::uuid,
    md5('charitme-seed09-campaign:' || series)::uuid,
    users[1 + mod(series - 1, user_count)],
    '[Seed 09] Campaign update ' || series,
    'Verified campaign update fixture ' || series || ' for list, detail, and edit workflows.',
    mod(series, 4) = 0
  from generate_series(1, 500) series
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      user_id = excluded.user_id,
      title = excluded.title,
      body = excluded.body,
      ai_generated = excluded.ai_generated;

  insert into public.notifications (id, user_id, kind, title, body, link, meta)
  select
    md5('charitme-seed09-notification:' || series)::uuid,
    users[1 + mod(series, user_count)],
    'seed09_volume',
    'Seed 09 notification ' || series,
    'Disposable notification fixture.',
    '/campaigns/seed09-campaign-' || lpad(series::text, 4, '0'),
    jsonb_build_object('seed_pack', '09', 'sequence', series)
  from generate_series(1, 500) series
  on conflict (id) do update
  set user_id = excluded.user_id,
      kind = excluded.kind,
      title = excluded.title,
      body = excluded.body,
      link = excluded.link,
      meta = excluded.meta;

  insert into public.donor_messages (id, donation_id, campaign_id, donor_id, message, visibility, anonymous)
  select
    md5('charitme-seed09-donor-message:' || series)::uuid,
    md5('charitme-seed09-donation:' || series)::uuid,
    md5('charitme-seed09-campaign:' || series)::uuid,
    users[1 + mod(series, user_count)],
    '[Seed 09] Donor message ' || series,
    case when mod(series, 8) = 0 then 'private' else 'public' end,
    mod(series, 10) = 0
  from generate_series(1, 500) series
  on conflict (id) do update
  set donation_id = excluded.donation_id,
      campaign_id = excluded.campaign_id,
      donor_id = excluded.donor_id,
      message = excluded.message,
      visibility = excluded.visibility,
      anonymous = excluded.anonymous;

  insert into public.campaign_analytics_events (id, campaign_id, event_type, source, metadata)
  select
    md5('charitme-seed09-analytics:' || series)::uuid,
    md5('charitme-seed09-campaign:' || series)::uuid,
    (array['view', 'share', 'donation_completed', 'update_viewed'])[1 + mod(series - 1, 4)],
    'seed09',
    jsonb_build_object('seed_pack', '09', 'sequence', series)
  from generate_series(1, 500) series
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      event_type = excluded.event_type,
      source = excluded.source,
      metadata = excluded.metadata;

  insert into public.direct_messages (id, sender_id, recipient_id, campaign_id, body)
  select
    md5('charitme-seed09-direct-message:' || series)::uuid,
    users[1 + mod(series - 1, user_count)],
    users[1 + mod(series, user_count)],
    md5('charitme-seed09-campaign:' || series)::uuid,
    '[Seed 09] Direct message ' || series
  from generate_series(1, 500) series
  on conflict (id) do update
  set sender_id = excluded.sender_id,
      recipient_id = excluded.recipient_id,
      campaign_id = excluded.campaign_id,
      body = excluded.body;

  insert into public.fundraising_events (
    id, campaign_id, title, slug, event_type, starts_at, ends_at, status, created_by, description, capacity
  )
  select
    md5('charitme-seed09-event:' || series)::uuid,
    md5('charitme-seed09-campaign:' || series)::uuid,
    'Seed 09 Event ' || series,
    'seed09-event-' || lpad(series::text, 4, '0'),
    (array['fundraiser', 'gala', 'giving_day', 'livestream', 'auction'])[1 + mod(series - 1, 5)],
    timestamptz '2099-01-01 12:00:00+00' + make_interval(days => series),
    timestamptz '2099-01-01 15:00:00+00' + make_interval(days => series),
    case when mod(series, 5) = 0 then 'draft' else 'published' end,
    users[1 + mod(series - 1, user_count)],
    'Disposable high-volume event fixture.',
    50 + mod(series, 450)
  from generate_series(1, 500) series
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      title = excluded.title,
      slug = excluded.slug,
      event_type = excluded.event_type,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      status = excluded.status,
      created_by = excluded.created_by,
      description = excluded.description,
      capacity = excluded.capacity,
      updated_at = now();

  insert into public.marketing_contacts (
    id, email, first_name, last_name, client_type, lifecycle_stage, preferred_channel,
    first_touch_source, lead_score, engagement_score, status, created_by, org_id
  )
  select
    md5('charitme-seed09-contact-' || tenant.code || ':' || series)::uuid,
    'seed09-' || tenant.code || '-' || series || '@charitme.invalid',
    'Seed09',
    upper(tenant.code) || '-' || series,
    case when mod(series, 3) = 0 then 'donor' else 'visitor' end,
    (array['subscriber', 'lead', 'donor', 'advocate'])[1 + mod(series - 1, 4)],
    'email',
    'seed09',
    mod(series, 101),
    mod(series * 3, 101),
    'active',
    tenant.owner_id,
    tenant.org_id
  from (
    values ('a', org_a, users[1]), ('b', org_b, users[2])
  ) as tenant(code, org_id, owner_id)
  cross join generate_series(1, 500) series
  on conflict (id) do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      client_type = excluded.client_type,
      lifecycle_stage = excluded.lifecycle_stage,
      preferred_channel = excluded.preferred_channel,
      first_touch_source = excluded.first_touch_source,
      lead_score = excluded.lead_score,
      engagement_score = excluded.engagement_score,
      status = excluded.status,
      created_by = excluded.created_by,
      org_id = excluded.org_id,
      updated_at = now();

  insert into public.marketing_events (
    id, contact_id, event_type, amount_cents, utm_source, utm_medium, utm_campaign,
    url, device, metadata, org_id
  )
  select
    md5('charitme-seed09-marketing-event-' || tenant.code || ':' || series)::uuid,
    md5('charitme-seed09-contact-' || tenant.code || ':' || series)::uuid,
    (array['page_view', 'form_submit', 'email_click', 'donation'])[1 + mod(series - 1, 4)],
    case when mod(series, 4) = 0 then 1000 + (series * 10) else null end,
    'seed09',
    'fixture',
    'tenant-' || tenant.code,
    '/campaigns/seed09-campaign-' || lpad(series::text, 4, '0'),
    (array['desktop', 'mobile', 'tablet'])[1 + mod(series - 1, 3)],
    jsonb_build_object('seed_pack', '09', 'tenant', tenant.code, 'sequence', series),
    tenant.org_id
  from (values ('a', org_a), ('b', org_b)) as tenant(code, org_id)
  cross join generate_series(1, 500) series
  on conflict (id) do update
  set contact_id = excluded.contact_id,
      event_type = excluded.event_type,
      amount_cents = excluded.amount_cents,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      url = excluded.url,
      device = excluded.device,
      metadata = excluded.metadata,
      org_id = excluded.org_id;

  select count(*) into row_count
  from public.campaigns
  where slug like 'seed09-campaign-%' and is_demo;
  if row_count <> 500 then
    raise exception 'Seed 09 campaign volume failed: expected 500, found %.', row_count;
  end if;

  foreach row_count in array array[
    (select count(*) from public.donations where source = 'seed09' and is_demo),
    (select count(*) from public.notifications where kind = 'seed09_volume'),
    (select count(*) from public.campaign_updates where title like '[Seed 09]%'),
    (select count(*) from public.donor_messages where message like '[Seed 09]%'),
    (select count(*) from public.campaign_analytics_events where source = 'seed09'),
    (select count(*) from public.direct_messages where body like '[Seed 09]%'),
    (select count(*) from public.fundraising_events where slug like 'seed09-event-%')
  ]
  loop
    if row_count <> 500 then
      raise exception 'Seed 09 feature volume failed: expected 500, found %.', row_count;
    end if;
  end loop;

  foreach row_count in array array[
    (select count(*) from public.marketing_contacts where org_id = org_a and first_touch_source = 'seed09'),
    (select count(*) from public.marketing_contacts where org_id = org_b and first_touch_source = 'seed09'),
    (select count(*) from public.marketing_events where org_id = org_a and metadata ->> 'seed_pack' = '09'),
    (select count(*) from public.marketing_events where org_id = org_b and metadata ->> 'seed_pack' = '09')
  ]
  loop
    if row_count <> 500 then
      raise exception 'Seed 09 tenant volume failed: expected 500, found %.', row_count;
    end if;
  end loop;

  select count(*) into mismatch_count
  from public.marketing_events event
  join public.marketing_contacts contact on contact.id = event.contact_id
  where event.metadata ->> 'seed_pack' = '09'
    and event.org_id is distinct from contact.org_id;
  if mismatch_count <> 0 then
    raise exception 'Seed 09 tenant isolation failed: % marketing events cross tenant boundaries.', mismatch_count;
  end if;

  select count(*) into mismatch_count
  from public.donations donation
  left join public.campaigns campaign on campaign.id = donation.campaign_id
  left join public.profiles donor on donor.id = donation.donor_id
  where donation.source = 'seed09'
    and (campaign.id is null or donor.id is null);
  if mismatch_count <> 0 then
    raise exception 'Seed 09 donation relationship check failed: % orphan rows.', mismatch_count;
  end if;

  select count(*) into mismatch_count
  from public.donor_messages message
  left join public.donations donation on donation.id = message.donation_id
  left join public.campaigns campaign on campaign.id = message.campaign_id
  left join public.profiles donor on donor.id = message.donor_id
  where message.message like '[Seed 09]%'
    and (donation.id is null or campaign.id is null or donor.id is null);
  if mismatch_count <> 0 then
    raise exception 'Seed 09 donor-message relationship check failed: % orphan rows.', mismatch_count;
  end if;

  raise notice 'Seed 09 verified: 500-row CRUD sets and two isolated 500-contact marketing tenants are ready.';
end
$$;
