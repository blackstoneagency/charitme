-- =============================================================================
-- CharitMe seed · 06 · Extended monetization & marketplace features
--   creator_profiles, membership_tiers, member_subscriptions, exclusive_posts,
--   creator_tips, digital_products, product_orders, auction_items, auction_bids,
--   livestreams, giving_days, donor_crm_contacts, donor_segments,
--   campaign_media, transparency_ledger_items — 120 rows each.
-- Requires: profiles (00) and campaigns (01). Uses nonprofit_profiles (02) and
--   fundraising_events (03) when present; auction + segment tables are skipped
--   gracefully if their parent rows are absent so the file is safe to run alone.
-- Every insert is guarded by to_regclass() + on conflict do nothing, so this is
-- idempotent and inert on databases that don't have the newer feature tables.
-- =============================================================================
do $$
declare
  v_users uuid[]; v_camps uuid[]; v_nonprofits uuid[]; v_events uuid[];
  n_users int;    n_camps int;    n_nonprofits int;    n_events int;
  v_suffix text := to_hex(floor(extract(epoch from now()))::bigint);
  v_creators uuid[]; v_tiers uuid[]; v_products uuid[]; v_auction uuid[];
begin
  select array_agg(id) into v_users from public.profiles;
  n_users := coalesce(array_length(v_users, 1), 0);
  select array_agg(id) into v_camps from public.campaigns;
  n_camps := coalesce(array_length(v_camps, 1), 0);
  if n_users = 0 or n_camps = 0 then
    raise exception 'Need profiles and campaigns first. Run 00 and 01.';
  end if;

  if to_regclass('public.nonprofit_profiles') is not null then
    select array_agg(id) into v_nonprofits from public.nonprofit_profiles;
  end if;
  n_nonprofits := coalesce(array_length(v_nonprofits, 1), 0);

  if to_regclass('public.fundraising_events') is not null then
    select array_agg(id) into v_events from public.fundraising_events;
  end if;
  n_events := coalesce(array_length(v_events, 1), 0);

  -- ── Creator profiles ──────────────────────────────────────────────────────
  if to_regclass('public.creator_profiles') is not null then
    with ins as (
      insert into public.creator_profiles
        (user_id, handle, display_name, bio, hero_image_url, website_url,
         brand_color, accepts_tips, accepts_commissions)
      select v_users[1 + (g % n_users)],
             'creator-' || v_suffix || '-' || g,
             'Creator ' || g,
             'Independent creator raising funds for good causes. Seed profile #' || g || '.',
             'https://picsum.photos/seed/creator' || g || '/1200/400',
             'https://example.org/creator/' || g,
             (array['#059669','#6c35ff','#0ea5e9','#f59e0b'])[1 + (g % 4)],
             (g % 5) <> 0,
             (g % 3) = 0
      from generate_series(1, 120) g
      on conflict (handle) do nothing
      returning id
    ) select array_agg(id) into v_creators from ins;
    -- Fall back to any existing creators if this run inserted none.
    if coalesce(array_length(v_creators, 1), 0) = 0 then
      select array_agg(id) into v_creators from public.creator_profiles;
    end if;
  end if;

  -- ── Membership tiers (creator-backed) ─────────────────────────────────────
  if to_regclass('public.membership_tiers') is not null
     and coalesce(array_length(v_creators, 1), 0) > 0 then
    with ins as (
      insert into public.membership_tiers
        (creator_profile_id, title, description, amount_cents, interval, benefits, active)
      select v_creators[1 + (g % array_length(v_creators, 1))],
             (array['Supporter','Insider','Champion','Patron'])[1 + (g % 4)] || ' Tier',
             'Exclusive perks for members. Seed tier #' || g || '.',
             ((g % 8) + 1) * 500,
             (array['month','month','month','year'])[1 + (g % 4)],
             array['Members-only updates','Early access','Community shoutout'],
             (g % 7) <> 0
      from generate_series(1, 120) g
      on conflict do nothing
      returning id
    ) select array_agg(id) into v_tiers from ins;
    if coalesce(array_length(v_tiers, 1), 0) = 0 then
      select array_agg(id) into v_tiers from public.membership_tiers;
    end if;
  end if;

  -- ── Member subscriptions ──────────────────────────────────────────────────
  if to_regclass('public.member_subscriptions') is not null
     and coalesce(array_length(v_tiers, 1), 0) > 0 then
    insert into public.member_subscriptions
      (tier_id, member_id, status, stripe_subscription_id, current_period_end)
    select v_tiers[1 + (g % array_length(v_tiers, 1))],
           v_users[1 + (g % n_users)],
           (array['active','active','active','paused','cancelled'])[1 + (g % 5)],
           'sub_seed_' || v_suffix || '_' || g,
           now() + (((g % 28) + 1) || ' days')::interval
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Exclusive posts ───────────────────────────────────────────────────────
  if to_regclass('public.exclusive_posts') is not null
     and coalesce(array_length(v_creators, 1), 0) > 0 then
    insert into public.exclusive_posts
      (creator_profile_id, author_id, title, body, visibility, minimum_tier_id)
    select v_creators[1 + (g % array_length(v_creators, 1))],
           v_users[1 + (g % n_users)],
           'Behind the scenes #' || g,
           'A members-only update sharing our progress and gratitude. Seed post #' || g || '.',
           (array['public','members','members','tier'])[1 + (g % 4)],
           case when coalesce(array_length(v_tiers, 1), 0) > 0 and (g % 4) = 3
                then v_tiers[1 + (g % array_length(v_tiers, 1))] else null end
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Creator tips ──────────────────────────────────────────────────────────
  if to_regclass('public.creator_tips') is not null
     and coalesce(array_length(v_creators, 1), 0) > 0 then
    insert into public.creator_tips
      (creator_profile_id, supporter_id, amount_cents, message, stripe_payment_intent_id)
    select v_creators[1 + (g % array_length(v_creators, 1))],
           v_users[1 + (g % n_users)],
           ((g % 20) + 1) * 100,
           (array['Keep it up!','Love your work','Thank you','Amazing cause'])[1 + (g % 4)],
           'pi_tip_seed_' || v_suffix || '_' || g
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Digital products ──────────────────────────────────────────────────────
  if to_regclass('public.digital_products') is not null
     and coalesce(array_length(v_creators, 1), 0) > 0 then
    with ins as (
      insert into public.digital_products
        (creator_profile_id, title, description, price_cents, storage_path, preview_url, active)
      select v_creators[1 + (g % array_length(v_creators, 1))],
             (array['Wallpaper Pack','E-book','Preset Bundle','Sticker Set'])[1 + (g % 4)] || ' ' || g,
             'A downloadable digital good. Seed product #' || g || '.',
             ((g % 15) + 1) * 300,
             'products/seed/' || v_suffix || '/' || g || '.zip',
             'https://picsum.photos/seed/product' || g || '/600/400',
             (g % 9) <> 0
      from generate_series(1, 120) g
      on conflict do nothing
      returning id
    ) select array_agg(id) into v_products from ins;
    if coalesce(array_length(v_products, 1), 0) = 0 then
      select array_agg(id) into v_products from public.digital_products;
    end if;
  end if;

  -- ── Product orders ────────────────────────────────────────────────────────
  if to_regclass('public.product_orders') is not null
     and coalesce(array_length(v_products, 1), 0) > 0 then
    insert into public.product_orders
      (product_id, buyer_id, buyer_email, amount_cents, stripe_payment_intent_id, fulfillment_status)
    select v_products[1 + (g % array_length(v_products, 1))],
           v_users[1 + (g % n_users)],
           format('seed.buyer.%s@charitme.test', g),
           ((g % 15) + 1) * 300,
           'pi_order_seed_' || v_suffix || '_' || g,
           (array['paid','paid','delivered','pending','refunded'])[1 + (g % 5)]
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Auction items + bids (require fundraising_events) ─────────────────────
  if to_regclass('public.auction_items') is not null and n_events > 0 then
    with ins as (
      insert into public.auction_items
        (event_id, title, description, image_url, starting_bid_cents,
         current_bid_cents, closes_at, status)
      select v_events[1 + (g % n_events)],
             (array['Signed Jersey','Weekend Getaway','Dinner for Two','Art Piece'])[1 + (g % 4)] || ' #' || g,
             'Bid to support the cause. Seed auction item #' || g || '.',
             'https://picsum.photos/seed/auction' || g || '/600/400',
             ((g % 10) + 1) * 5000,
             ((g % 10) + 1) * 5000 + (g % 5) * 2500,
             now() + (((g % 30) + 3) || ' days')::interval,
             (array['open','open','open','closed','fulfilled'])[1 + (g % 5)]
      from generate_series(1, 120) g
      on conflict do nothing
      returning id
    ) select array_agg(id) into v_auction from ins;
    if coalesce(array_length(v_auction, 1), 0) = 0 then
      select array_agg(id) into v_auction from public.auction_items;
    end if;

    if to_regclass('public.auction_bids') is not null
       and coalesce(array_length(v_auction, 1), 0) > 0 then
      insert into public.auction_bids (item_id, bidder_id, amount_cents, status)
      select v_auction[1 + (g % array_length(v_auction, 1))],
             v_users[1 + (g % n_users)],
             ((g % 12) + 2) * 5000,
             (array['active','outbid','outbid','winning','cancelled'])[1 + (g % 5)]
      from generate_series(1, 120) g
      on conflict do nothing;
    end if;
  end if;

  -- ── Livestreams (campaign-backed, always available) ──────────────────────
  if to_regclass('public.livestreams') is not null then
    insert into public.livestreams
      (campaign_id, title, stream_url, starts_at, status)
    select v_camps[1 + (g % n_camps)],
           'Live Fundraiser Stream #' || g,
           'https://example.org/live/' || v_suffix || '/' || g,
           now() + (((g % 45) + 1) || ' days')::interval,
           (array['scheduled','scheduled','live','ended'])[1 + (g % 4)]
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Giving days (nonprofit optional) ──────────────────────────────────────
  if to_regclass('public.giving_days') is not null then
    insert into public.giving_days
      (nonprofit_id, title, slug, starts_at, ends_at, goal_amount)
    select case when n_nonprofits > 0 then v_nonprofits[1 + (g % n_nonprofits)] else null end,
           (array['Giving Tuesday','Spring Match Day','Community Day','24-Hour Challenge'])[1 + (g % 4)] || ' ' || g,
           'giving-day-' || v_suffix || '-' || g,
           now() + (((g % 60) + 5) || ' days')::interval,
           now() + (((g % 60) + 6) || ' days')::interval,
           ((g % 20) + 5) * 100000
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Donor CRM contacts (owner-scoped) ─────────────────────────────────────
  if to_regclass('public.donor_crm_contacts') is not null then
    insert into public.donor_crm_contacts
      (nonprofit_id, owner_id, email, full_name, phone, tags,
       lifetime_value_cents, last_donated_at, consent_email, consent_sms)
    select case when n_nonprofits > 0 then v_nonprofits[1 + (g % n_nonprofits)] else null end,
           v_users[1 + (g % n_users)],
           format('seed.contact.%s@charitme.test', g),
           'Donor Contact ' || g,
           '+1-555-01' || lpad((g % 100)::text, 2, '0') || '-' || lpad(g::text, 4, '0'),
           array[(array['major','recurring','lapsed','new'])[1 + (g % 4)]],
           ((g % 50) + 1) * 10000,
           now() - (((g % 200) + 1) || ' days')::interval,
           (g % 6) <> 0,
           (g % 4) = 0
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Donor segments (require nonprofit_profiles) ───────────────────────────
  if to_regclass('public.donor_segments') is not null and n_nonprofits > 0 then
    insert into public.donor_segments (nonprofit_id, name, rules)
    select v_nonprofits[1 + (g % n_nonprofits)],
           (array['Major Donors','Recurring Givers','Lapsed','First-Time'])[1 + (g % 4)] || ' ' || g,
           jsonb_build_object('min_ltv_cents', ((g % 10) + 1) * 50000,
                              'tag', (array['major','recurring','lapsed','new'])[1 + (g % 4)])
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Campaign media ────────────────────────────────────────────────────────
  if to_regclass('public.campaign_media') is not null then
    insert into public.campaign_media
      (campaign_id, uploader_id, media_type, storage_path, public_url, reuse_risk_score)
    select v_camps[1 + (g % n_camps)],
           v_users[1 + (g % n_users)],
           (array['image','image','video','document'])[1 + (g % 4)],
           'campaign-media/seed/' || v_suffix || '/' || g,
           'https://picsum.photos/seed/media' || g || '/800/600',
           (g % 40)
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  -- ── Transparency ledger items ─────────────────────────────────────────────
  if to_regclass('public.transparency_ledger_items') is not null then
    insert into public.transparency_ledger_items
      (campaign_id, item_type, title, description, category, amount_cents,
       receipt_url, status, ai_summary)
    select v_camps[1 + (g % n_camps)],
           (array['milestone','receipt','expense','payout','impact_update'])[1 + (g % 5)],
           'Ledger entry #' || g,
           'Transparent record of how funds were used. Seed entry #' || g || '.',
           (array['Supplies','Travel','Medical','Equipment','Other'])[1 + (g % 5)],
           ((g % 30) + 1) * 2500,
           case when (g % 2) = 0 then 'https://example.org/receipts/' || g || '.pdf' else null end,
           'published',
           'AI summary: funds allocated responsibly toward the stated goal.'
    from generate_series(1, 120) g
    on conflict do nothing;
  end if;

  raise notice 'CharitMe seed 06: extended monetization & marketplace features seeded.';
end $$;
