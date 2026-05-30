-- CharitMe production schema
create extension if not exists "uuid-ossp";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and roles ? 'admin'
  );
$$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  roles jsonb not null default '["donor"]'::jsonb,
  identity_verified boolean not null default false,
  trust_passport_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connected_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  beneficiary_profile_id uuid references profiles(id) on delete set null,
  slug text not null unique,
  title text not null,
  tagline text,
  description text not null,
  category text not null,
  goal_amount bigint not null,
  raised_amount bigint not null default 0,
  backer_count int not null default 0,
  deadline date,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','rejected','frozen')),
  beneficiary_name text,
  beneficiary_relationship text,
  cover_image_url text,
  trust_status text not null default 'Needs More Info',
  campaign_health_score int not null default 0,
  payout_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_media (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  uploader_id uuid not null references profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','document')),
  storage_path text not null,
  public_url text,
  reuse_risk_score int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists campaign_updates (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  body text not null,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists donations (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  message text,
  anonymous boolean not null default false,
  stripe_payment_intent_id text,
  status text not null default 'completed' check (status in ('pending','completed','refunded','failed')),
  created_at timestamptz not null default now()
);

create table if not exists donor_tips (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete set null,
  donor_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists platform_fees (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete set null,
  amount_cents bigint not null,
  fee_type text not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  connected_account_id uuid references connected_accounts(id) on delete set null,
  amount_cents bigint not null,
  payout_speed text not null check (payout_speed in ('standard','same_day','instant')),
  fee_cents bigint not null default 0,
  status text not null default 'requested' check (status in ('requested','approved','paid','failed','frozen','released')),
  risk_score int not null default 0,
  stripe_payout_id text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trust_scores (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  score int not null,
  status text not null,
  signals jsonb not null default '[]'::jsonb,
  model text not null default 'deterministic',
  created_at timestamptz not null default now()
);

create table if not exists risk_flags (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  code text not null,
  label text not null,
  severity text not null check (severity in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists verification_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists transparency_ledger_items (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  item_type text not null check (item_type in ('milestone','receipt','expense','payout','impact_update')),
  title text not null,
  description text,
  category text not null default 'Other',
  amount_cents bigint,
  receipt_url text,
  status text not null default 'published',
  ai_summary text,
  created_at timestamptz not null default now()
);

create table if not exists donor_messages (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid references donations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  message text not null,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  tier text not null,
  status text not null default 'active',
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_reviews (
  id uuid primary key default uuid_generate_v4(),
  reviewer_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  review_type text not null,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refunds (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid not null references donations(id) on delete cascade,
  amount_cents bigint not null,
  reason text,
  status text not null default 'requested',
  stripe_refund_id text,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default uuid_generate_v4(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create table if not exists ai_generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  generation_type text not null,
  prompt jsonb not null,
  output jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaign_reports (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_status_idx on campaigns(status);
create index if not exists campaigns_user_id_idx on campaigns(user_id);
create index if not exists campaigns_slug_idx on campaigns(slug);
create index if not exists donations_campaign_id_idx on donations(campaign_id);
create index if not exists donations_donor_id_idx on donations(donor_id);
create unique index if not exists donations_stripe_payment_intent_id_uidx on donations(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists donor_tips_stripe_payment_intent_id_uidx on donor_tips(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists platform_fees_stripe_payment_intent_id_uidx on platform_fees(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists payouts_campaign_id_idx on payouts(campaign_id);
create index if not exists risk_flags_status_idx on risk_flags(status);
create index if not exists ledger_campaign_id_idx on transparency_ledger_items(campaign_id);

create or replace function increment_campaign_stats(p_campaign_id uuid, p_amount bigint)
returns void language plpgsql security definer as $$
begin
  update campaigns
  set raised_amount = raised_amount + p_amount,
      backer_count = backer_count + 1,
      updated_at = now()
  where id = p_campaign_id;
end;
$$;

create or replace function increment_campaign_stats_after_donation()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' then
    update campaigns
    set raised_amount = raised_amount + new.amount_cents,
        backer_count = backer_count + 1,
        updated_at = now()
    where id = new.campaign_id;
  end if;
  return new;
end;
$$;

drop trigger if exists donations_increment_campaign_stats on donations;
create trigger donations_increment_campaign_stats
  after insert on donations
  for each row execute function increment_campaign_stats_after_donation();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
drop trigger if exists connected_accounts_set_updated_at on connected_accounts;
create trigger connected_accounts_set_updated_at before update on connected_accounts for each row execute function set_updated_at();
drop trigger if exists campaigns_set_updated_at on campaigns;
create trigger campaigns_set_updated_at before update on campaigns for each row execute function set_updated_at();
drop trigger if exists payouts_set_updated_at on payouts;
create trigger payouts_set_updated_at before update on payouts for each row execute function set_updated_at();
drop trigger if exists risk_flags_set_updated_at on risk_flags;
create trigger risk_flags_set_updated_at before update on risk_flags for each row execute function set_updated_at();
drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at before update on subscriptions for each row execute function set_updated_at();
drop trigger if exists admin_reviews_set_updated_at on admin_reviews;
create trigger admin_reviews_set_updated_at before update on admin_reviews for each row execute function set_updated_at();
drop trigger if exists campaign_reports_set_updated_at on campaign_reports;
create trigger campaign_reports_set_updated_at before update on campaign_reports for each row execute function set_updated_at();

alter table profiles enable row level security;
alter table connected_accounts enable row level security;
alter table campaigns enable row level security;
alter table campaign_media enable row level security;
alter table campaign_updates enable row level security;
alter table donations enable row level security;
alter table donor_tips enable row level security;
alter table platform_fees enable row level security;
alter table payouts enable row level security;
alter table trust_scores enable row level security;
alter table risk_flags enable row level security;
alter table verification_documents enable row level security;
alter table transparency_ledger_items enable row level security;
alter table donor_messages enable row level security;
alter table subscriptions enable row level security;
alter table admin_reviews enable row level security;
alter table refunds enable row level security;
alter table webhook_events enable row level security;
alter table ai_generations enable row level security;
alter table campaign_reports enable row level security;

create policy profiles_read on profiles for select using (true);
create policy profiles_update_own on profiles for update using (auth.uid() = id or is_admin());

create policy campaigns_public_read on campaigns for select using (status = 'active' or auth.uid() = user_id or is_admin());
create policy campaigns_insert_own on campaigns for insert with check (auth.uid() = user_id);
create policy campaigns_update_own on campaigns for update using (auth.uid() = user_id or is_admin());

create policy donations_donor_or_owner_read on donations for select using (
  auth.uid() = donor_id or is_admin() or exists (select 1 from campaigns where campaigns.id = donations.campaign_id and campaigns.user_id = auth.uid())
);
create policy donations_insert_service on donations for insert with check (true);

create policy donor_tips_owner_read on donor_tips for select using (
  auth.uid() = donor_id or is_admin() or exists (select 1 from campaigns where campaigns.id = donor_tips.campaign_id and campaigns.user_id = auth.uid())
);
create policy donor_tips_insert_service on donor_tips for insert with check (true);

create policy platform_fees_owner_read on platform_fees for select using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = platform_fees.campaign_id and campaigns.user_id = auth.uid())
);
create policy platform_fees_insert_service on platform_fees for insert with check (true);

create policy payouts_owner_admin_read on payouts for select using (auth.uid() = user_id or is_admin());
create policy payouts_owner_insert on payouts for insert with check (auth.uid() = user_id);
create policy payouts_admin_update on payouts for update using (is_admin());

create policy private_owner_admin on verification_documents for select using (auth.uid() = user_id or is_admin());
create policy private_owner_admin_insert on verification_documents for insert with check (auth.uid() = user_id or is_admin());

create policy ledger_public_read on transparency_ledger_items for select using (true);
create policy ledger_owner_write on transparency_ledger_items for insert with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

create policy admin_all_risk on risk_flags for all using (is_admin()) with check (is_admin());
create policy admin_all_reviews on admin_reviews for all using (is_admin()) with check (is_admin());
create policy admin_all_webhooks on webhook_events for all using (is_admin()) with check (is_admin());

create policy reports_insert_public on campaign_reports for insert with check (true);
create policy reports_admin_read on campaign_reports for select using (is_admin());

create policy own_subscriptions on subscriptions for select using (auth.uid() = user_id or is_admin());
create policy own_ai_generations on ai_generations for select using (auth.uid() = user_id or is_admin());
create policy public_trust_scores on trust_scores for select using (true);
create policy public_updates on campaign_updates for select using (true);
create policy owner_updates on campaign_updates for insert with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
