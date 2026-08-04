-- ─────────────────────────────────────────────────────────────────────────────
-- CharitMe — Sports & Youth cause page. Complete schema.
-- Paste into the Supabase SQL editor and run. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── profiles ────────────────────────────────────────────────────────────────
-- Extends auth.users. `role` drives the admin write policies below.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  role       text not null default 'donor'
             check (role in ('donor','organizer','admin','super_admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- A profile row on signup, so `role` always exists for the policies below.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── campaigns ───────────────────────────────────────────────────────────────
-- Amounts in CENTS. Storing money as a float is how rounding errors reach a
-- donor's receipt.
create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references public.profiles(id) on delete set null,
  slug            text unique not null,
  title           text not null,
  tagline         text,
  description     text,
  category        text not null,
  cover_image_url text,
  goal_amount     bigint not null default 0 check (goal_amount >= 0),
  raised_amount   bigint not null default 0 check (raised_amount >= 0),
  backer_count    integer not null default 0 check (backer_count >= 0),
  status          text not null default 'draft'
                  check (status in ('draft','active','completed','paused')),
  visibility      text not null default 'public'
                  check (visibility in ('public','private','unlisted')),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- The discovery query's exact shape: live, public, by category, best first.
create index if not exists campaigns_discovery_idx
  on public.campaigns (category, status, visibility, raised_amount desc)
  where deleted_at is null;

alter table public.campaigns enable row level security;

-- ⚠️ Three predicates, not one. Dropping any of them publishes a private or
-- soft-deleted campaign to anonymous readers.
drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select using (
    status in ('active','completed') and visibility = 'public' and deleted_at is null
  );

drop policy if exists campaigns_owner_all on public.campaigns;
create policy campaigns_owner_all on public.campaigns
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ── cause_stories ───────────────────────────────────────────────────────────
-- "Stories from the Field". `video_url` NULL means the card renders as a read
-- link — the play control appears only when there is something to play.
create table if not exists public.cause_stories (
  id           uuid primary key default gen_random_uuid(),
  cause_slug   text not null,
  title        text not null,
  blurb        text,
  chip_label   text,
  chip_accent  smallint not null default 0 check (chip_accent between 0 and 2),
  poster_url   text,
  video_url    text,
  campaign_id  uuid references public.campaigns(id) on delete set null,
  sort_order   smallint not null default 0,
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (cause_slug, title)
);

create index if not exists cause_stories_idx
  on public.cause_stories (cause_slug, published, sort_order);

alter table public.cause_stories enable row level security;

drop policy if exists cause_stories_public_read on public.cause_stories;
create policy cause_stories_public_read on public.cause_stories
  for select using (published = true);

drop policy if exists cause_stories_admin_write on public.cause_stories;
create policy cause_stories_admin_write on public.cause_stories
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','super_admin'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','super_admin'))
  );

-- ── cause_impact_stats ──────────────────────────────────────────────────────
-- The "Real Impact" band. `value` is TEXT because "125K+" is a display string,
-- not a quantity. `source_note` is where the publisher records what the claim
-- rests on — an impact figure shown to donors should be attributable.
create table if not exists public.cause_impact_stats (
  id          uuid primary key default gen_random_uuid(),
  cause_slug  text not null,
  value       text not null,
  label       text not null,
  icon        smallint not null default 0 check (icon between 0 and 3),
  sort_order  smallint not null default 0,
  source_note text,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (cause_slug, sort_order)
);

alter table public.cause_impact_stats enable row level security;

drop policy if exists cause_impact_stats_public_read on public.cause_impact_stats;
create policy cause_impact_stats_public_read on public.cause_impact_stats
  for select using (published = true);

drop policy if exists cause_impact_stats_admin_write on public.cause_impact_stats;
create policy cause_impact_stats_admin_write on public.cause_impact_stats
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','super_admin'))
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('admin','super_admin'))
  );
