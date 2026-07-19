-- ─────────────────────────────────────────────────────────────────────────────
-- Volunteers platform — opportunities, profiles, applications, hours (CHAR-0003)
-- Additive: references existing profiles/campaigns only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Volunteer opportunities (public listings) ──────────────────────────────────
create table if not exists volunteer_opportunities (
  id             uuid primary key default uuid_generate_v4(),
  slug           text not null unique,
  title          text not null,
  org_name       text not null,
  summary        text,
  description    text,
  category       text,
  skills         text[] not null default '{}',
  location       text,
  country        text,
  is_remote      boolean not null default false,
  starts_at      timestamptz,
  ends_at        timestamptz,
  slots          integer,                      -- null = unlimited
  slots_filled   integer not null default 0,
  time_commitment text,                        -- e.g. "4 hrs/week"
  contact_url    text,
  campaign_id    uuid references campaigns(id) on delete set null,
  status         text not null default 'open' check (status in ('open','upcoming','closed')),
  verified       boolean not null default false,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint volunteer_slots_nonneg check (slots is null or slots >= 0),
  constraint volunteer_dates check (starts_at is null or ends_at is null or starts_at <= ends_at)
);
create index if not exists vol_opp_status_idx   on volunteer_opportunities(status) where deleted_at is null;
create index if not exists vol_opp_category_idx on volunteer_opportunities(category) where deleted_at is null;
create index if not exists vol_opp_remote_idx   on volunteer_opportunities(is_remote) where deleted_at is null;
create index if not exists vol_opp_skills_gin   on volunteer_opportunities using gin (skills);
create index if not exists vol_opp_created_by_idx on volunteer_opportunities(created_by);

-- ── Volunteer profiles (one per user, optional) ────────────────────────────────
create table if not exists volunteer_profiles (
  user_id       uuid primary key references profiles(id) on delete cascade,
  headline      text,
  bio           text,
  skills        text[] not null default '{}',
  interests     text[] not null default '{}',
  location      text,
  country       text,
  availability  text,
  remote_ok     boolean not null default true,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists vol_profile_skills_gin on volunteer_profiles using gin (skills);

-- ── Volunteer applications (user applies to an opportunity) ─────────────────────
create table if not exists volunteer_applications (
  id               uuid primary key default uuid_generate_v4(),
  opportunity_id   uuid not null references volunteer_opportunities(id) on delete cascade,
  applicant_user_id uuid not null references profiles(id) on delete cascade,
  message          text,
  status           text not null default 'applied'
                     check (status in ('applied','accepted','declined','withdrawn','completed')),
  hours_logged     numeric(7,2) not null default 0,
  hours_verified   boolean not null default false,
  applied_at       timestamptz not null default now(),
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (opportunity_id, applicant_user_id)
);
create index if not exists vol_app_applicant_idx on volunteer_applications(applicant_user_id) where deleted_at is null;
create index if not exists vol_app_opp_idx       on volunteer_applications(opportunity_id) where deleted_at is null;

-- ── updated_at triggers ─────────────────────────────────────────────────────────
drop trigger if exists vol_opp_set_updated_at on volunteer_opportunities;
create trigger vol_opp_set_updated_at before update on volunteer_opportunities
  for each row execute function set_updated_at();
drop trigger if exists vol_profile_set_updated_at on volunteer_profiles;
create trigger vol_profile_set_updated_at before update on volunteer_profiles
  for each row execute function set_updated_at();
drop trigger if exists vol_app_set_updated_at on volunteer_applications;
create trigger vol_app_set_updated_at before update on volunteer_applications
  for each row execute function set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────────
alter table volunteer_opportunities enable row level security;
alter table volunteer_profiles      enable row level security;
alter table volunteer_applications  enable row level security;

-- opportunities: public read of open/upcoming; creator + admin manage.
drop policy if exists vol_opp_public_read on volunteer_opportunities;
create policy vol_opp_public_read on volunteer_opportunities for select
  using (deleted_at is null and status in ('open','upcoming'));

drop policy if exists vol_opp_creator_read on volunteer_opportunities;
create policy vol_opp_creator_read on volunteer_opportunities for select
  using (created_by = auth.uid() or is_admin());

drop policy if exists vol_opp_creator_write on volunteer_opportunities;
create policy vol_opp_creator_write on volunteer_opportunities for all
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- profiles: public read when is_public; owner + admin manage own.
drop policy if exists vol_profile_public_read on volunteer_profiles;
create policy vol_profile_public_read on volunteer_profiles for select
  using (is_public = true);

drop policy if exists vol_profile_owner on volunteer_profiles;
create policy vol_profile_owner on volunteer_profiles for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- applications: applicant + admin. (Opportunity-owner review access = follow-up.)
drop policy if exists vol_app_owner on volunteer_applications;
create policy vol_app_owner on volunteer_applications for all
  using (applicant_user_id = auth.uid() or is_admin())
  with check (applicant_user_id = auth.uid() or is_admin());
