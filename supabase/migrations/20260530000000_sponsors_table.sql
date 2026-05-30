-- Sponsors table for homepage rotating logo bar
create table if not exists public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  website     text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.sponsors enable row level security;

-- Public read for active sponsors with logos
create policy "sponsors public read"
  on public.sponsors for select
  using (active = true);

-- Admin full access
create policy "sponsors admin all"
  on public.sponsors for all
  using (public.is_admin())
  with check (public.is_admin());

create trigger sponsors_updated_at
  before update on public.sponsors
  for each row execute function public.set_updated_at();
