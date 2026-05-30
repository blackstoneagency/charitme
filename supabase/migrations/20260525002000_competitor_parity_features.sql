-- Competitor parity modules: projects/perks, memberships, nonprofit CRM, events, creator commerce, integrations, and analytics.

create table if not exists creator_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text,
  hero_image_url text,
  website_url text,
  brand_color text default '#059669',
  accepts_tips boolean not null default true,
  accepts_commissions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_launch_settings (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null unique references campaigns(id) on delete cascade,
  funding_model text not null default 'flexible' check (funding_model in ('flexible','fixed')),
  launch_type text not null default 'fundraiser' check (launch_type in ('fundraiser','project','product','indemand')),
  currency text not null default 'usd',
  country text not null default 'US',
  is_indemand boolean not null default false,
  product_stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_tiers (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  description text not null,
  amount_cents bigint not null,
  quantity_limit int,
  claimed_count int not null default 0,
  estimated_delivery date,
  fulfillment_status text not null default 'open' check (fulfillment_status in ('open','in_progress','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nonprofit_profiles (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  mission text,
  tax_id text,
  website_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donation_forms (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  slug text not null unique,
  default_amounts_cents bigint[] not null default array[2500,5000,10000,25000],
  recurring_enabled boolean not null default true,
  currencies text[] not null default array['usd'],
  embed_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recurring_donations (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  amount_cents bigint not null,
  cadence text not null default 'monthly' check (cadence in ('weekly','monthly','quarterly','annual')),
  status text not null default 'active' check (status in ('active','paused','cancelled','past_due')),
  stripe_subscription_id text unique,
  next_bill_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donor_crm_contacts (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  tags text[] not null default '{}',
  lifetime_value_cents bigint not null default 0,
  last_donated_at timestamptz,
  consent_email boolean not null default true,
  consent_sms boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donor_segments (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid not null references nonprofit_profiles(id) on delete cascade,
  name text not null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donor_segment_members (
  segment_id uuid not null references donor_segments(id) on delete cascade,
  contact_id uuid not null references donor_crm_contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  unique (campaign_id, nonprofit_id, user_id)
);

create table if not exists peer_fundraisers (
  id uuid primary key default uuid_generate_v4(),
  parent_campaign_id uuid not null references campaigns(id) on delete cascade,
  fundraiser_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique,
  title text not null,
  goal_amount bigint not null,
  raised_amount bigint not null default 0,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fundraising_events (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  slug text not null unique,
  event_type text not null default 'fundraiser' check (event_type in ('fundraiser','gala','giving_day','livestream','auction','registration')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  virtual_url text,
  status text not null default 'draft' check (status in ('draft','published','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_tickets (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references fundraising_events(id) on delete cascade,
  title text not null,
  price_cents bigint not null,
  quantity_limit int,
  sold_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists event_registrations (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references fundraising_events(id) on delete cascade,
  ticket_id uuid references event_tickets(id) on delete set null,
  attendee_id uuid references profiles(id) on delete set null,
  attendee_email text,
  attendee_name text,
  quantity int not null default 1,
  amount_cents bigint not null default 0,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists auction_items (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references fundraising_events(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  starting_bid_cents bigint not null,
  current_bid_cents bigint not null default 0,
  closes_at timestamptz,
  status text not null default 'open' check (status in ('open','closed','fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auction_bids (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references auction_items(id) on delete cascade,
  bidder_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  status text not null default 'active' check (status in ('active','outbid','winning','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists giving_days (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  goal_amount bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists livestreams (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references fundraising_events(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  stream_url text not null,
  starts_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists membership_tiers (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  title text not null,
  description text not null,
  amount_cents bigint not null,
  interval text not null default 'month' check (interval in ('month','year')),
  benefits text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists member_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  tier_id uuid not null references membership_tiers(id) on delete cascade,
  member_id uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','cancelled','past_due')),
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exclusive_posts (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  visibility text not null default 'members' check (visibility in ('public','members','tier')),
  minimum_tier_id uuid references membership_tiers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists direct_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists digital_products (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  title text not null,
  description text,
  price_cents bigint not null,
  storage_path text,
  preview_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_orders (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references digital_products(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete set null,
  buyer_email text,
  amount_cents bigint not null,
  stripe_payment_intent_id text,
  fulfillment_status text not null default 'paid' check (fulfillment_status in ('pending','paid','delivered','refunded')),
  created_at timestamptz not null default now()
);

create table if not exists commission_requests (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  requester_id uuid references profiles(id) on delete set null,
  requester_email text,
  title text not null,
  brief text not null,
  budget_cents bigint,
  status text not null default 'requested' check (status in ('requested','quoted','accepted','in_progress','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_tips (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  supporter_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  message text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists embedded_buttons (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  donation_form_id uuid references donation_forms(id) on delete cascade,
  label text not null default 'Support CharitMe',
  button_type text not null default 'donate' check (button_type in ('donate','tip','membership','product')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tax_receipts (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid references donations(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  receipt_number text not null unique,
  amount_cents bigint not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists email_campaigns (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sms_campaigns (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  keyword text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics_snapshots (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists campaign_analytics_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  event_type text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists integration_connections (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  status text not null default 'connected' check (status in ('connected','paused','revoked','error')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists outbound_webhook_endpoints (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  secret_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_profiles_user_id_idx on creator_profiles(user_id);
create index if not exists reward_tiers_campaign_id_idx on reward_tiers(campaign_id);
create index if not exists nonprofit_profiles_owner_id_idx on nonprofit_profiles(owner_id);
create index if not exists donation_forms_nonprofit_id_idx on donation_forms(nonprofit_id);
create index if not exists recurring_donations_donor_id_idx on recurring_donations(donor_id);
create index if not exists donor_crm_contacts_nonprofit_id_idx on donor_crm_contacts(nonprofit_id);
create index if not exists peer_fundraisers_parent_campaign_id_idx on peer_fundraisers(parent_campaign_id);
create index if not exists fundraising_events_nonprofit_id_idx on fundraising_events(nonprofit_id);
create index if not exists membership_tiers_creator_profile_id_idx on membership_tiers(creator_profile_id);
create index if not exists digital_products_creator_profile_id_idx on digital_products(creator_profile_id);
create index if not exists analytics_snapshots_campaign_id_idx on analytics_snapshots(campaign_id);
create index if not exists campaign_analytics_events_campaign_id_idx on campaign_analytics_events(campaign_id);

alter table creator_profiles enable row level security;
alter table campaign_launch_settings enable row level security;
alter table reward_tiers enable row level security;
alter table nonprofit_profiles enable row level security;
alter table donation_forms enable row level security;
alter table recurring_donations enable row level security;
alter table donor_crm_contacts enable row level security;
alter table donor_segments enable row level security;
alter table donor_segment_members enable row level security;
alter table team_members enable row level security;
alter table peer_fundraisers enable row level security;
alter table fundraising_events enable row level security;
alter table event_tickets enable row level security;
alter table event_registrations enable row level security;
alter table auction_items enable row level security;
alter table auction_bids enable row level security;
alter table giving_days enable row level security;
alter table livestreams enable row level security;
alter table membership_tiers enable row level security;
alter table member_subscriptions enable row level security;
alter table exclusive_posts enable row level security;
alter table direct_messages enable row level security;
alter table digital_products enable row level security;
alter table product_orders enable row level security;
alter table commission_requests enable row level security;
alter table creator_tips enable row level security;
alter table embedded_buttons enable row level security;
alter table tax_receipts enable row level security;
alter table email_campaigns enable row level security;
alter table sms_campaigns enable row level security;
alter table analytics_snapshots enable row level security;
alter table campaign_analytics_events enable row level security;
alter table integration_connections enable row level security;
alter table api_keys enable row level security;
alter table outbound_webhook_endpoints enable row level security;

create policy public_creator_profiles_read on creator_profiles for select using (true);
create policy creator_profiles_owner_write on creator_profiles for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin());

create policy public_campaign_launch_read on campaign_launch_settings for select using (true);
create policy campaign_launch_owner_write on campaign_launch_settings for all using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_launch_settings.campaign_id and campaigns.user_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_launch_settings.campaign_id and campaigns.user_id = auth.uid())
);

create policy public_reward_tiers_read on reward_tiers for select using (true);
create policy reward_tiers_owner_write on reward_tiers for all using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = reward_tiers.campaign_id and campaigns.user_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from campaigns where campaigns.id = reward_tiers.campaign_id and campaigns.user_id = auth.uid())
);

create policy public_nonprofit_profiles_read on nonprofit_profiles for select using (true);
create policy nonprofit_profiles_owner_write on nonprofit_profiles for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

create policy public_donation_forms_read on donation_forms for select using (true);
create policy donation_forms_owner_write on donation_forms for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donation_forms.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donation_forms.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);

create policy recurring_donations_private on recurring_donations for select using (
  auth.uid() = donor_id or is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = recurring_donations.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
create policy recurring_donations_insert_own on recurring_donations for insert with check (auth.uid() = donor_id or is_admin());

create policy donor_crm_owner_private on donor_crm_contacts for all using (
  auth.uid() = owner_id or is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_crm_contacts.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  auth.uid() = owner_id or is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_crm_contacts.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);

create policy donor_segments_owner_private on donor_segments for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_segments.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_segments.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);

create policy donor_segment_members_owner_private on donor_segment_members for all using (
  is_admin() or exists (
    select 1
    from donor_segments
    join nonprofit_profiles on nonprofit_profiles.id = donor_segments.nonprofit_id
    where donor_segments.id = donor_segment_members.segment_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin() or exists (
    select 1
    from donor_segments
    join nonprofit_profiles on nonprofit_profiles.id = donor_segments.nonprofit_id
    where donor_segments.id = donor_segment_members.segment_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);

create policy team_members_visible_to_team on team_members for select using (auth.uid() = user_id or is_admin());
create policy team_members_admin_owner_write on team_members for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin());

create policy public_peer_fundraisers_read on peer_fundraisers for select using (true);
create policy peer_fundraisers_owner_write on peer_fundraisers for all using (auth.uid() = fundraiser_id or is_admin()) with check (auth.uid() = fundraiser_id or is_admin());

create policy public_events_read on fundraising_events for select using (status = 'published' or is_admin());
create policy events_owner_write on fundraising_events for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = fundraising_events.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = fundraising_events.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
create policy public_event_tickets_read on event_tickets for select using (true);
create policy event_tickets_owner_write on event_tickets for all using (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = event_tickets.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = event_tickets.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);
create policy event_registrations_private on event_registrations for select using (auth.uid() = attendee_id or is_admin());
create policy event_registrations_insert_own on event_registrations for insert with check (auth.uid() = attendee_id or attendee_id is null or is_admin());
create policy public_auction_items_read on auction_items for select using (true);
create policy auction_items_owner_write on auction_items for all using (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = auction_items.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = auction_items.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);
create policy auction_bids_private on auction_bids for select using (auth.uid() = bidder_id or is_admin());
create policy auction_bids_insert_own on auction_bids for insert with check (auth.uid() = bidder_id or bidder_id is null or is_admin());
create policy public_giving_days_read on giving_days for select using (true);
create policy giving_days_owner_write on giving_days for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = giving_days.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = giving_days.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
create policy public_livestreams_read on livestreams for select using (true);
create policy livestreams_owner_write on livestreams for all using (
  is_admin()
  or exists (select 1 from campaigns where campaigns.id = livestreams.campaign_id and campaigns.user_id = auth.uid())
  or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = livestreams.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin()
  or exists (select 1 from campaigns where campaigns.id = livestreams.campaign_id and campaigns.user_id = auth.uid())
  or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = livestreams.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);

create policy public_membership_tiers_read on membership_tiers for select using (active or is_admin());
create policy membership_tiers_owner_write on membership_tiers for all using (
  is_admin()
  or exists (select 1 from creator_profiles where creator_profiles.id = membership_tiers.creator_profile_id and creator_profiles.user_id = auth.uid())
  or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = membership_tiers.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin()
  or exists (select 1 from creator_profiles where creator_profiles.id = membership_tiers.creator_profile_id and creator_profiles.user_id = auth.uid())
  or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = membership_tiers.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
create policy member_subscriptions_private on member_subscriptions for select using (auth.uid() = member_id or is_admin());
create policy member_subscriptions_insert_own on member_subscriptions for insert with check (auth.uid() = member_id or is_admin());
create policy public_exclusive_posts_read on exclusive_posts for select using (visibility = 'public' or is_admin());
create policy exclusive_posts_author_write on exclusive_posts for all using (auth.uid() = author_id or is_admin()) with check (auth.uid() = author_id or is_admin());
create policy direct_messages_private on direct_messages for select using (auth.uid() = sender_id or auth.uid() = recipient_id or is_admin());
create policy direct_messages_send on direct_messages for insert with check (auth.uid() = sender_id or is_admin());

create policy public_digital_products_read on digital_products for select using (active or is_admin());
create policy digital_products_creator_write on digital_products for all using (
  is_admin() or exists (select 1 from creator_profiles where creator_profiles.id = digital_products.creator_profile_id and creator_profiles.user_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from creator_profiles where creator_profiles.id = digital_products.creator_profile_id and creator_profiles.user_id = auth.uid())
);
create policy product_orders_private on product_orders for select using (auth.uid() = buyer_id or is_admin());
create policy product_orders_insert_own on product_orders for insert with check (auth.uid() = buyer_id or buyer_id is null or is_admin());
create policy commission_requests_private on commission_requests for select using (auth.uid() = requester_id or is_admin());
create policy commission_requests_insert_own on commission_requests for insert with check (auth.uid() = requester_id or requester_id is null or is_admin());
create policy public_creator_tips_read on creator_tips for select using (true);
create policy creator_tips_insert_public on creator_tips for insert with check (true);
create policy public_embedded_buttons_read on embedded_buttons for select using (true);
create policy embedded_buttons_owner_write on embedded_buttons for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

create policy tax_receipts_private on tax_receipts for select using (auth.uid() = donor_id or is_admin());
create policy email_campaigns_owner_private on email_campaigns for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
create policy sms_campaigns_owner_private on sms_campaigns for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
create policy analytics_owner_private on analytics_snapshots for select using (auth.uid() = owner_id or is_admin());
create policy campaign_analytics_owner_private on campaign_analytics_events for select using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_analytics_events.campaign_id and campaigns.user_id = auth.uid())
);
create policy integrations_owner_private on integration_connections for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
create policy api_keys_owner_private on api_keys for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
create policy outbound_webhooks_owner_private on outbound_webhook_endpoints for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

drop trigger if exists creator_profiles_set_updated_at on creator_profiles;
create trigger creator_profiles_set_updated_at before update on creator_profiles for each row execute function set_updated_at();
drop trigger if exists campaign_launch_settings_set_updated_at on campaign_launch_settings;
create trigger campaign_launch_settings_set_updated_at before update on campaign_launch_settings for each row execute function set_updated_at();
drop trigger if exists reward_tiers_set_updated_at on reward_tiers;
create trigger reward_tiers_set_updated_at before update on reward_tiers for each row execute function set_updated_at();
drop trigger if exists nonprofit_profiles_set_updated_at on nonprofit_profiles;
create trigger nonprofit_profiles_set_updated_at before update on nonprofit_profiles for each row execute function set_updated_at();
drop trigger if exists donation_forms_set_updated_at on donation_forms;
create trigger donation_forms_set_updated_at before update on donation_forms for each row execute function set_updated_at();
drop trigger if exists recurring_donations_set_updated_at on recurring_donations;
create trigger recurring_donations_set_updated_at before update on recurring_donations for each row execute function set_updated_at();
drop trigger if exists donor_crm_contacts_set_updated_at on donor_crm_contacts;
create trigger donor_crm_contacts_set_updated_at before update on donor_crm_contacts for each row execute function set_updated_at();
drop trigger if exists fundraising_events_set_updated_at on fundraising_events;
create trigger fundraising_events_set_updated_at before update on fundraising_events for each row execute function set_updated_at();
drop trigger if exists membership_tiers_set_updated_at on membership_tiers;
create trigger membership_tiers_set_updated_at before update on membership_tiers for each row execute function set_updated_at();
drop trigger if exists digital_products_set_updated_at on digital_products;
create trigger digital_products_set_updated_at before update on digital_products for each row execute function set_updated_at();
