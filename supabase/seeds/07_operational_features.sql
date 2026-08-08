-- =============================================================================
-- CharitMe seed · 07 · Operational and post-launch features
-- Seeds 120 rows for user-facing tables added after the original 00-06 suite.
-- Requires 00-06 and the disposable demo-seed session guards.
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
  v_users uuid[];
  v_camps uuid[];
  v_donations uuid[];
  v_messages uuid[];
  v_segments uuid[];
  v_contacts uuid[];
  v_opportunities uuid[];
  v_nonprofits uuid[];
  v_creators uuid[];
  v_leads uuid[];
  v_marketing_contacts uuid[];
  v_orgs uuid[];
  v_shifts uuid[];
  v_team uuid[];
  v_forms uuid[];
  v_goals uuid[];
  v_plans uuid[];
begin
  select array_agg(id order by id) into v_users
  from (select id from public.profiles order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_camps
  from (select id from public.campaigns order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_donations
  from (select id from public.donations order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_messages
  from (select id from public.donor_messages order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_segments
  from (select id from public.donor_segments order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_contacts
  from (select id from public.donor_crm_contacts order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_opportunities
  from (select id from public.volunteer_opportunities order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_nonprofits
  from (select id from public.nonprofit_profiles order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_creators
  from (select id from public.creator_profiles order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_leads
  from (select id from public.business_leads order by created_at, id limit 120) rows;
  select array_agg(id order by id) into v_marketing_contacts
  from (select id from public.marketing_contacts order by created_at, id limit 120) rows;

  if array_length(v_users, 1) < 120
    or array_length(v_camps, 1) < 120
    or array_length(v_donations, 1) < 120
  then
    raise exception 'Seed 07 requires at least 120 profiles, campaigns, and donations.';
  end if;

  with inserted as (
    insert into public.organizations
      (slug, name, description, website_url, plan, status, created_by)
    select
      'seed-organization-' || g,
      'Seed Organization ' || g,
      'Disposable organization fixture for multitenant workflow testing.',
      'https://organization-' || g || '.example.test',
      (array['free', 'starter', 'pro'])[1 + mod(g, 3)],
      (array['active', 'active', 'active', 'suspended', 'archived'])[1 + mod(g, 5)],
      v_users[g]
    from generate_series(1, 120) g
    returning id
  )
  select array_agg(id order by id) into v_orgs from inserted;

  insert into public.organization_members (org_id, user_id, role, invited_by)
  select
    v_orgs[g],
    v_users[g],
    (array['owner', 'admin', 'editor', 'viewer', 'member'])[1 + mod(g, 5)],
    v_users[1 + mod(g, 120)]
  from generate_series(1, 120) g;

  insert into public.brands (org_id, slug, name, voice, palette, is_default)
  select
    v_orgs[g],
    'seed-brand-' || g,
    'Seed Brand ' || g,
    (array['warm', 'direct', 'hopeful', 'formal'])[1 + mod(g, 4)],
    jsonb_build_object('primary', '#6d28d9', 'accent', '#08763b'),
    true
  from generate_series(1, 120) g;

  with inserted as (
    insert into public.volunteer_shifts
      (opportunity_id, title, starts_at, ends_at, location, is_remote,
       capacity, filled_count, notes, checkin_code, status, created_by)
    select
      v_opportunities[g],
      'Seed Volunteer Shift ' || g,
      now() + (g || ' days')::interval,
      now() + (g || ' days')::interval + interval '3 hours',
      case when mod(g, 3) = 0 then null else 'Community Site ' || g end,
      mod(g, 3) = 0,
      20 + mod(g, 30),
      mod(g, 15),
      'Disposable shift fixture.',
      'SEED' || lpad(g::text, 6, '0'),
      (array['scheduled', 'scheduled', 'completed', 'cancelled'])[1 + mod(g, 4)],
      v_users[g]
    from generate_series(1, 120) g
    returning id
  )
  select array_agg(id order by id) into v_shifts from inserted;

  insert into public.volunteer_hours
    (shift_id, opportunity_id, volunteer_user_id, checked_in_at, checked_out_at,
     hours, source, status, verified_by, verified_at, notes)
  select
    v_shifts[g],
    shift.opportunity_id,
    v_users[1 + mod(g, 120)],
    now() - (g || ' days')::interval,
    now() - (g || ' days')::interval + interval '2 hours',
    2,
    (array['manual', 'check_in'])[1 + mod(g, 2)],
    (array['pending', 'verified', 'rejected'])[1 + mod(g, 3)],
    case when mod(g, 3) = 1 then v_users[g] else null end,
    case when mod(g, 3) = 1 then now() else null end,
    'Disposable volunteer-hours fixture.'
  from generate_series(1, 120) g
  join public.volunteer_shifts shift on shift.id = v_shifts[g];

  insert into public.campaign_wizard_drafts
    (user_id, step, story_mode, form, images, client_ts, title)
  select
    v_users[g],
    (array['type', 'basics', 'story', 'media', 'goal', 'review'])[1 + mod(g, 6)],
    (array['guided', 'ai'])[1 + mod(g, 2)],
    jsonb_build_object('title', 'Seed Draft ' || g, 'goalAmount', 5000 + g),
    '[]'::jsonb,
    1000000 + g,
    'Seed Campaign Draft ' || g
  from generate_series(1, 120) g;

  insert into public.donation_receipts
    (donation_id, donor_id, campaign_id, receipt_number, amount_cents,
     tip_cents, processing_fee_cents, currency, is_tax_deductible,
     campaign_title, donor_name, donor_email, email_sent_at, receipt_type)
  select
    d.id,
    d.donor_id,
    d.campaign_id,
    'RCP-SEED-' || lpad(g::text, 6, '0'),
    d.amount_cents,
    coalesce(d.tip_cents, 0),
    coalesce(d.processing_fee_cents, 0),
    coalesce(d.currency, 'usd'),
    false,
    c.title,
    p.full_name,
    case when d.donor_id is null then 'guest.' || g || '@example.test' else p.email end,
    now() - (g || ' hours')::interval,
    case when mod(g, 4) = 0 then 'recurring' else 'donation' end
  from generate_series(1, 120) g
  join public.donations d on d.id = v_donations[g]
  join public.campaigns c on c.id = d.campaign_id
  left join public.profiles p on p.id = d.donor_id;

  with inserted as (
    insert into public.team_members
      (campaign_id, user_id, role, invite_token, invite_email, invite_sent_at, permissions)
    select
      v_camps[g],
      v_users[1 + mod(g, 120)],
      (array['owner', 'admin', 'member', 'viewer'])[1 + mod(g, 4)],
      'seed-team-token-' || g,
      'team.member.' || g || '@example.test',
      now() - (g || ' hours')::interval,
      jsonb_build_object(
        'view_donors', true,
        'post_updates', mod(g, 4) < 3,
        'manage_payout', mod(g, 4) = 0
      )
    from generate_series(1, 120) g
    returning id
  )
  select array_agg(id order by id) into v_team from inserted;

  insert into public.beneficiary_invites
    (campaign_id, invited_by, email, token, beneficiary_id, accepted_at, expires_at)
  select
    c.id,
    c.user_id,
    'beneficiary.' || g || '@example.test',
    'seed-beneficiary-token-' || g,
    v_users[1 + mod(g, 120)],
    case when mod(g, 3) = 0 then now() - interval '1 day' else null end,
    now() + interval '30 days'
  from generate_series(1, 120) g
  join public.campaigns c on c.id = v_camps[g];

  insert into public.privacy_requests
    (user_id, type, status, note, resolution_note, resolver_id, resolved_at)
  select
    v_users[g],
    (array['export', 'deletion'])[1 + mod(g, 2)],
    (array['pending', 'in_progress', 'completed', 'rejected', 'cancelled'])[1 + mod(g, 5)],
    'Seed privacy request ' || g,
    case when mod(g, 5) >= 2 then 'Seed resolution ' || g else null end,
    case when mod(g, 5) >= 2 then v_users[1] else null end,
    case when mod(g, 5) >= 2 then now() else null end
  from generate_series(1, 120) g;

  insert into public.campaign_owner_replies
    (campaign_id, donor_message_id, owner_id, message)
  select
    m.campaign_id,
    m.id,
    c.user_id,
    'Thank you for supporting this campaign. Seed reply ' || g || '.'
  from generate_series(1, 120) g
  join public.donor_messages m on m.id = v_messages[g]
  join public.campaigns c on c.id = m.campaign_id;

  insert into public.donor_message_likes (donor_message_id, user_id)
  select v_messages[g], v_users[g]
  from generate_series(1, 120) g;

  insert into public.donor_segment_members (segment_id, contact_id)
  select v_segments[g], v_contacts[g]
  from generate_series(1, 120) g;

  insert into public.donor_tips (campaign_id, donor_id, amount_cents)
  select v_camps[g], v_users[g], 100 + g
  from generate_series(1, 120) g;

  insert into public.integration_connections (owner_id, provider, status, config)
  select
    v_users[g],
    (array['salesforce', 'mailchimp', 'zapier', 'google_analytics'])[1 + mod(g, 4)],
    (array['connected', 'paused', 'revoked', 'error'])[1 + mod(g, 4)],
    jsonb_build_object('seed', true, 'accountLabel', 'Fixture ' || g)
  from generate_series(1, 120) g;

  insert into public.campaign_analytics_events
    (campaign_id, event_type, source, metadata, created_at)
  select
    v_camps[g],
    (array['view', 'share', 'donate_click', 'checkout_start'])[1 + mod(g, 4)],
    (array['direct', 'search', 'social', 'email'])[1 + mod(g, 4)],
    jsonb_build_object('seed', true, 'sequence', g),
    now() - (g || ' hours')::interval
  from generate_series(1, 120) g;

  insert into public.analytics_snapshots
    (owner_id, campaign_id, snapshot_date, metrics, created_at)
  select
    c.user_id,
    c.id,
    current_date - mod(g, 30),
    jsonb_build_object(
      'raisedCents', g * 10000,
      'backerCount', 10 + g,
      'goalCents', 500000 + (g * 1000),
      'donationCount', 5 + g
    ),
    now() - (g || ' days')::interval
  from generate_series(1, 120) g
  join public.campaigns c on c.id = v_camps[g];

  insert into public.admin_notes
    (author_id, target_type, target_id, body, internal, pinned, created_at, updated_at)
  select
    v_users[1],
    'campaign',
    v_camps[g],
    'Disposable internal campaign note ' || g || '.',
    true,
    mod(g, 12) = 0,
    now() - (g || ' hours')::interval,
    now() - (g || ' hours')::interval
  from generate_series(1, 120) g;

  insert into public.platform_reports
    (title, kind, period_label, summary, published, sort_order, created_at, updated_at)
  select
    'Seed Platform Report ' || g,
    (array['impact', 'financial', 'annual'])[1 + mod(g, 3)],
    'FY ' || (2026 - mod(g, 10)),
    'Disposable draft report fixture ' || g || '.',
    false,
    g,
    now() - (g || ' days')::interval,
    now() - (g || ' days')::interval
  from generate_series(1, 120) g;

  insert into public.campaign_builder_events
    (session_id, user_id, path, step, event, meta, created_at)
  select
    'seed-builder-session-' || g,
    v_users[g],
    (array['guided', 'ai'])[1 + mod(g, 2)],
    (array['type', 'basics', 'story', 'media', 'goal', 'review'])[1 + mod(g, 6)],
    (array['enter', 'advance', 'back', 'publish', 'save_draft', 'abandon'])[1 + mod(g, 6)],
    jsonb_build_object('seed', true),
    now() - (g || ' hours')::interval
  from generate_series(1, 120) g;

  insert into public.coach_sessions (user_id, campaign_id, message_count)
  select v_users[g], v_camps[g], 1 + mod(g, 12)
  from generate_series(1, 120) g;

  insert into public.organizer_sends
    (campaign_id, organizer_id, template_key, target_group, subject, body,
     recipient_count, sent_count, suppressed_count, status)
  select
    c.id,
    c.user_id,
    (array['thank_you', 'update', 'milestone'])[1 + mod(g, 3)],
    (array['all', 'recent', 'recurring'])[1 + mod(g, 3)],
    'Seed organizer message ' || g,
    'Disposable organizer outreach fixture.',
    10 + mod(g, 90),
    8 + mod(g, 70),
    mod(g, 4),
    (array['sent', 'draft', 'failed'])[1 + mod(g, 3)]
  from generate_series(1, 120) g
  join public.campaigns c on c.id = v_camps[g];

  insert into public.share_events
    (campaign_id, sharer_id, team_member_id, channel, utm_source,
     utm_medium, utm_campaign, converted, donation_id, created_at)
  select
    v_camps[g],
    v_users[g],
    v_team[g],
    (array['link', 'email', 'sms', 'facebook', 'linkedin', 'whatsapp'])[1 + mod(g, 6)],
    'seed',
    'fixture',
    'seed-campaign-' || g,
    mod(g, 4) = 0,
    case when mod(g, 4) = 0 then v_donations[g] else null end,
    now() - (g || ' hours')::interval
  from generate_series(1, 120) g;

  insert into public.direct_messages
    (sender_id, recipient_id, campaign_id, body, read_at)
  select
    v_users[g],
    v_users[1 + mod(g, 120)],
    v_camps[g],
    'Seed direct message ' || g,
    case when mod(g, 2) = 0 then now() else null end
  from generate_series(1, 120) g;

  insert into public.message_thread_state
    (owner_id, donor_id, archived, last_read_at)
  select
    v_users[g],
    v_users[1 + mod(g, 120)],
    mod(g, 5) = 0,
    now() - (g || ' minutes')::interval
  from generate_series(1, 120) g;

  insert into public.campaign_reports
    (campaign_id, reporter_id, reason, details, status)
  select
    v_camps[g],
    v_users[g],
    (array['fraud', 'misleading', 'prohibited', 'other'])[1 + mod(g, 4)],
    'Disposable campaign report fixture ' || g,
    (array['open', 'triaged', 'investigating', 'resolved', 'dismissed'])[1 + mod(g, 5)]
  from generate_series(1, 120) g;

  insert into public.campaign_status_log
    (campaign_id, changed_by, from_status, to_status, reason, metadata)
  select
    v_camps[g],
    v_users[g],
    'draft',
    (array['active', 'paused', 'completed'])[1 + mod(g, 3)],
    'Seed status transition ' || g,
    jsonb_build_object('seed', true)
  from generate_series(1, 120) g;

  insert into public.commission_requests
    (creator_profile_id, requester_id, requester_email, title, brief, budget_cents, status)
  select
    v_creators[g],
    v_users[g],
    'commission.requester.' || g || '@example.test',
    'Seed Commission ' || g,
    'Disposable creative commission request.',
    10000 + (g * 100),
    (array['requested', 'quoted', 'accepted', 'in_progress', 'delivered', 'cancelled'])[1 + mod(g, 6)]
  from generate_series(1, 120) g;

  insert into public.contact_messages
    (name, email, subject, message, status, source, ip_hash)
  select
    'Seed Contact ' || g,
    'contact.' || g || '@example.test',
    'Seed support topic ' || g,
    'Disposable contact-message fixture.',
    (array['new', 'reviewing', 'closed', 'spam'])[1 + mod(g, 4)],
    'seed_suite',
    md5('seed-contact-' || g)
  from generate_series(1, 120) g;

  with inserted as (
    insert into public.donation_forms
      (nonprofit_id, campaign_id, title, slug, default_amounts_cents,
       recurring_enabled, currencies, embed_enabled)
    select
      v_nonprofits[g],
      v_camps[g],
      'Seed Donation Form ' || g,
      'seed-donation-form-' || g,
      array[2500, 5000, 10000, 25000],
      mod(g, 4) <> 0,
      array['usd'],
      true
    from generate_series(1, 120) g
    returning id
  )
  select array_agg(id order by id) into v_forms from inserted;

  insert into public.embedded_buttons
    (owner_id, campaign_id, creator_profile_id, donation_form_id, label, button_type, config)
  select
    v_users[g],
    v_camps[g],
    v_creators[g],
    v_forms[g],
    'Support Seed Campaign ' || g,
    (array['donate', 'tip', 'membership', 'product'])[1 + mod(g, 4)],
    jsonb_build_object('theme', case when mod(g, 2) = 0 then 'light' else 'dark' end)
  from generate_series(1, 120) g;

  insert into public.email_campaigns
    (owner_id, nonprofit_id, campaign_id, subject, body, status, scheduled_at, sent_at)
  select
    v_users[g],
    v_nonprofits[g],
    v_camps[g],
    'Seed Email Campaign ' || g,
    'Disposable email campaign body.',
    (array['draft', 'scheduled', 'sent', 'cancelled'])[1 + mod(g, 4)],
    case when mod(g, 4) = 1 then now() + interval '1 day' else null end,
    case when mod(g, 4) = 2 then now() - interval '1 day' else null end
  from generate_series(1, 120) g;

  insert into public.sms_campaigns
    (owner_id, nonprofit_id, campaign_id, keyword, body, status, scheduled_at, sent_at)
  select
    v_users[g],
    v_nonprofits[g],
    v_camps[g],
    'SEED' || g,
    'Seed SMS campaign ' || g,
    (array['draft', 'scheduled', 'sent', 'cancelled'])[1 + mod(g, 4)],
    case when mod(g, 4) = 1 then now() + interval '1 day' else null end,
    case when mod(g, 4) = 2 then now() - interval '1 day' else null end
  from generate_series(1, 120) g;

  insert into public.lead_outreach
    (business_lead_id, marketing_contact_id, short_code, channel, subject, body,
     email, email_valid, status, sent_at, click_count, created_by)
  select
    v_leads[g],
    v_marketing_contacts[g],
    'SEED' || lpad(g::text, 6, '0'),
    (array['email', 'sms', 'social'])[1 + mod(g, 3)],
    'Seed lead outreach ' || g,
    'Disposable lead-outreach fixture.',
    'lead.' || g || '@example.test',
    true,
    (array['drafted', 'ready', 'sent', 'clicked', 'converted', 'failed'])[1 + mod(g, 6)],
    case when mod(g, 6) >= 2 then now() - interval '1 day' else null end,
    mod(g, 5),
    v_users[g]
  from generate_series(1, 120) g;

  with inserted as (
    insert into public.marketing_goals
      (title, description, objective, natural_language_input, target_metric,
       baseline_value, target_value, unit, deadline, priority, geography,
       audience, category, budget_cents, channels, autonomy_level, constraints,
       status, confidence, forecast_value, owner_id, created_by)
    select
      'Seed Marketing Goal ' || g,
      'Disposable goal fixture.',
      'Increase qualified fundraiser starts.',
      'Grow verified campaign creation in market ' || g,
      (array['fundraiser_starts', 'donation_volume', 'recurring_donors',
             'donation_conversion', 'aeo_visibility', 'organic_traffic'])[1 + mod(g, 6)],
      g,
      g + 100,
      (array['count', 'cents', 'percent', 'ratio'])[1 + mod(g, 4)],
      current_date + (g || ' days')::interval,
      (array['low', 'medium', 'high', 'critical'])[1 + mod(g, 4)],
      'US',
      'Seed audience ' || mod(g, 8),
      'fundraising',
      100000 + (g * 1000),
      array['email', 'organic', 'social'],
      1 + mod(g, 4),
      jsonb_build_object('seed', true),
      (array['draft', 'active', 'paused', 'achieved', 'missed', 'archived'])[1 + mod(g, 6)],
      0.75,
      g + 80,
      v_users[g],
      v_users[g]
    from generate_series(1, 120) g
    returning id
  )
  select array_agg(id order by id) into v_goals from inserted;

  insert into public.marketing_opportunities
    (title, description, rationale, evidence, category, geography, audience,
     target_metric, est_impact_cents, est_starts, confidence, effort, cost_cents,
     time_to_value_days, score, status, source, dedupe_key, linked_goal_id, created_by)
  select
    'Seed Marketing Opportunity ' || g,
    'Disposable opportunity fixture.',
    'Derived from a seeded growth signal.',
    jsonb_build_object('seed', true, 'signal', g),
    'fundraising',
    'US',
    'Seed audience ' || mod(g, 8),
    'fundraiser_starts',
    100000 + (g * 500),
    10 + mod(g, 50),
    0.72,
    (array['low', 'medium', 'high'])[1 + mod(g, 3)],
    10000 + (g * 100),
    7 + mod(g, 30),
    mod(g, 101),
    (array['new', 'accepted', 'rejected', 'deferred', 'converted', 'archived'])[1 + mod(g, 6)],
    (array['rule', 'ai', 'manual'])[1 + mod(g, 3)],
    'seed-opportunity-' || g,
    v_goals[g],
    v_users[g]
  from generate_series(1, 120) g;

  with inserted as (
    insert into public.marketing_campaign_plans
      (goal_id, title, objective, audience, geography, category, summary,
       status, source, created_by)
    select
      v_goals[g],
      'Seed Campaign Plan ' || g,
      'Achieve the seeded marketing goal.',
      'Seed audience ' || mod(g, 8),
      'US',
      'fundraising',
      'Disposable multichannel plan fixture.',
      (array['draft', 'in_review', 'approved', 'archived'])[1 + mod(g, 4)],
      (array['generated', 'manual'])[1 + mod(g, 2)],
      v_users[g]
    from generate_series(1, 120) g
    returning id
  )
  select array_agg(id order by id) into v_plans from inserted;

  insert into public.marketing_campaign_plan_assets
    (plan_id, asset_type, channel, title, body, meta, status, sort_order)
  select
    v_plans[g],
    (array['landing_page', 'email', 'social_post', 'seo_meta',
           'faq', 'sms', 'ad', 'blog_post'])[1 + mod(g, 8)],
    (array['web', 'email', 'social', 'search', 'sms'])[1 + mod(g, 5)],
    'Seed Campaign Asset ' || g,
    'Disposable campaign-plan asset fixture.',
    jsonb_build_object('seed', true),
    (array['draft', 'approved', 'archived'])[1 + mod(g, 3)],
    mod(g, 12)
  from generate_series(1, 120) g;

  raise notice 'CharitMe seed 07: operational, role, messaging, tax, and marketing features seeded.';
end $$;
