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
