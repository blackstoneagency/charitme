-- Reconcile databases where 20260525002000 rolled back after encountering
-- legacy tables without the newer nonprofit_id columns.

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
  updated_at timestamptz not null default now(),
  verification_status text not null default 'unverified',
  tax_receipt_enabled boolean not null default false,
  country text not null default 'US',
  address text,
  public_profile_enabled boolean not null default true,
  constraint nonprofit_profiles_verification_status_check
    check (verification_status in ('unverified','pending','verified','rejected'))
);

create table if not exists fundraising_events (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  slug text not null unique,
  event_type text not null default 'fundraiser'
    check (event_type in ('fundraiser','gala','giving_day','livestream','auction','registration')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  virtual_url text,
  status text not null default 'draft'
    check (status in ('draft','published','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  description text,
  capacity integer,
  cover_image_url text
);

alter table if exists donation_forms
  add column if not exists nonprofit_id uuid references nonprofit_profiles(id) on delete cascade;
alter table if exists donor_crm_contacts
  add column if not exists nonprofit_id uuid references nonprofit_profiles(id) on delete cascade;
alter table if exists fundraising_events
  add column if not exists nonprofit_id uuid references nonprofit_profiles(id) on delete cascade;

create index if not exists creator_profiles_user_id_idx on creator_profiles(user_id);
create index if not exists campaign_launch_settings_campaign_id_idx on campaign_launch_settings(campaign_id);
create index if not exists nonprofit_profiles_owner_id_idx on nonprofit_profiles(owner_id);
create index if not exists fundraising_events_nonprofit_id_idx on fundraising_events(nonprofit_id);

alter table creator_profiles enable row level security;
alter table campaign_launch_settings enable row level security;
alter table nonprofit_profiles enable row level security;
alter table fundraising_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policy where polrelid = 'creator_profiles'::regclass and polname = 'public_creator_profiles_read') then
    create policy public_creator_profiles_read on creator_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'creator_profiles'::regclass and polname = 'creator_profiles_owner_write') then
    create policy creator_profiles_owner_write on creator_profiles for all
      using (auth.uid() = user_id or is_admin())
      with check (auth.uid() = user_id or is_admin());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'campaign_launch_settings'::regclass and polname = 'public_campaign_launch_read') then
    create policy public_campaign_launch_read on campaign_launch_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'campaign_launch_settings'::regclass and polname = 'campaign_launch_owner_write') then
    create policy campaign_launch_owner_write on campaign_launch_settings for all
      using (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_launch_settings.campaign_id and campaigns.user_id = auth.uid()))
      with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_launch_settings.campaign_id and campaigns.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'nonprofit_profiles'::regclass and polname = 'public_nonprofit_profiles_read') then
    create policy public_nonprofit_profiles_read on nonprofit_profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'nonprofit_profiles'::regclass and polname = 'nonprofit_profiles_owner_write') then
    create policy nonprofit_profiles_owner_write on nonprofit_profiles for all
      using (auth.uid() = owner_id or is_admin())
      with check (auth.uid() = owner_id or is_admin());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'fundraising_events'::regclass and polname = 'public_events_read') then
    create policy public_events_read on fundraising_events for select using (status = 'published' or is_admin());
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'fundraising_events'::regclass and polname = 'events_owner_write') then
    create policy events_owner_write on fundraising_events for all
      using (is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = fundraising_events.nonprofit_id and nonprofit_profiles.owner_id = auth.uid()))
      with check (is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = fundraising_events.nonprofit_id and nonprofit_profiles.owner_id = auth.uid()));
  end if;
end
$$;

drop trigger if exists creator_profiles_set_updated_at on creator_profiles;
create trigger creator_profiles_set_updated_at before update on creator_profiles for each row execute function set_updated_at();
drop trigger if exists campaign_launch_settings_set_updated_at on campaign_launch_settings;
create trigger campaign_launch_settings_set_updated_at before update on campaign_launch_settings for each row execute function set_updated_at();
drop trigger if exists nonprofit_profiles_set_updated_at on nonprofit_profiles;
create trigger nonprofit_profiles_set_updated_at before update on nonprofit_profiles for each row execute function set_updated_at();
drop trigger if exists fundraising_events_set_updated_at on fundraising_events;
create trigger fundraising_events_set_updated_at before update on fundraising_events for each row execute function set_updated_at();
