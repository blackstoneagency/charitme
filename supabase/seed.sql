-- GiveRise seed data. Run after schema.sql.
insert into profiles (id, email, full_name, roles, identity_verified, trust_passport_score)
select uuid_generate_v4(), 'user' || n || '@giverise.test', 'GiveRise User ' || n,
  case when n = 1 then '["admin"]'::jsonb when n % 7 = 0 then '["nonprofit","organizer"]'::jsonb else '["donor","organizer"]'::jsonb end,
  n % 3 <> 0,
  55 + (n % 40)
from generate_series(1, 50) n;

insert into campaigns (user_id, slug, title, tagline, description, category, goal_amount, raised_amount, backer_count, status, beneficiary_name, beneficiary_relationship, trust_status, campaign_health_score, cover_image_url)
select p.id,
  'seed-campaign-' || n,
  case (n % 8)
    when 0 then 'Emergency rent support for a local family'
    when 1 then 'Medical recovery fund after surgery'
    when 2 then 'Memorial support for funeral expenses'
    when 3 then 'Disaster relief for neighbors rebuilding'
    when 4 then 'Education fund for first-generation student'
    when 5 then 'Community pantry restock campaign'
    when 6 then 'Animal rescue medical care'
    else 'Nonprofit winter outreach drive'
  end,
  'A verified GiveRise fundraiser with public trust signals.',
  repeat('This campaign explains who needs help, why the need is urgent, how funds will be used, and how donors will receive transparent updates. ', 4),
  (array['Medical','Emergency','Memorial/Funeral','Disaster Relief','Education','Community','Animal/Pet','Nonprofit'])[1 + (n % 8)],
  (50000 + n * 25000),
  (10000 + n * 7000),
  (3 + n % 55),
  'active',
  'Beneficiary ' || n,
  'Verified recipient',
  case when n % 4 = 0 then 'Verified' when n % 4 = 1 then 'Strong Trust' when n % 4 = 2 then 'Needs More Info' else 'Under Review' end,
  60 + (n % 35),
  null
from generate_series(1, 100) n
join lateral (select id from profiles order by random() limit 1) p on true;

insert into donations (campaign_id, donor_id, amount_cents, message, anonymous, status)
select c.id, p.id, (1000 + (n % 20) * 500), 'Sending support through GiveRise.', n % 5 = 0, 'completed'
from generate_series(1, 500) n
join lateral (select id from campaigns order by random() limit 1) c on true
join lateral (select id from profiles order by random() limit 1) p on true;

insert into campaign_updates (campaign_id, user_id, title, body, ai_generated)
select c.id, c.user_id, 'Progress update ' || n, 'Thank you for helping. We are sharing this impact update for donors.', n % 2 = 0
from generate_series(1, 25) n
join lateral (select id, user_id from campaigns order by random() limit 1) c on true;

insert into trust_scores (campaign_id, score, status, signals)
select c.id, 55 + (n % 40), c.trust_status, '[{"label":"Identity","state":"verified"},{"label":"Payout","state":"verified"}]'::jsonb
from generate_series(1, 25) n
join lateral (select id, trust_status from campaigns order by random() limit 1) c on true;

insert into payouts (campaign_id, user_id, amount_cents, payout_speed, fee_cents, status, risk_score)
select c.id, c.user_id, 5000 + n * 1000, (array['standard','same_day','instant'])[1 + (n % 3)], n * 10, 'requested', 20 + (n % 60)
from generate_series(1, 25) n
join lateral (select id, user_id from campaigns order by random() limit 1) c on true;

insert into risk_flags (campaign_id, code, label, severity, status)
select c.id, 'velocity_anomaly', 'Donation velocity needs review', (array['low','medium','high'])[1 + (n % 3)], 'open'
from generate_series(1, 25) n
join lateral (select id from campaigns order by random() limit 1) c on true;

insert into transparency_ledger_items (campaign_id, item_type, title, description, category, amount_cents, status)
select c.id, 'expense', 'Verified expense ' || n, 'Seed receipt-backed expense for public transparency.', (array['Medical bills','Funeral expenses','Housing','Food','Travel','Emergency supplies','Other'])[1 + (n % 7)], 2500 + n * 100, 'published'
from generate_series(1, 50) n
join lateral (select id from campaigns order by random() limit 1) c on true;

insert into creator_profiles (user_id, handle, display_name, bio, accepts_tips, accepts_commissions)
select p.id, 'creator-' || n, 'GiveRise Creator ' || n, 'A public creator profile with memberships, tips, digital products, and supporter updates.', true, n % 2 = 0
from generate_series(1, 12) n
join lateral (select id from profiles order by random() limit 1) p on true;

insert into campaign_launch_settings (campaign_id, funding_model, launch_type, currency, country, is_indemand, product_stage)
select c.id,
  (array['flexible','fixed'])[1 + (n % 2)],
  (array['fundraiser','project','product','indemand'])[1 + (n % 4)],
  'usd',
  'US',
  n % 4 = 0,
  case when n % 3 = 0 then 'prototype' else 'active fundraiser' end
from generate_series(1, 40) n
join lateral (select id from campaigns order by random() limit 1) c on true
on conflict (campaign_id) do nothing;

insert into reward_tiers (campaign_id, title, description, amount_cents, quantity_limit, estimated_delivery)
select c.id, 'Support tier ' || n, 'A reward/perk tier for project and community fundraisers.', 2500 + n * 500, 100, current_date + (30 + n)
from generate_series(1, 40) n
join lateral (select id from campaigns order by random() limit 1) c on true;

insert into nonprofit_profiles (owner_id, name, slug, mission, tax_id, verified)
select p.id, 'GiveRise Nonprofit ' || n, 'giverise-nonprofit-' || n, 'Helping communities raise and distribute support with transparency.', '99-00000' || n, n % 2 = 0
from generate_series(1, 10) n
join lateral (select id from profiles order by random() limit 1) p on true;

insert into donation_forms (nonprofit_id, campaign_id, title, slug, recurring_enabled, currencies)
select np.id, c.id, 'Community giving form ' || n, 'community-giving-form-' || n, true, array['usd','cad','eur']
from generate_series(1, 20) n
join lateral (select id from nonprofit_profiles order by random() limit 1) np on true
join lateral (select id from campaigns order by random() limit 1) c on true;

insert into recurring_donations (donor_id, campaign_id, nonprofit_id, amount_cents, cadence, status, next_bill_at)
select p.id, c.id, np.id, 1500 + n * 100, 'monthly', 'active', now() + interval '30 days'
from generate_series(1, 30) n
join lateral (select id from profiles order by random() limit 1) p on true
join lateral (select id from campaigns order by random() limit 1) c on true
join lateral (select id from nonprofit_profiles order by random() limit 1) np on true;

insert into donor_crm_contacts (nonprofit_id, owner_id, email, full_name, tags, lifetime_value_cents, consent_email, consent_sms)
select np.id, np.owner_id, 'donor-crm-' || n || '@giverise.test', 'CRM Donor ' || n, array['monthly','warm'], 5000 + n * 750, true, n % 3 = 0
from generate_series(1, 40) n
join lateral (select id, owner_id from nonprofit_profiles order by random() limit 1) np on true;

insert into fundraising_events (nonprofit_id, campaign_id, title, slug, event_type, starts_at, ends_at, location, virtual_url, status)
select np.id, c.id, 'GiveRise event ' || n, 'giverise-event-' || n,
  (array['fundraiser','gala','giving_day','livestream','auction','registration'])[1 + (n % 6)],
  now() + (n || ' days')::interval,
  now() + ((n + 1) || ' days')::interval,
  'Hybrid',
  'https://example.com/live',
  'published'
from generate_series(1, 15) n
join lateral (select id from nonprofit_profiles order by random() limit 1) np on true
join lateral (select id from campaigns order by random() limit 1) c on true;

insert into event_tickets (event_id, title, price_cents, quantity_limit)
select e.id, 'General admission ' || n, 2500 + n * 250, 200
from generate_series(1, 20) n
join lateral (select id from fundraising_events order by random() limit 1) e on true;

insert into auction_items (event_id, title, description, starting_bid_cents, current_bid_cents, closes_at)
select e.id, 'Auction item ' || n, 'Seed auction item for charity auction workflows.', 5000 + n * 500, 7500 + n * 500, now() + interval '7 days'
from generate_series(1, 15) n
join lateral (select id from fundraising_events order by random() limit 1) e on true;

insert into membership_tiers (creator_profile_id, title, description, amount_cents, interval, benefits)
select cp.id, 'Member tier ' || n, 'Recurring supporter tier with exclusive updates and benefits.', 500 + n * 500, 'month', array['Exclusive posts','Supporter badge','Monthly update']
from generate_series(1, 24) n
join lateral (select id from creator_profiles order by random() limit 1) cp on true;

insert into exclusive_posts (creator_profile_id, author_id, title, body, visibility)
select cp.id, cp.user_id, 'Member update ' || n, 'A subscriber-only update for recurring supporters.', case when n % 4 = 0 then 'public' else 'members' end
from generate_series(1, 20) n
join lateral (select id, user_id from creator_profiles order by random() limit 1) cp on true;

insert into digital_products (creator_profile_id, title, description, price_cents, active)
select cp.id, 'Digital download ' || n, 'A digital product sold by a creator on GiveRise.', 900 + n * 100, true
from generate_series(1, 20) n
join lateral (select id from creator_profiles order by random() limit 1) cp on true;

insert into commission_requests (creator_profile_id, requester_email, title, brief, budget_cents, status)
select cp.id, 'commission-' || n || '@giverise.test', 'Commission request ' || n, 'A custom creator commission request.', 7500 + n * 500, 'requested'
from generate_series(1, 12) n
join lateral (select id from creator_profiles order by random() limit 1) cp on true;

insert into embedded_buttons (owner_id, campaign_id, creator_profile_id, donation_form_id, label, button_type)
select p.id, c.id, cp.id, df.id, 'Support on GiveRise', (array['donate','tip','membership','product'])[1 + (n % 4)]
from generate_series(1, 20) n
join lateral (select id from profiles order by random() limit 1) p on true
join lateral (select id from campaigns order by random() limit 1) c on true
join lateral (select id from creator_profiles order by random() limit 1) cp on true
join lateral (select id from donation_forms order by random() limit 1) df on true;

insert into analytics_snapshots (owner_id, campaign_id, nonprofit_id, creator_profile_id, metrics)
select p.id, c.id, np.id, cp.id, jsonb_build_object('views', 1000 + n * 40, 'conversion_rate', 0.05, 'recurring_revenue_cents', 15000 + n * 1000)
from generate_series(1, 30) n
join lateral (select id from profiles order by random() limit 1) p on true
join lateral (select id from campaigns order by random() limit 1) c on true
join lateral (select id from nonprofit_profiles order by random() limit 1) np on true
join lateral (select id from creator_profiles order by random() limit 1) cp on true;

insert into integration_connections (owner_id, provider, status, config)
select p.id, (array['discord','sendgrid','twilio','zapier','slack'])[1 + (n % 5)], 'connected', '{}'::jsonb
from generate_series(1, 15) n
join lateral (select id from profiles order by random() limit 1) p on true;
