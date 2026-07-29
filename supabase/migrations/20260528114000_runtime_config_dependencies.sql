-- Foundational configuration tables used by later data migrations.
-- This version intentionally sorts before the first admin_settings and
-- feature_flags writes so a clean database can replay the chain in order.

create table if not exists public.admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  rollout_pct integer not null default 100 check (rollout_pct between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;
alter table public.feature_flags enable row level security;

drop policy if exists admin_settings_admin_all on public.admin_settings;
create policy admin_settings_admin_all on public.admin_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists feature_flags_admin_all on public.feature_flags;
create policy feature_flags_admin_all on public.feature_flags
  for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.admin_settings from public, anon, authenticated;
revoke all on table public.feature_flags from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_settings to service_role;
grant select, insert, update, delete on table public.feature_flags to service_role;
