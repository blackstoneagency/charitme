-- ─────────────────────────────────────────────────────────────────────────────
-- CharitMe Production Schema — complete rebuild with 500-row seed data
-- Run in Supabase SQL Editor with service-role key (required for auth.users seed)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Wipe existing structure ─────────────────────────────────────────────────
drop schema if exists public cascade;
create schema public;
grant usage  on schema public to postgres, anon, authenticated, service_role;
grant all    on schema public to postgres, service_role;

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- for fast ILIKE search

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- handle_new_user uses plpgsql (late binding — profiles table may not exist yet at definition time)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_roles jsonb;
begin
  v_roles := coalesce(new.raw_user_meta_data -> 'roles', '["donor"]'::jsonb);
  if jsonb_typeof(v_roles) <> 'array' then v_roles := '["donor"]'::jsonb; end if;
  insert into public.profiles (id, email, full_name, avatar_url, roles)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          new.raw_user_meta_data ->> 'avatar_url',
          v_roles)
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ──────────────────────────────────────────────────────────────────
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text,
  full_name               text,
  avatar_url              text,
  bio                     text,
  roles                   jsonb    not null default '["donor"]'::jsonb,
  plan                    text     not null default 'free' check (plan in ('free','starter','pro','enterprise')),
  identity_verified       boolean  not null default false,
  trust_passport_score    int      not null default 0,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  org_name                text,
  org_website             text,
  org_tagline             text,
  timezone                text     not null default 'America/New_York',
  currency                text     not null default 'usd',
  language                text     not null default 'en',
  date_format             text     not null default 'MM/DD/YYYY',
  time_format             text     not null default '12h',
  show_public_profile     boolean  not null default true,
  campaign_recommendations boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- is_admin() MUST be defined after profiles — SQL-language functions validate
-- referenced objects at creation time (unlike plpgsql which uses late binding).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and roles ? 'admin'
  );
$$;

-- ── connected_accounts ───────────────────────────────────────────────────────
create table public.connected_accounts (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references profiles(id) on delete cascade,
  stripe_account_id       text not null unique,
  charges_enabled         boolean not null default false,
  payouts_enabled         boolean not null default false,
  details_submitted       boolean not null default false,
  verification_status     text    not null default 'pending'
                            check (verification_status in ('pending','verified','rejected')),
  first_payout_hold_until timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── campaigns ────────────────────────────────────────────────────────────────
create table public.campaigns (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null references profiles(id) on delete cascade,
  beneficiary_profile_id   uuid references profiles(id) on delete set null,
  slug                     text not null unique,
  title                    text not null,
  tagline                  text,
  description              text not null,
  category                 text not null,
  goal_amount              bigint not null check (goal_amount > 0),
  raised_amount            bigint not null default 0 check (raised_amount >= 0),
  backer_count             int    not null default 0 check (backer_count >= 0),
  deadline                 date,
  status                   text not null default 'draft'
                             check (status in ('draft','active','paused','completed','rejected','frozen')),
  beneficiary_name         text,
  beneficiary_relationship text,
  cover_image_url          text,
  video_url                text,
  image_urls               text[]   not null default '{}',
  location                 text,
  trust_status             text     not null default 'Needs More Info',
  campaign_health_score    int      not null default 0 check (campaign_health_score between 0 and 100),
  payout_frozen            boolean  not null default false,
  featured                 boolean  not null default false,
  pinned                   boolean  not null default false,
  nonprofit_verified       boolean  not null default false,
  thank_donors_sent_at     timestamptz,
  ai_generated             boolean  not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── campaign_media ────────────────────────────────────────────────────────────
create table public.campaign_media (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  uploader_id  uuid not null references profiles(id) on delete cascade,
  media_type   text not null check (media_type in ('image','video','document')),
  storage_path text not null,
  public_url   text,
  caption      text,
  alt_text     text,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

-- ── campaign_updates ──────────────────────────────────────────────────────────
create table public.campaign_updates (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  user_id       uuid references profiles(id) on delete set null,
  title         text,
  body          text not null,
  ai_generated  boolean not null default false,
  scheduled_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── campaign_milestones ───────────────────────────────────────────────────────
create table public.campaign_milestones (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  title         text not null,
  description   text,
  target_amount bigint,
  reached_at    timestamptz,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ── donations ────────────────────────────────────────────────────────────────
create table public.donations (
  id                         uuid primary key default uuid_generate_v4(),
  campaign_id                uuid not null references campaigns(id) on delete cascade,
  donor_id                   uuid references profiles(id) on delete set null,
  amount_cents               bigint  not null check (amount_cents > 0),
  tip_cents                  bigint  not null default 0 check (tip_cents >= 0),
  processing_fee_cents       bigint  not null default 0 check (processing_fee_cents >= 0),
  status                     text    not null default 'pending'
                               check (status in ('pending','completed','refunded','failed','disputed')),
  anonymous                  boolean not null default false,
  message                    text,
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  refunded_at                timestamptz,
  refund_reason              text,
  offline                    boolean not null default false,
  offline_method             text,
  offline_donor_name         text,
  offline_donor_email        text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- ── recurring_donations ───────────────────────────────────────────────────────
create table public.recurring_donations (
  id                     uuid primary key default uuid_generate_v4(),
  donor_id               uuid references profiles(id) on delete set null,
  campaign_id            uuid references campaigns(id) on delete cascade,
  amount_cents           bigint not null check (amount_cents > 0),
  cadence                text   not null default 'monthly'
                           check (cadence in ('weekly','monthly','quarterly','annual')),
  status                 text   not null default 'active'
                           check (status in ('active','paused','cancelled','past_due')),
  stripe_subscription_id text unique,
  next_bill_at           timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── donor_messages ────────────────────────────────────────────────────────────
create table public.donor_messages (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  donor_id    uuid references profiles(id) on delete set null,
  message     text not null check (char_length(message) between 1 and 1000),
  anonymous   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── campaign_owner_replies ────────────────────────────────────────────────────
create table public.campaign_owner_replies (
  id               uuid primary key default uuid_generate_v4(),
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  donor_message_id uuid references donor_messages(id) on delete set null,
  owner_id         uuid not null references profiles(id) on delete cascade,
  message          text not null check (char_length(message) between 1 and 5000),
  created_at       timestamptz not null default now()
);

-- ── payouts ───────────────────────────────────────────────────────────────────
create table public.payouts (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  amount_cents  bigint not null check (amount_cents > 0),
  fee_cents     bigint not null default 0 check (fee_cents >= 0),
  payout_speed  text not null default 'standard'
                  check (payout_speed in ('standard','same_day','instant')),
  status        text not null default 'requested'
                  check (status in ('requested','approved','paid','failed','frozen','released')),
  stripe_payout_id text,
  note          text,
  requested_at  timestamptz not null default now(),
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── transparency_ledger_items ─────────────────────────────────────────────────
create table public.transparency_ledger_items (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  item_type   text not null default 'expense'
               check (item_type in ('expense','income','milestone','receipt','payout','offline_donation','other')),
  title       text not null,
  amount_cents bigint,
  category    text,
  status      text not null default 'pending'
               check (status in ('pending','received','paid','verified')),
  receipt_url text,
  created_at  timestamptz not null default now()
);

-- ── trust_scores ──────────────────────────────────────────────────────────────
create table public.trust_scores (
  id                   uuid primary key default uuid_generate_v4(),
  campaign_id          uuid not null references campaigns(id) on delete cascade,
  score                int  not null default 0 check (score between 0 and 100),
  identity_score       int  not null default 0 check (identity_score between 0 and 25),
  story_score          int  not null default 0 check (story_score between 0 and 25),
  activity_score       int  not null default 0 check (activity_score between 0 and 25),
  transparency_score   int  not null default 0 check (transparency_score between 0 and 25),
  computed_at          timestamptz not null default now()
);

-- ── verification_documents ────────────────────────────────────────────────────
create table public.verification_documents (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  campaign_id   uuid references campaigns(id) on delete cascade,
  doc_type      text not null check (doc_type in ('id','medical','financial','legal','nonprofit','other')),
  storage_path  text not null,
  public_url    text,
  is_public     boolean not null default false,
  verified      boolean not null default false,
  verified_by   uuid references profiles(id) on delete set null,
  verified_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ── risk_flags ────────────────────────────────────────────────────────────────
create table public.risk_flags (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  flag_type   text not null,
  severity    text not null default 'low' check (severity in ('low','medium','high','critical')),
  description text,
  resolved    boolean not null default false,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── admin_reviews ─────────────────────────────────────────────────────────────
create table public.admin_reviews (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  reviewer_id  uuid references profiles(id) on delete set null,
  action       text not null check (action in ('approved','rejected','flagged','held','released')),
  notes        text,
  created_at   timestamptz not null default now()
);

-- ── refunds ───────────────────────────────────────────────────────────────────
create table public.refunds (
  id              uuid primary key default uuid_generate_v4(),
  donation_id     uuid not null references donations(id) on delete cascade,
  amount_cents    bigint not null check (amount_cents > 0),
  reason          text,
  notes           text,
  status          text not null default 'requested'
                   check (status in ('requested','approved','declined','processed')),
  requested_by    uuid references profiles(id) on delete set null,
  stripe_refund_id text,
  processed_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ── campaign_reports ──────────────────────────────────────────────────────────
create table public.campaign_reports (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  reporter_id  uuid references profiles(id) on delete set null,
  reason       text not null,
  details      text,
  status       text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
  resolved_by  uuid references profiles(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ── webhook_events ────────────────────────────────────────────────────────────
create table public.webhook_events (
  id               uuid primary key default uuid_generate_v4(),
  stripe_event_id  text not null unique,
  event_type       text not null,
  payload          jsonb not null default '{}'::jsonb,
  processed_at     timestamptz,
  processing_error text,
  created_at       timestamptz not null default now()
);

-- ── ai_generations ────────────────────────────────────────────────────────────
create table public.ai_generations (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references profiles(id) on delete set null,
  campaign_id      uuid references campaigns(id) on delete set null,
  generation_type  text not null,
  prompt           jsonb not null default '{}'::jsonb,
  result           jsonb not null default '{}'::jsonb,
  tokens_used      int,
  model            text,
  created_at       timestamptz not null default now()
);

-- ── subscriptions ─────────────────────────────────────────────────────────────
create table public.subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references profiles(id) on delete cascade,
  plan                   text not null check (plan in ('free','starter','pro','enterprise')),
  status                 text not null default 'active'
                          check (status in ('active','trialing','cancelled','past_due','paused')),
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── platform_settings ────────────────────────────────────────────────────────
create table public.platform_settings (
  id      int primary key default 1 check (id = 1),  -- singleton row
  config  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id, config) values (1, '{
  "platformName": "CharitMe",
  "tagline": "Fundraising that thinks for you.",
  "supportEmail": "hello@charitme.com",
  "supportPhone": "",
  "timezone": "America/New_York",
  "currency": "USD",
  "platformFeePercent": 0,
  "donationFeePercent": 2.9,
  "stripeLiveMode": true,
  "allowNewRegistrations": true,
  "maintenanceMode": false
}'::jsonb) on conflict (id) do nothing;

-- ── feature_flags ─────────────────────────────────────────────────────────────
create table public.feature_flags (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,
  enabled     boolean not null default false,
  description text,
  rollout_pct int not null default 100 check (rollout_pct between 0 and 100),
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── audit_logs ────────────────────────────────────────────────────────────────
create table public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ── integration_connections ───────────────────────────────────────────────────
create table public.integration_connections (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  provider   text not null,
  status     text not null default 'connected'
              check (status in ('connected','paused','disconnected')),
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider)
);

-- ── team_members ──────────────────────────────────────────────────────────────
create table public.team_members (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'editor'
               check (role in ('owner','admin','editor','viewer','finance')),
  invited_by  uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (campaign_id, user_id)
);

-- ── nonprofit_profiles ────────────────────────────────────────────────────────
create table public.nonprofit_profiles (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  mission     text,
  ein         text unique,
  website_url text,
  logo_url    text,
  verified    boolean not null default false,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── coach_sessions ────────────────────────────────────────────────────────────
create table public.coach_sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  campaign_id   uuid references campaigns(id) on delete set null,
  message_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── donor_crm_contacts ────────────────────────────────────────────────────────
create table public.donor_crm_contacts (
  id               uuid primary key default uuid_generate_v4(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  donor_id         uuid references profiles(id) on delete set null,
  email            text,
  full_name        text,
  phone            text,
  tags             text[] not null default '{}',
  lifetime_value_cents bigint not null default 0,
  last_donated_at  timestamptz,
  notes            text,
  consent_email    boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_profiles_email                on profiles(email);
create index if not exists idx_profiles_roles                on profiles using gin(roles);
create index if not exists idx_campaigns_user_id             on campaigns(user_id);
create index if not exists idx_campaigns_status              on campaigns(status);
create index if not exists idx_campaigns_category            on campaigns(category);
create index if not exists idx_campaigns_slug                on campaigns(slug);
create index if not exists idx_campaigns_featured            on campaigns(featured) where featured = true;
create index if not exists idx_campaigns_raised              on campaigns(raised_amount desc);
create index if not exists idx_campaigns_created             on campaigns(created_at desc);
create index if not exists idx_campaigns_title_trgm          on campaigns using gin(title gin_trgm_ops);
create index if not exists idx_donations_campaign_id         on donations(campaign_id);
create index if not exists idx_donations_donor_id            on donations(donor_id);
create index if not exists idx_donations_status              on donations(status);
create index if not exists idx_donations_created             on donations(created_at desc);
create index if not exists idx_recurring_donor_id            on recurring_donations(donor_id);
create index if not exists idx_recurring_campaign_id         on recurring_donations(campaign_id);
create index if not exists idx_recurring_subscription_id     on recurring_donations(stripe_subscription_id);
create index if not exists idx_payouts_user_id               on payouts(user_id);
create index if not exists idx_payouts_campaign_id           on payouts(campaign_id);
create index if not exists idx_payouts_status                on payouts(status);
create index if not exists idx_ledger_campaign_id            on transparency_ledger_items(campaign_id);
create index if not exists idx_trust_scores_campaign_id      on trust_scores(campaign_id);
create index if not exists idx_webhook_events_stripe_id      on webhook_events(stripe_event_id);
create index if not exists idx_audit_logs_actor_id           on audit_logs(actor_id);
create index if not exists idx_audit_logs_created            on audit_logs(created_at desc);
create index if not exists idx_campaign_updates_campaign_id  on campaign_updates(campaign_id);
create index if not exists idx_donor_messages_campaign_id    on donor_messages(campaign_id);
create index if not exists idx_team_members_campaign_id      on team_members(campaign_id);
create index if not exists idx_refunds_donation_id           on refunds(donation_id);
create index if not exists idx_refunds_requested_by          on refunds(requested_by);
create index if not exists idx_integration_owner_id          on integration_connections(owner_id);
create index if not exists idx_coach_sessions_user_id        on coach_sessions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table profiles                enable row level security;
alter table connected_accounts      enable row level security;
alter table campaigns               enable row level security;
alter table campaign_media          enable row level security;
alter table campaign_updates        enable row level security;
alter table campaign_milestones     enable row level security;
alter table donations               enable row level security;
alter table recurring_donations     enable row level security;
alter table donor_messages          enable row level security;
alter table campaign_owner_replies  enable row level security;
alter table payouts                 enable row level security;
alter table transparency_ledger_items enable row level security;
alter table trust_scores            enable row level security;
alter table verification_documents  enable row level security;
alter table risk_flags              enable row level security;
alter table admin_reviews           enable row level security;
alter table refunds                 enable row level security;
alter table campaign_reports        enable row level security;
alter table webhook_events          enable row level security;
alter table ai_generations          enable row level security;
alter table subscriptions           enable row level security;
alter table platform_settings       enable row level security;
alter table feature_flags           enable row level security;
alter table audit_logs              enable row level security;
alter table integration_connections enable row level security;
alter table team_members            enable row level security;
alter table nonprofit_profiles      enable row level security;
alter table coach_sessions          enable row level security;
alter table donor_crm_contacts      enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles
create policy profiles_read           on profiles for select using (true);
create policy profiles_insert_self    on profiles for insert with check (auth.uid() = id or is_admin());
create policy profiles_update_own     on profiles for update using (auth.uid() = id or is_admin());

-- connected_accounts
create policy ca_own_read             on connected_accounts for select using (auth.uid() = user_id or is_admin());
create policy ca_own_insert           on connected_accounts for insert with check (auth.uid() = user_id);
create policy ca_own_update           on connected_accounts for update using (auth.uid() = user_id or is_admin());

-- campaigns
create policy campaigns_public_read   on campaigns for select using (status = 'active' or auth.uid() = user_id or is_admin());
create policy campaigns_insert_own    on campaigns for insert with check (auth.uid() = user_id);
create policy campaigns_update_own    on campaigns for update using (auth.uid() = user_id or is_admin());
create policy campaigns_admin_delete  on campaigns for delete using (is_admin());

-- campaign_media
create policy media_public_read       on campaign_media for select using (true);
create policy media_owner_write       on campaign_media for insert with check (auth.uid() = uploader_id or is_admin());
create policy media_owner_delete      on campaign_media for delete using (auth.uid() = uploader_id or is_admin());

-- campaign_updates
create policy updates_public_read     on campaign_updates for select using (true);
create policy updates_owner_write     on campaign_updates for insert with check
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy updates_owner_update    on campaign_updates for update using
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

-- campaign_milestones
create policy milestones_public_read  on campaign_milestones for select using (true);
create policy milestones_owner_write  on campaign_milestones for insert with check
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy milestones_owner_delete on campaign_milestones for delete using
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

-- donations
create policy donations_read          on donations for select using
  (auth.uid() = donor_id or is_admin() or
   exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy donations_insert_svc    on donations for insert with check (true);
create policy donations_admin_update  on donations for update using (is_admin());

-- recurring_donations
create policy recurring_own_read      on recurring_donations for select using
  (auth.uid() = donor_id or is_admin() or
   exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy recurring_own_insert    on recurring_donations for insert with check (auth.uid() = donor_id or is_admin());
create policy recurring_own_update    on recurring_donations for update using (auth.uid() = donor_id or is_admin());

-- donor_messages
create policy dm_public_read          on donor_messages for select using (true);
create policy dm_insert_any           on donor_messages for insert with check (true);
create policy dm_admin_update         on donor_messages for update using (is_admin());

-- campaign_owner_replies
create policy cor_owner_all           on campaign_owner_replies for all using
  (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id);
create policy cor_donor_read          on campaign_owner_replies for select using
  (exists (select 1 from donor_messages dm where dm.id = donor_message_id and dm.donor_id = auth.uid()));

-- payouts
create policy payouts_own_read        on payouts for select using (auth.uid() = user_id or is_admin());
create policy payouts_own_insert      on payouts for insert with check (auth.uid() = user_id);
create policy payouts_admin_update    on payouts for update using (is_admin());

-- transparency_ledger_items
create policy ledger_public_read      on transparency_ledger_items for select using (true);
create policy ledger_owner_write      on transparency_ledger_items for insert with check
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy ledger_owner_delete     on transparency_ledger_items for delete using
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

-- trust_scores
create policy trust_public_read       on trust_scores for select using (true);
create policy trust_admin_write       on trust_scores for all using (is_admin()) with check (is_admin());

-- verification_documents
create policy vdoc_own_read           on verification_documents for select using (auth.uid() = user_id or is_admin());
create policy vdoc_own_insert         on verification_documents for insert with check (auth.uid() = user_id or is_admin());
create policy vdoc_admin_update       on verification_documents for update using (is_admin());

-- risk_flags
create policy risk_admin_all          on risk_flags for all using (is_admin()) with check (is_admin());

-- admin_reviews
create policy reviews_admin_all       on admin_reviews for all using (is_admin()) with check (is_admin());

-- refunds
create policy refunds_own_read        on refunds for select using (auth.uid() = requested_by or is_admin());
create policy refunds_own_insert      on refunds for insert with check (auth.uid() = requested_by);
create policy refunds_admin_update    on refunds for update using (is_admin()) with check (is_admin());

-- campaign_reports
create policy reports_insert_public   on campaign_reports for insert with check (true);
create policy reports_admin_read      on campaign_reports for select using (is_admin());
create policy reports_admin_update    on campaign_reports for update using (is_admin());

-- webhook_events
create policy webhooks_admin_all      on webhook_events for all using (is_admin()) with check (is_admin());

-- ai_generations
create policy ai_gen_own_read         on ai_generations for select using (auth.uid() = user_id or is_admin());
create policy ai_gen_insert           on ai_generations for insert with check (auth.uid() = user_id or is_admin());

-- subscriptions
create policy subs_own_read           on subscriptions for select using (auth.uid() = user_id or is_admin());
create policy subs_admin_write        on subscriptions for all using (is_admin());

-- platform_settings
create policy settings_admin_all      on platform_settings for all using (is_admin()) with check (is_admin());
create policy settings_public_read    on platform_settings for select using (true);

-- feature_flags
create policy flags_public_read       on feature_flags for select using (true);
create policy flags_admin_write       on feature_flags for all using (is_admin()) with check (is_admin());

-- audit_logs
create policy audit_admin_read        on audit_logs for select using (is_admin());
create policy audit_admin_insert      on audit_logs for insert with check (is_admin());

-- integration_connections
create policy integrations_own_all    on integration_connections for all
  using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

-- team_members
create policy team_campaign_read      on team_members for select using
  (auth.uid() = user_id or is_admin() or
   exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy team_owner_write        on team_members for insert with check
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy team_owner_delete       on team_members for delete using
  (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

-- nonprofit_profiles
create policy npo_public_read         on nonprofit_profiles for select using (true);
create policy npo_own_write           on nonprofit_profiles for insert with check (auth.uid() = owner_id);
create policy npo_own_update          on nonprofit_profiles for update using (auth.uid() = owner_id or is_admin());

-- coach_sessions
create policy coach_own_all           on coach_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- donor_crm_contacts
create policy crm_own_all             on donor_crm_contacts for all
  using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────
create trigger set_updated_at_profiles    before update on profiles                 for each row execute function set_updated_at();
create trigger set_updated_at_ca          before update on connected_accounts        for each row execute function set_updated_at();
create trigger set_updated_at_campaigns   before update on campaigns                 for each row execute function set_updated_at();
create trigger set_updated_at_updates     before update on campaign_updates          for each row execute function set_updated_at();
create trigger set_updated_at_donations   before update on donations                 for each row execute function set_updated_at();
create trigger set_updated_at_recurring   before update on recurring_donations       for each row execute function set_updated_at();
create trigger set_updated_at_payouts     before update on payouts                   for each row execute function set_updated_at();
create trigger set_updated_at_subs        before update on subscriptions             for each row execute function set_updated_at();
create trigger set_updated_at_settings    before update on platform_settings         for each row execute function set_updated_at();
create trigger set_updated_at_flags       before update on feature_flags             for each row execute function set_updated_at();
create trigger set_updated_at_integr      before update on integration_connections   for each row execute function set_updated_at();
create trigger set_updated_at_npo         before update on nonprofit_profiles        for each row execute function set_updated_at();
create trigger set_updated_at_coach       before update on coach_sessions            for each row execute function set_updated_at();
create trigger set_updated_at_crm         before update on donor_crm_contacts        for each row execute function set_updated_at();

create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- record_donation RPC  (idempotent — used by Stripe webhook)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_donation(
  p_stripe_event_id          text,
  p_campaign_id              uuid,
  p_donor_id                 uuid,
  p_amount_cents             bigint,
  p_tip_cents                bigint,
  p_processing_fee_cents     bigint,
  p_message                  text,
  p_anonymous                boolean,
  p_stripe_payment_intent_id text,
  p_stripe_checkout_session_id text
) returns jsonb language plpgsql security definer as $$
declare
  v_existing uuid;
begin
  -- Idempotency check
  select id into v_existing from donations
  where stripe_checkout_session_id = p_stripe_checkout_session_id
     or (stripe_payment_intent_id = p_stripe_payment_intent_id and p_stripe_payment_intent_id is not null)
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('status','already_processed','id', v_existing);
  end if;

  insert into donations (
    campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents,
    status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id
  ) values (
    p_campaign_id, p_donor_id, p_amount_cents, p_tip_cents, p_processing_fee_cents,
    'completed', p_anonymous, p_message, p_stripe_payment_intent_id, p_stripe_checkout_session_id
  );

  update campaigns
  set raised_amount = raised_amount + p_amount_cents,
      backer_count  = backer_count  + 1,
      updated_at    = now()
  where id = p_campaign_id;

  insert into webhook_events (stripe_event_id, event_type, payload, processed_at)
  values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, now())
  on conflict (stripe_event_id) do nothing;

  return jsonb_build_object('status','recorded');
exception when others then
  insert into webhook_events (stripe_event_id, event_type, payload, processing_error)
  values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, sqlerrm)
  on conflict (stripe_event_id) do nothing;
  raise;
end; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA — 500 rows per table
-- Bypasses FK checks via session_replication_role so auth.users are not needed.
-- Remove this block before deploying to a production project.
-- ─────────────────────────────────────────────────────────────────────────────

set session_replication_role = replica;

-- ── Feature flags (static, not 500 rows needed) ───────────────────────────────
insert into feature_flags (key, enabled, description, rollout_pct) values
  ('ai_growth_plan',       true,  'AI Growth Plan dashboard',           100),
  ('ai_coach',             true,  'AI Fundraising Coach chat',          100),
  ('recurring_donations',  true,  'Monthly recurring donation toggle',  100),
  ('campaign_milestones',  true,  'Campaign milestone tracking',        100),
  ('donor_leaderboard',    true,  'Public donor leaderboard',           100),
  ('campaign_analytics',   true,  'Campaign analytics dashboard',       100),
  ('referral_program',     false, 'Donor referral tracking',             0),
  ('team_fundraising',     true,  'Peer-to-peer team fundraising',      100),
  ('embedded_forms',       false, 'Embeddable donation widget',          25),
  ('nonprofit_receipts',   true,  'Automated nonprofit tax receipts',   100)
on conflict (key) do nothing;

-- ── Platform settings (singleton, already inserted above) ─────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- All 500-row seed data in one DO block for efficient FK resolution
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  -- Sample data arrays
  first_names  text[] := array['James','Emma','Oliver','Sophia','William','Ava','Benjamin','Isabella',
    'Elijah','Mia','Lucas','Charlotte','Mason','Amelia','Logan','Harper','Ethan','Evelyn','Aiden',
    'Abigail','Jackson','Emily','Sebastian','Elizabeth','Mateo','Sofia','Jack','Avery','Owen','Ella',
    'Samuel','Scarlett','Wyatt','Grace','John','Chloe','David','Victoria','Joseph','Riley','Carter',
    'Aria','Julian','Lily','Luke','Zoey','Gabriel','Penelope','Anthony','Layla'];

  last_names   text[] := array['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
    'Wilson','Martinez','Anderson','Taylor','Thomas','Hernandez','Moore','Martin','Jackson','Thompson',
    'White','Lopez','Lee','Gonzalez','Harris','Clark','Lewis','Robinson','Walker','Perez','Hall',
    'Young','Allen','Sanchez','Wright','King','Scott','Green','Baker','Adams','Nelson','Hill',
    'Ramirez','Campbell','Mitchell','Roberts','Carter','Phillips','Evans','Turner','Torres','Parker'];

  categories   text[] := array['Medical','Memorial/Funeral','Emergency','Disaster Relief','Education',
    'Animal/Pet','Community','Nonprofit','Sports/Teams','Other'];

  cam_statuses text[] := array['active','active','active','active','active','draft','paused','completed',
    'active','active'];

  cam_trusts   text[] := array['Verified','Verified','Trusted','Needs More Info','Trusted','Verified',
    'Trusted','Verified','Needs More Info','Trusted'];

  plans        text[] := array['free','free','free','starter','starter','pro','free','free','starter','free'];
  pay_speeds   text[] := array['standard','standard','standard','same_day','instant','standard','standard','same_day','standard','instant'];
  pay_statuses text[] := array['requested','approved','paid','paid','failed','paid','requested','approved','paid','paid'];
  don_statuses text[] := array['completed','completed','completed','completed','failed','completed','completed','completed','refunded','completed'];
  rec_cadences text[] := array['monthly','monthly','monthly','weekly','quarterly','monthly','annual','monthly','monthly','monthly'];
  rec_statuses text[] := array['active','active','active','active','cancelled','active','active','past_due','active','active'];
  integrations text[] := array['Stripe','Zapier','Mailchimp','Google Analytics','Facebook Pixel','Slack','HubSpot','QuickBooks'];
  doc_types    text[] := array['id','medical','financial','legal','nonprofit','other'];
  flag_types   text[] := array['duplicate_story','suspicious_payout','identity_mismatch','rapid_donations','unusual_amount'];
  sev_levels   text[] := array['low','medium','high','critical','low','medium','low','low','medium','low'];
  update_titles text[] := array['Surgery went well — thank you!','Milestone reached!','Important update from our team',
    'We hit 50% of our goal!','Your generosity is making a difference','Quick update from the field',
    'Thank you for 100 donations!','Progress report','We are almost there!','Final update'];
  update_bodies text[] := array[
    'Thanks to your incredible support, we''ve made huge progress. Every dollar counts.',
    'We''re overwhelmed by the love. Here''s a quick update on where things stand.',
    'The funds have been put to immediate use. Here is what happened this week.',
    'Halfway there! Your donations are working. Keep sharing and help us reach the goal.',
    'A heartfelt thank you to every single person who donated or shared our campaign.',
    'Things are moving fast. We wanted to give you this quick progress snapshot.',
    'One hundred donors strong! We can''t believe the outpouring of support.',
    'This week we achieved a major milestone. Read on for the full story.',
    'Almost at our goal! A final push this weekend would get us across the line.',
    'The campaign has concluded. Here is what your generosity accomplished.'
  ];

  webhook_events_list text[] := array['checkout.session.completed','customer.subscription.created',
    'customer.subscription.updated','customer.subscription.deleted','account.updated',
    'invoice.payment_succeeded','invoice.payment_failed','payment_intent.succeeded',
    'charge.succeeded','charge.failed'];

  ai_gen_types text[] := array['campaign_copilot','content_facebook','content_twitter',
    'content_instagram','content_linkedin','content_whatsapp','content_sms','content_email','content_update'];

  report_reasons text[] := array['Suspected fraud','Misuse of funds','Duplicate campaign',
    'Campaign violates policy','Impersonation','False claims in story'];

  npo_names    text[] := array['Hope Foundation','Bright Futures Fund','Community Care Alliance',
    'Hearts United','Children First Initiative','Green Earth Society','Veterans Aid Network',
    'Animal Rescue League','Education For All','Disaster Relief Corps'];

  doc_storage_paths text[] := array['docs/id_card.pdf','docs/medical_bill.pdf','docs/bank_statement.pdf',
    'docs/legal_docs.pdf','docs/501c3.pdf','docs/other_doc.pdf'];

  -- Working variables
  profile_ids    uuid[];
  campaign_ids   uuid[];
  donation_ids   uuid[];
  msg_ids        uuid[];
  new_id         uuid;
  fn             text;
  ln             text;
  cat            text;
  goal_amt       bigint;
  raised_pct     float;
  raised_amt     bigint;
  backer_ct      int;
  amt            bigint;
  camp_id        uuid;
  donor_id_val   uuid;
  organizer_id   uuid;
  i              int;
begin
  -- ── 1. PROFILES (500) ──────────────────────────────────────────────────────
  for i in 1..500 loop
    new_id := uuid_generate_v4();
    fn := first_names[1 + ((i - 1) % array_length(first_names, 1))];
    ln := last_names[1  + ((i - 1) % array_length(last_names,  1))];
    insert into profiles (
      id, email, full_name, bio, roles, plan, identity_verified,
      trust_passport_score, timezone, currency, created_at, updated_at
    ) values (
      new_id,
      lower(fn) || '.' || lower(ln) || i || '@CharitMe.example',
      fn || ' ' || ln,
      'Passionate about making a difference in the community. Fundraiser and donor.',
      case when i <= 3  then '["admin","donor"]'::jsonb
           when i <= 30 then '["organizer","donor"]'::jsonb
           else              '["donor"]'::jsonb end,
      plans[1 + ((i - 1) % 10)],
      i % 3 = 0,
      30 + (i % 70),
      'America/New_York',
      'usd',
      now() - ((500 - i) * interval '12 hours'),
      now() - ((500 - i) * interval '6 hours')
    );
    profile_ids := array_append(profile_ids, new_id);
  end loop;

  -- ── 2. CONNECTED_ACCOUNTS (500) ───────────────────────────────────────────
  for i in 1..500 loop
    insert into connected_accounts (
      user_id, stripe_account_id, charges_enabled, payouts_enabled,
      details_submitted, verification_status, created_at, updated_at
    ) values (
      profile_ids[i],
      'acct_' || substr(md5(i::text), 1, 16),
      i % 4 != 0,
      i % 4 != 0,
      i % 4 != 0,
      case when i % 4 = 0 then 'pending' else 'verified' end,
      now() - ((500 - i) * interval '10 hours'),
      now() - ((500 - i) * interval '5 hours')
    ) on conflict (stripe_account_id) do nothing;
  end loop;

  -- ── 3. CAMPAIGNS (500) ────────────────────────────────────────────────────
  for i in 1..500 loop
    new_id := uuid_generate_v4();
    cat := categories[1 + ((i - 1) % 10)];
    goal_amt := ((i % 50) + 1) * 100000;  -- $1,000 – $50,000 in cents
    raised_pct := case when cam_statuses[1 + ((i-1)%10)] = 'completed' then 1.0
                       when cam_statuses[1 + ((i-1)%10)] = 'active'    then (i % 100) / 100.0
                       else 0 end;
    raised_amt := floor(goal_amt * raised_pct)::bigint;
    backer_ct  := floor(raised_amt / 5000)::int;
    organizer_id := profile_ids[1 + ((i - 1) % 500)];

    insert into campaigns (
      id, user_id, slug, title, tagline, description, category,
      goal_amount, raised_amount, backer_count, deadline, status,
      beneficiary_name, beneficiary_relationship,
      cover_image_url, trust_status, campaign_health_score,
      nonprofit_verified, ai_generated, featured, created_at, updated_at
    ) values (
      new_id,
      organizer_id,
      'campaign-' || i || '-' || substr(md5(new_id::text), 1, 8),
      case cat
        when 'Medical'           then 'Help ' || first_names[1 + ((i-1)%50)] || ' cover urgent medical costs'
        when 'Memorial/Funeral'  then 'Celebrating the life of ' || first_names[1 + ((i-1)%50)] || ' ' || last_names[1 + ((i-1)%50)]
        when 'Emergency'         then 'Emergency fund for ' || first_names[1 + ((i-1)%50)] || '''s family'
        when 'Disaster Relief'   then 'Disaster relief for affected families in need'
        when 'Education'         then first_names[1 + ((i-1)%50)] || '''s education scholarship fund'
        when 'Animal/Pet'        then 'Emergency vet care for ' || first_names[1 + ((i-1)%50)] || '''s rescue'
        when 'Community'         then 'Community project: rebuilding our neighborhood center'
        when 'Nonprofit'         then 'Support ' || first_names[1 + ((i-1)%50)] || '''s nonprofit mission'
        when 'Sports/Teams'      then 'Help our team make it to nationals this season'
        else                          'Help us reach our goal and make a real impact'
      end,
      'Every dollar gets us closer to changing a life. Please share this campaign.',
      'This fundraiser was created to address a real and urgent need. Our community has rallied together in support, and every contribution—large or small—brings us closer to our goal. Funds will be used transparently, with regular updates posted for all donors to see.',
      cat,
      goal_amt,
      raised_amt,
      backer_ct,
      case when cam_statuses[1 + ((i-1)%10)] = 'draft' then null
           else (current_date + ((i % 180) || ' days')::interval)::date end,
      cam_statuses[1 + ((i - 1) % 10)],
      first_names[1 + ((i-1)%50)] || ' ' || last_names[1 + ((i-1)%50)],
      case (i % 5)
        when 0 then 'myself'
        when 1 then 'sister'
        when 2 then 'friend'
        when 3 then 'parent'
        else        'community member'
      end,
      'https://images.unsplash.com/photo-' || (1500000000 + i * 100000) || '?w=800',
      cam_trusts[1 + ((i - 1) % 10)],
      40 + (i % 60),
      cat = 'Nonprofit' and i % 3 = 0,
      i % 7 = 0,
      i <= 10,
      now() - ((500 - i) * interval '8 hours'),
      now() - ((500 - i) * interval '2 hours')
    );
    campaign_ids := array_append(campaign_ids, new_id);
  end loop;

  -- ── 4. CAMPAIGN_MEDIA (500) ───────────────────────────────────────────────
  for i in 1..500 loop
    insert into campaign_media (
      campaign_id, uploader_id, media_type, storage_path, public_url,
      caption, alt_text, sort_order, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1  + ((i - 1) % 500)],
      case when i % 10 = 0 then 'video'
           when i % 15 = 0 then 'document'
           else 'image' end,
      'campaigns/' || substr(md5(i::text), 1, 16) || '.' || (case when i % 10 = 0 then 'mp4' when i % 15 = 0 then 'pdf' else 'jpg' end),
      'https://storage.CharitMe.example/campaigns/media_' || i || '.jpg',
      'Campaign media ' || i || ' — showing progress and impact.',
      'Photo showing the campaign beneficiary and supporters',
      i % 5,
      now() - ((500 - i) * interval '7 hours')
    );
  end loop;

  -- ── 5. CAMPAIGN_UPDATES (500) ─────────────────────────────────────────────
  for i in 1..500 loop
    insert into campaign_updates (
      campaign_id, user_id, title, body, ai_generated, published_at, created_at, updated_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1  + ((i - 1) % 500)],
      update_titles[1 + ((i - 1) % 10)],
      update_bodies[1 + ((i - 1) % 10)],
      i % 4 = 0,
      now() - ((500 - i) * interval '6 hours'),
      now() - ((500 - i) * interval '6 hours'),
      now() - ((500 - i) * interval '3 hours')
    );
  end loop;

  -- ── 6. CAMPAIGN_MILESTONES (500) ──────────────────────────────────────────
  for i in 1..500 loop
    insert into campaign_milestones (
      campaign_id, title, description, target_amount, reached_at, sort_order, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      case (i % 4)
        when 0 then '25% — First quarter reached'
        when 1 then '50% — Halfway to goal!'
        when 2 then '75% — Almost there'
        else        '100% — Goal achieved!'
      end,
      'Reaching this milestone means we can begin the next phase of our plan.',
      (((i % 4) + 1) * 25 * 100000 / 100)::bigint,
      case when i % 3 = 0 then now() - ((i % 30) * interval '1 day') else null end,
      i % 4,
      now() - ((500 - i) * interval '5 hours')
    );
  end loop;

  -- ── 7. DONATIONS (500) ────────────────────────────────────────────────────
  for i in 1..500 loop
    new_id := uuid_generate_v4();
    camp_id     := campaign_ids[1 + ((i - 1) % 500)];
    donor_id_val := profile_ids[1  + ((i - 1) % 500)];
    amt := (((i % 100) + 1) * 500)::bigint;  -- $5 to $500 in cents

    insert into donations (
      id, campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents,
      status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id,
      offline, created_at, updated_at
    ) values (
      new_id,
      camp_id,
      case when i % 10 = 0 then null else donor_id_val end,
      amt,
      floor(amt * 0.08)::bigint,
      floor(amt * 0.029 + 30)::bigint,
      don_statuses[1 + ((i - 1) % 10)],
      i % 8 = 0,
      case when i % 4 = 0 then 'Wishing you all the best! Stay strong.' else null end,
      'pi_' || substr(md5(i::text), 1, 24),
      'cs_' || substr(md5((i * 2)::text), 1, 24),
      i % 20 = 0,
      now() - ((500 - i) * interval '3 hours'),
      now() - ((500 - i) * interval '1 hour')
    );
    donation_ids := array_append(donation_ids, new_id);
  end loop;

  -- ── 8. RECURRING_DONATIONS (500) ──────────────────────────────────────────
  for i in 1..500 loop
    amt := (((i % 20) + 1) * 1000)::bigint;  -- $10 to $200/period
    insert into recurring_donations (
      donor_id, campaign_id, amount_cents, cadence, status,
      stripe_subscription_id, next_bill_at, created_at, updated_at
    ) values (
      profile_ids[1  + ((i - 1) % 500)],
      campaign_ids[1 + ((i - 1) % 500)],
      amt,
      rec_cadences[1 + ((i - 1) % 10)],
      rec_statuses[1 + ((i - 1) % 10)],
      'sub_' || substr(md5(i::text), 1, 20),
      case when rec_statuses[1+((i-1)%10)] = 'active'
           then now() + interval '30 days' else null end,
      now() - ((500 - i) * interval '4 hours'),
      now() - ((500 - i) * interval '2 hours')
    ) on conflict (stripe_subscription_id) do nothing;
  end loop;

  -- ── 9. DONOR_MESSAGES (500) ───────────────────────────────────────────────
  for i in 1..500 loop
    new_id := uuid_generate_v4();
    insert into donor_messages (
      id, campaign_id, donor_id, message, anonymous, created_at
    ) values (
      new_id,
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1  + ((i - 1) % 500)],
      case (i % 6)
        when 0 then 'Sending all our love and prayers. You''ve got this!'
        when 1 then 'This cause is so close to my heart. Happy to contribute.'
        when 2 then 'Donated in memory of someone we lost. Keep going strong.'
        when 3 then 'Shared with my whole network. More support is on the way!'
        when 4 then 'Amazing cause. Wishing the whole family strength and healing.'
        else        'Just a small token of support. Thank you for what you do.'
      end,
      i % 7 = 0,
      now() - ((500 - i) * interval '2 hours')
    );
    msg_ids := array_append(msg_ids, new_id);
  end loop;

  -- ── 10. CAMPAIGN_OWNER_REPLIES (500) ──────────────────────────────────────
  for i in 1..500 loop
    insert into campaign_owner_replies (
      campaign_id, donor_message_id, owner_id, message, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      msg_ids[1      + ((i - 1) % 500)],
      profile_ids[1  + ((i - 1) % 500)],
      case (i % 5)
        when 0 then 'Thank you so much for your kind words and generous support!'
        when 1 then 'Your message means the world to us. We will keep you updated.'
        when 2 then 'We are so grateful for people like you. Every dollar helps.'
        when 3 then 'Thank you! Your support is helping us get through a very hard time.'
        else        'Words cannot express our gratitude. You are an angel!'
      end,
      now() - ((500 - i) * interval '90 minutes')
    );
  end loop;

  -- ── 11. PAYOUTS (500) ─────────────────────────────────────────────────────
  for i in 1..500 loop
    amt := (((i % 100) + 1) * 5000)::bigint;  -- $50 – $5000
    insert into payouts (
      campaign_id, user_id, amount_cents, fee_cents, payout_speed, status,
      stripe_payout_id, requested_at, paid_at, created_at, updated_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1  + ((i - 1) % 500)],
      amt,
      case pay_speeds[1+((i-1)%10)]
        when 'instant'  then floor(amt * 0.015)::bigint
        when 'same_day' then floor(amt * 0.015)::bigint
        else 0 end,
      pay_speeds[1  + ((i - 1) % 10)],
      pay_statuses[1 + ((i - 1) % 10)],
      'po_' || substr(md5(i::text), 1, 20),
      now() - ((500 - i) * interval '5 hours'),
      case pay_statuses[1+((i-1)%10)] when 'paid' then now() - ((500-i) * interval '2 hours') else null end,
      now() - ((500 - i) * interval '5 hours'),
      now() - ((500 - i) * interval '1 hour')
    );
  end loop;

  -- ── 12. TRANSPARENCY_LEDGER_ITEMS (500) ───────────────────────────────────
  for i in 1..500 loop
    insert into transparency_ledger_items (
      campaign_id, item_type, title, amount_cents, category, status, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      case (i % 6)
        when 0 then 'expense'
        when 1 then 'milestone'
        when 2 then 'receipt'
        when 3 then 'payout'
        when 4 then 'offline_donation'
        else        'other'
      end,
      case (i % 8)
        when 0 then 'Hospital invoice — primary treatment'
        when 1 then '50% milestone reached!'
        when 2 then 'Receipt from supplier: item delivered'
        when 3 then 'Payout to beneficiary bank account'
        when 4 then 'Cash donation received at community event'
        when 5 then 'Travel and accommodation expenses'
        when 6 then 'Equipment purchase — verified by organiser'
        else        'Administrative costs — documented'
      end,
      (((i % 50) + 1) * 2000)::bigint,
      case (i % 5)
        when 0 then 'Medical'
        when 1 then 'Travel'
        when 2 then 'Equipment'
        when 3 then 'Admin'
        else        'Other'
      end,
      case (i % 4)
        when 0 then 'pending'
        when 1 then 'received'
        when 2 then 'paid'
        else        'verified'
      end,
      now() - ((500 - i) * interval '6 hours')
    );
  end loop;

  -- ── 13. TRUST_SCORES (500) ────────────────────────────────────────────────
  for i in 1..500 loop
    insert into trust_scores (
      campaign_id, score, identity_score, story_score, activity_score, transparency_score, computed_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      40 + (i % 60),
      5 + (i % 20),
      5 + (i % 20),
      5 + (i % 20),
      5 + (i % 20),
      now() - ((500 - i) * interval '4 hours')
    );
  end loop;

  -- ── 14. VERIFICATION_DOCUMENTS (500) ──────────────────────────────────────
  for i in 1..500 loop
    insert into verification_documents (
      user_id, campaign_id, doc_type, storage_path, public_url, is_public,
      verified, verified_at, notes, created_at
    ) values (
      profile_ids[1  + ((i - 1) % 500)],
      campaign_ids[1 + ((i - 1) % 500)],
      doc_types[1    + ((i - 1) % 6)],
      doc_storage_paths[1 + ((i - 1) % 6)],
      case when i % 3 = 0 then 'https://storage.CharitMe.example/' || doc_storage_paths[1+((i-1)%6)] else null end,
      i % 3 = 0,
      i % 2 = 0,
      case when i % 2 = 0 then now() - ((500-i) * interval '2 hours') else null end,
      case when i % 2 = 0 then 'Document reviewed and approved by CharitMe trust team.' else null end,
      now() - ((500 - i) * interval '5 hours')
    );
  end loop;

  -- ── 15. RISK_FLAGS (500) ──────────────────────────────────────────────────
  for i in 1..500 loop
    insert into risk_flags (
      campaign_id, user_id, flag_type, severity, description, resolved, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1  + ((i - 1) % 500)],
      flag_types[1   + ((i - 1) % 5)],
      sev_levels[1   + ((i - 1) % 10)],
      'Automated risk flag triggered by analysis engine. Manual review recommended.',
      i % 3 = 0,
      now() - ((500 - i) * interval '10 hours')
    );
  end loop;

  -- ── 16. ADMIN_REVIEWS (500) ───────────────────────────────────────────────
  for i in 1..500 loop
    insert into admin_reviews (
      campaign_id, reviewer_id, action, notes, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1 + ((i - 1) % 3)],  -- first 3 profiles are admins
      (array['approved','approved','approved','flagged','held','released'])[1 + ((i-1) % 6)],
      'Admin review completed. Campaign meets all platform guidelines.',
      now() - ((500 - i) * interval '3 hours')
    );
  end loop;

  -- ── 17. REFUNDS (500) ─────────────────────────────────────────────────────
  for i in 1..500 loop
    insert into refunds (
      donation_id, amount_cents, reason, notes, status,
      requested_by, processed_at, created_at
    ) values (
      donation_ids[1 + ((i - 1) % 500)],
      (((i % 20) + 1) * 500)::bigint,
      case (i % 4)
        when 0 then 'Campaign did not deliver on its stated purpose.'
        when 1 then 'Duplicate donation — charged twice by mistake.'
        when 2 then 'Donor changed their mind within the refund window.'
        else        'Suspected fraudulent campaign — requesting refund.'
      end,
      'Refund request submitted via donor portal within 60 days.',
      (array['requested','approved','declined','processed'])[1 + ((i-1) % 4)],
      profile_ids[1 + ((i - 1) % 500)],
      case when i % 3 = 0 then now() - ((500-i) * interval '1 hour') else null end,
      now() - ((500 - i) * interval '2 hours')
    );
  end loop;

  -- ── 18. CAMPAIGN_REPORTS (500) ────────────────────────────────────────────
  for i in 1..500 loop
    insert into campaign_reports (
      campaign_id, reporter_id, reason, details, status, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      case when i % 8 = 0 then null else profile_ids[1 + ((i-1) % 500)] end,
      report_reasons[1 + ((i - 1) % 6)],
      'Reporter provided detailed account of the concern. Under investigation.',
      (array['open','open','investigating','resolved','dismissed'])[1 + ((i-1) % 5)],
      now() - ((500 - i) * interval '4 hours')
    );
  end loop;

  -- ── 19. WEBHOOK_EVENTS (500) ──────────────────────────────────────────────
  for i in 1..500 loop
    insert into webhook_events (
      stripe_event_id, event_type, payload, processed_at, processing_error, created_at
    ) values (
      'evt_' || substr(md5(i::text || 'webhook'), 1, 24),
      webhook_events_list[1 + ((i - 1) % 10)],
      ('{"id": "evt_' || i || '", "type": "' || webhook_events_list[1+((i-1)%10)] || '"}')::jsonb,
      case when i % 10 != 0 then now() - ((500-i) * interval '30 minutes') else null end,
      case when i % 10 = 0  then 'Processing error: timeout after 30s' else null end,
      now() - ((500 - i) * interval '1 hour')
    ) on conflict (stripe_event_id) do nothing;
  end loop;

  -- ── 20. AI_GENERATIONS (500) ──────────────────────────────────────────────
  for i in 1..500 loop
    insert into ai_generations (
      user_id, campaign_id, generation_type, prompt, result, tokens_used, model, created_at
    ) values (
      profile_ids[1  + ((i - 1) % 500)],
      campaign_ids[1 + ((i - 1) % 500)],
      ai_gen_types[1 + ((i - 1) % 9)],
      ('{"category":"' || categories[1+((i-1)%10)] || '","beneficiary":"User ' || i || '"}')::jsonb,
      ('{"title":"AI Generated Campaign ' || i || '","story":"Compelling story text...","qualityScore":' || (60 + (i % 40)) || '}')::jsonb,
      300 + (i % 700),
      case when i % 3 = 0 then 'gpt-4o' else 'gpt-4.1-mini' end,
      now() - ((500 - i) * interval '45 minutes')
    );
  end loop;

  -- ── 21. SUBSCRIPTIONS (500) ───────────────────────────────────────────────
  for i in 1..500 loop
    insert into subscriptions (
      user_id, plan, status, stripe_subscription_id, stripe_customer_id,
      current_period_start, current_period_end, cancel_at_period_end,
      created_at, updated_at
    ) values (
      profile_ids[i],
      plans[1 + ((i - 1) % 10)],
      (array['active','active','active','active','trialing','cancelled','past_due','active','active','active'])[1 + ((i-1)%10)],
      case when plans[1+((i-1)%10)] != 'free'
           then 'sub_saas_' || substr(md5(i::text || 'saas'), 1, 16)
           else null end,
      case when plans[1+((i-1)%10)] != 'free'
           then 'cus_' || substr(md5(i::text), 1, 16)
           else null end,
      now() - interval '30 days',
      now() + interval '30 days',
      i % 20 = 0,
      now() - ((500 - i) * interval '2 days'),
      now() - ((500 - i) * interval '1 day')
    ) on conflict do nothing;
  end loop;

  -- ── 22. AUDIT_LOGS (500) ──────────────────────────────────────────────────
  for i in 1..500 loop
    insert into audit_logs (
      actor_id, action, target_type, target_id, metadata, created_at
    ) values (
      profile_ids[1 + ((i - 1) % 3)],  -- admins
      (array['user.updated','campaign.approved','campaign.rejected','donation.refunded',
             'payout.approved','user.suspended','flag.resolved','setting.updated',
             'user.role_changed','campaign.featured'])[1 + ((i-1) % 10)],
      (array['user','campaign','donation','payout','system'])[1 + ((i-1) % 5)],
      case (i % 5)
        when 0 then profile_ids[1 + ((i-1) % 500)]
        else        campaign_ids[1 + ((i-1) % 500)]
      end,
      ('{"reason":"Admin action ' || i || '","ip":"192.168.1.' || (i % 255) || '"}')::jsonb,
      now() - ((500 - i) * interval '20 minutes')
    );
  end loop;

  -- ── 23. INTEGRATION_CONNECTIONS (500) ─────────────────────────────────────
  for i in 1..500 loop
    insert into integration_connections (
      owner_id, provider, status, config, created_at, updated_at
    ) values (
      profile_ids[1 + ((i - 1) % 500)],
      integrations[1 + ((i - 1) % 8)],
      case when i % 8 = 0 then 'paused' else 'connected' end,
      case integrations[1+((i-1)%8)]
        when 'Zapier'           then ('{"webhook_url":"https://hooks.zapier.com/hooks/catch/' || i || '/abc123"}')::jsonb
        when 'Google Analytics' then ('{"api_key":"G-' || upper(substr(md5(i::text), 1, 10)) || '"}')::jsonb
        when 'Facebook Pixel'   then ('{"api_key":"' || (1000000000 + i * 1000) || '"}')::jsonb
        else                         ('{"api_key":"key_' || substr(md5(i::text), 1, 32) || '"}')::jsonb
      end,
      now() - ((500 - i) * interval '3 hours'),
      now() - ((500 - i) * interval '1 hour')
    ) on conflict (owner_id, provider) do nothing;
  end loop;

  -- ── 24. TEAM_MEMBERS (500) ────────────────────────────────────────────────
  for i in 1..500 loop
    insert into team_members (
      campaign_id, user_id, role, invited_by, accepted_at, created_at
    ) values (
      campaign_ids[1 + ((i - 1) % 500)],
      profile_ids[1  + ((i     ) % 500)],   -- offset by 1 so member != organiser
      (array['owner','editor','editor','viewer','finance','admin'])[1 + ((i-1) % 6)],
      profile_ids[1  + ((i - 1) % 500)],
      case when i % 4 != 0 then now() - ((500-i) * interval '2 hours') else null end,
      now() - ((500 - i) * interval '6 hours')
    ) on conflict (campaign_id, user_id) do nothing;
  end loop;

  -- ── 25. NONPROFIT_PROFILES (500) ──────────────────────────────────────────
  for i in 1..500 loop
    insert into nonprofit_profiles (
      owner_id, name, slug, mission, ein, website_url, verified, verified_at, created_at, updated_at
    ) values (
      profile_ids[1 + ((i - 1) % 500)],
      npo_names[1 + ((i - 1) % 10)] || ' ' || i,
      'npo-' || lower(replace(npo_names[1+((i-1)%10)], ' ', '-')) || '-' || i,
      'Our mission is to create lasting positive change in communities that need it most.',
      case when i % 2 = 0 then lpad((12000000 + i)::text, 9, '0') else null end,
      'https://npo' || i || '.org',
      i % 3 = 0,
      case when i % 3 = 0 then now() - ((500-i) * interval '5 hours') else null end,
      now() - ((500 - i) * interval '10 hours'),
      now() - ((500 - i) * interval '3 hours')
    ) on conflict (slug) do nothing;
  end loop;

  -- ── 26. COACH_SESSIONS (500) ──────────────────────────────────────────────
  for i in 1..500 loop
    insert into coach_sessions (
      user_id, campaign_id, message_count, created_at, updated_at
    ) values (
      profile_ids[1  + ((i - 1) % 500)],
      campaign_ids[1 + ((i - 1) % 500)],
      1 + (i % 20),
      now() - ((500 - i) * interval '3 hours'),
      now() - ((500 - i) * interval '30 minutes')
    );
  end loop;

  -- ── 27. DONOR_CRM_CONTACTS (500) ──────────────────────────────────────────
  for i in 1..500 loop
    fn := first_names[1 + ((i - 1) % array_length(first_names, 1))];
    ln := last_names[1  + ((i - 1) % array_length(last_names,  1))];
    insert into donor_crm_contacts (
      owner_id, donor_id, email, full_name, phone, tags,
      lifetime_value_cents, last_donated_at, notes, consent_email, created_at, updated_at
    ) values (
      profile_ids[1 + ((i - 1) % 500)],
      case when i % 3 = 0 then profile_ids[1 + (i % 500)] else null end,
      lower(fn) || '.' || lower(ln) || i || '@donor.example',
      fn || ' ' || ln,
      '+1 (555) ' || lpad((100 + (i % 900))::text, 3, '0') || '-' || lpad((i % 10000)::text, 4, '0'),
      case (i % 5)
        when 0 then array['major-donor','recurring']
        when 1 then array['first-time']
        when 2 then array['lapsed','re-engage']
        when 3 then array['recurring','loyal']
        else        array['prospect']
      end,
      (((i % 200) + 1) * 2500)::bigint,
      now() - ((i % 365) * interval '1 day'),
      'CRM contact imported from donor history.',
      i % 7 != 0,
      now() - ((500 - i) * interval '4 hours'),
      now() - ((500 - i) * interval '1 hour')
    );
  end loop;

end $$;

-- ── Restore session replication role ──────────────────────────────────────────
set session_replication_role = default;

-- ─────────────────────────────────────────────────────────────────────────────
-- ENSURE PLATFORM OWNER HAS ADMIN ROLE
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'blackstoneagencyllc@gmail.com' limit 1;
  if v_uid is not null then
    insert into public.profiles (id, email, roles)
    values (v_uid, 'blackstoneagencyllc@gmail.com', '["admin","donor"]'::jsonb)
    on conflict (id) do update
      set roles = (
        select jsonb_agg(distinct role)
        from (
          select jsonb_array_elements_text(profiles.roles) as role
          union select 'admin'
        ) m
      ),
      updated_at = now();
  end if;
end; $$;

-- ── campaign_faqs (AI-generated + manual) ─────────────────────────────────────
create table if not exists public.campaign_faqs (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  question    text not null check (char_length(question) between 5 and 300),
  answer      text not null check (char_length(answer)  between 5 and 2000),
  sort_order  int  not null default 0,
  is_public   boolean not null default true,
  ai_generated boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_campaign_faqs_campaign_id on campaign_faqs(campaign_id);
alter table campaign_faqs enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='campaign_faqs' and policyname='faqs_public_read') then
    create policy faqs_public_read on campaign_faqs for select using (is_public = true or is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='campaign_faqs' and policyname='faqs_owner_write') then
    create policy faqs_owner_write on campaign_faqs for insert with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='campaign_faqs' and policyname='faqs_owner_update') then
    create policy faqs_owner_update on campaign_faqs for update using (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='campaign_faqs' and policyname='faqs_owner_delete') then
    create policy faqs_owner_delete on campaign_faqs for delete using (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
  end if;
end $$;

-- ── Re-grant to PostgREST roles after adding new tables ────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');

-- ── Seed 500 donor_messages scattered across campaigns & profiles ──────────────
-- Run ONLY in dev/staging — the session_replication_role bypass is already set
-- above so FK constraints are deferred.
do $$
declare
  messages text[] := array[
    'Sending all my love and support to you and your family!',
    'This cause touched my heart. Keep going strong!',
    'Donated in honor of someone I lost. You are not alone.',
    'Shared with my whole network. More is coming your way!',
    'What you are doing is truly inspiring. Keep pushing!',
    'Every dollar counts. Praying for a swift recovery.',
    'So proud of this community coming together. Thank you!',
    'Matched by my employer! Double the impact!',
    'This made me cry in the best possible way. Thank you.',
    'Wishing you strength and healing. You got this!',
    'Just a small token but given with a big heart.',
    'Sharing on all my social media. You deserve this!',
    'Amazing cause. Thank you for being so transparent.',
    'My kids and I donated together as a family activity.',
    'Keep updating us — we are all cheering for you!',
    'Donated anonymously but thinking of you always.',
    'Your story moved me to tears. Much love from afar.',
    'May every dollar bring you one step closer to your goal.',
    'Blessed to be able to give. Stay hopeful!',
    'This is exactly the kind of campaign the world needs more of.',
    'Covered the processing fee too — 100% for you!',
    'Recurring donation set up. You can count on me monthly!',
    'Your transparency ledger is amazing. Keep it up!',
    'Rooting for you from across the country!',
    'Small donation but huge belief in what you are doing.',
    'I found you through a friend — so glad I did.',
    'Just donated my birthday money to your campaign!',
    'Thank you for using CharitMe — love the transparency.',
    'Will share at church this Sunday. Expect more donations!',
    'This cause is close to my heart for personal reasons.'
  ];
  campaign_ids_arr uuid[];
  profile_ids_arr  uuid[];
  i int;
begin
  -- Collect available campaign and profile IDs
  select array_agg(id) into campaign_ids_arr from (select id from campaigns order by backer_count desc limit 50) c;
  select array_agg(id) into profile_ids_arr  from (select id from profiles  order by created_at desc limit 100) p;

  if campaign_ids_arr is null or array_length(campaign_ids_arr, 1) = 0 then
    raise notice 'No campaigns found — skipping donor_messages seed.';
    return;
  end if;

  for i in 1..500 loop
    insert into donor_messages (
      campaign_id,
      donor_id,
      message,
      anonymous,
      created_at
    ) values (
      campaign_ids_arr[1 + ((i - 1) % array_length(campaign_ids_arr, 1))],
      case when profile_ids_arr is not null and array_length(profile_ids_arr, 1) > 0 and i % 8 != 0
        then profile_ids_arr[1 + ((i - 1) % array_length(profile_ids_arr, 1))]
        else null
      end,
      messages[1 + ((i - 1) % array_length(messages, 1))],
      i % 7 = 0,  -- ~14% anonymous
      now() - ((500 - i) * interval '4 hours')
    );
  end loop;

  raise notice 'Seeded 500 donor_messages.';
end $$;
