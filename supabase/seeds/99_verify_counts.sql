-- =============================================================================
-- CharitMe seed · 99 · Verify coverage
-- Run after 00–06. Prints one line per feature table with its row count and an
-- OK / <100 flag. Tables that aren't present on this database (e.g. schema.sql-
-- only tables) are reported as "(not present)" instead of erroring.
-- Output appears in the SQL editor "Messages" pane (or psql stderr).
-- =============================================================================
do $$
declare
  tbls text[] := array[
    'profiles','campaigns','campaign_updates','campaign_faqs','campaign_milestones',
    'campaign_rewards','donations','saved_campaigns','notifications',
    'sponsorship_opportunities','sponsorship_requests',
    'grants','grant_deadlines','grant_applications','grant_documents','grant_matches',
    'matching_programs','matching_claims',
    'volunteer_opportunities','volunteer_applications','volunteer_profiles','nonprofit_profiles',
    'fundraising_events','event_tickets','event_registrations','event_checkins','peer_fundraisers',
    'impact_plans','impact_plan_items','impact_updates','impact_evidence','impact_metrics',
    'challenges','challenge_participants','user_badges',
    'donor_messages','recurring_donations','refunds','payouts',
    'verification_documents','risk_flags','tax_receipts','business_leads',
    'creator_profiles','membership_tiers','member_subscriptions','exclusive_posts',
    'creator_tips','digital_products','product_orders','auction_items','auction_bids',
    'livestreams','giving_days','donor_crm_contacts','donor_segments',
    'campaign_media','transparency_ledger_items',
    'organizations','organization_members','brands',
    'volunteer_shifts','volunteer_hours','campaign_wizard_drafts',
    'donation_receipts','team_members','beneficiary_invites','privacy_requests',
    'campaign_owner_replies','donor_message_likes','donor_segment_members','donor_tips',
    'integration_connections','campaign_analytics_events','campaign_builder_events',
    'coach_sessions','organizer_sends','share_events','direct_messages',
    'message_thread_state','campaign_reports','campaign_status_log',
    'commission_requests','contact_messages','donation_forms','embedded_buttons',
    'email_campaigns','sms_campaigns','lead_outreach',
    'marketing_goals','marketing_opportunities','marketing_campaign_plans',
    'marketing_campaign_plan_assets'
  ];
  t text;
  c bigint;
  role_count bigint;
  demo_count bigint;
  mismatch_count bigint;
  n_ok int := 0;
  n_total int := 0;
  n_missing int := 0;
begin
  raise notice '--- CharitMe seed coverage (target >= 100) ---';
  foreach t in array tbls loop
    if to_regclass('public.' || t) is null then
      raise notice '  %  (not present)', rpad(t, 28);
      n_missing := n_missing + 1;
      continue;
    end if;
    execute format('select count(*) from public.%I', t) into c;
    n_total := n_total + 1;
    if c >= 100 then n_ok := n_ok + 1; end if;
    raise notice '  % % %', rpad(t, 28), lpad(c::text, 7), case when c >= 100 then 'OK' else '<100' end;
  end loop;
  raise notice '--- % of % present tables have >= 100 rows ---', n_ok, n_total;
  if n_missing > 0 or n_ok <> n_total then
    raise exception 'CharitMe seed coverage failed: % of % present tables have >= 100 rows; % expected tables are missing.', n_ok, n_total, n_missing;
  end if;
  foreach t in array array['donor','organizer','beneficiary','nonprofit'] loop
    execute format(
      'select count(*) from public.profiles where roles ? %L',
      t
    ) into role_count;
    if role_count < 20 then
      raise exception 'CharitMe role seed coverage failed: role % has only % profiles.', t, role_count;
    end if;
    raise notice '  role:% % OK', rpad(t, 22), lpad(role_count::text, 7);
  end loop;
  foreach t in array array['admin','super_admin'] loop
    execute format(
      'select count(*) from public.profiles where roles ? %L',
      t
    ) into role_count;
    if role_count < 1 then
      raise exception 'CharitMe role seed coverage failed: role % has only % profiles.', t, role_count;
    end if;
    raise notice '  role:% % OK', rpad(t, 22), lpad(role_count::text, 7);
  end loop;
  foreach t in array array['profiles','campaigns','donations'] loop
    execute format(
      'select count(*) from public.%I where is_demo',
      t
    ) into demo_count;
    if demo_count < 100 then
      raise exception 'CharitMe demo labeling failed: table % has only % labeled rows.', t, demo_count;
    end if;
    raise notice '  demo:% % OK', rpad(t, 22), lpad(demo_count::text, 7);
  end loop;
  select count(*) into mismatch_count
  from public.volunteer_hours hours
  join public.volunteer_shifts shifts on shifts.id = hours.shift_id
  where hours.opportunity_id is distinct from shifts.opportunity_id;
  if mismatch_count > 0 then
    raise exception 'CharitMe relational seed check failed: % volunteer hour rows have mismatched opportunities.', mismatch_count;
  end if;
  select count(*) into mismatch_count
  from public.donation_receipts receipts
  join public.donations donations on donations.id = receipts.donation_id
  where receipts.campaign_id is distinct from donations.campaign_id;
  if mismatch_count > 0 then
    raise exception 'CharitMe relational seed check failed: % donation receipt rows have mismatched campaigns.', mismatch_count;
  end if;
  select count(*) into mismatch_count
  from public.beneficiary_invites invites
  join public.campaigns campaigns on campaigns.id = invites.campaign_id
  where invites.invited_by is distinct from campaigns.user_id;
  if mismatch_count > 0 then
    raise exception 'CharitMe relational seed check failed: % beneficiary invite rows have mismatched inviters.', mismatch_count;
  end if;
  raise notice '--- CharitMe seed coverage verified: all expected tables have >= 100 rows. ---';
end $$;
