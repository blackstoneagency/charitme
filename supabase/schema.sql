-- RaiseMoney schema
-- Apply via: Supabase SQL Editor or `supabase db push`

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────
create table if not exists profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  avatar_url        text,
  stripe_account_id text,
  stripe_onboarded  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Campaigns ────────────────────────────────────────────────────────────────
create table if not exists campaigns (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  slug            text not null unique,
  title           text not null,
  tagline         text,
  description     text,
  goal_amount     bigint not null,             -- in cents
  raised_amount   bigint not null default 0,   -- in cents
  backer_count    int not null default 0,
  deadline        date,
  status          text not null default 'active' check (status in ('active', 'paused', 'completed')),
  category        text not null default 'Other',
  cover_image_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists campaigns_status_idx on campaigns(status);
create index if not exists campaigns_user_id_idx on campaigns(user_id);
create index if not exists campaigns_slug_idx on campaigns(slug);

-- ─── Donations ────────────────────────────────────────────────────────────────
create table if not exists donations (
  id                        uuid primary key default uuid_generate_v4(),
  campaign_id               uuid not null references campaigns(id) on delete cascade,
  donor_id                  uuid references profiles(id) on delete set null,
  amount_cents              bigint not null,
  message                   text,
  anonymous                 boolean not null default false,
  stripe_payment_intent_id  text,
  status                    text not null default 'completed' check (status in ('pending', 'completed', 'refunded')),
  created_at                timestamptz not null default now()
);

create index if not exists donations_campaign_id_idx on donations(campaign_id);
create index if not exists donations_donor_id_idx on donations(donor_id);

-- ─── Campaign updates ─────────────────────────────────────────────────────────
create table if not exists campaign_updates (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists campaign_updates_campaign_id_idx on campaign_updates(campaign_id);

-- ─── RPC: increment campaign stats atomically ──────────────────────────────
create or replace function increment_campaign_stats(
  p_campaign_id uuid,
  p_amount      bigint
)
returns void language plpgsql security definer as $$
begin
  update campaigns
  set
    raised_amount = raised_amount + p_amount,
    backer_count  = backer_count + 1,
    updated_at    = now()
  where id = p_campaign_id;
end;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table campaigns enable row level security;
alter table donations enable row level security;
alter table campaign_updates enable row level security;

-- Profiles: users can read all, write own
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Campaigns: anyone reads active, owners manage theirs
create policy "campaigns_select" on campaigns for select using (status = 'active' or auth.uid() = user_id);
create policy "campaigns_insert" on campaigns for insert with check (auth.uid() = user_id);
create policy "campaigns_update" on campaigns for update using (auth.uid() = user_id);

-- Donations: public can see completed; donors see own
create policy "donations_select" on donations
  for select using (status = 'completed' and (not anonymous or auth.uid() = donor_id));
create policy "donations_insert" on donations for insert with check (true);

-- Campaign updates: public read, owner write
create policy "updates_select" on campaign_updates for select using (true);
create policy "updates_insert" on campaign_updates for insert
  with check (auth.uid() = user_id and exists (
    select 1 from campaigns where id = campaign_id and user_id = auth.uid()
  ));
