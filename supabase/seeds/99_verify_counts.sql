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
    'campaign_media','transparency_ledger_items'
  ];
  t text;
  c bigint;
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
  raise notice '--- CharitMe seed coverage verified: all expected tables have >= 100 rows. ---';
end $$;
