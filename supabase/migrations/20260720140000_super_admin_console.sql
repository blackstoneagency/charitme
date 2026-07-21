-- ─────────────────────────────────────────────────────────────────────────────
-- Super-Admin Console — role grant + backing tables for the super-admin-only
-- area (Roles, Users, Marketing[SEO/AEO/Campaigns], Feature Flags, Platform
-- Settings, Announcements). Gated in-app by the `super_admin` role; all writes
-- go through the service role (supabaseAdmin) behind a super-admin check.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Grant super_admin (implies admin) to the owner account ───────────────────
update profiles
set roles = (
  select jsonb_agg(distinct r)
  from jsonb_array_elements(coalesce(roles, '["donor"]'::jsonb) || '["admin","super_admin"]'::jsonb) r
)
where lower(email) = 'daniel.hughen@gmail.com';

-- ── seo_settings — per-route SEO metadata (rendered server-side) ─────────────
create table if not exists seo_settings (
  id               uuid primary key default uuid_generate_v4(),
  route            text not null unique,
  title            text,
  meta_description text,
  keywords         text,
  og_title         text,
  og_description   text,
  og_image_url     text,
  canonical_url    text,
  noindex          boolean not null default false,
  updated_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists seo_settings_route_idx on seo_settings(route);

-- ── aeo_entries — Answer-Engine-Optimization Q&A (public structured data) ─────
create table if not exists aeo_entries (
  id           uuid primary key default uuid_generate_v4(),
  question     text not null,
  answer       text not null,
  topic        text,
  schema_type  text not null default 'FAQPage'
                 check (schema_type in ('FAQPage','QAPage','HowTo')),
  priority     integer not null default 0,
  published    boolean not null default true,
  updated_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists aeo_entries_pub_idx on aeo_entries(published, priority desc);

-- ── announcements — site-wide banners ────────────────────────────────────────
create table if not exists announcements (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text,
  level       text not null default 'info' check (level in ('info','success','warning','critical')),
  link_url    text,
  link_label  text,
  active      boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists announcements_active_idx on announcements(active);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists seo_settings_updated_at on seo_settings;
create trigger seo_settings_updated_at before update on seo_settings
  for each row execute function public.set_updated_at();
drop trigger if exists aeo_entries_updated_at on aeo_entries;
create trigger aeo_entries_updated_at before update on aeo_entries
  for each row execute function public.set_updated_at();
drop trigger if exists announcements_updated_at on announcements;
create trigger announcements_updated_at before update on announcements
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
--   seo_settings   — service-role only (read server-side for metadata)
--   aeo_entries    — public read of published (renders as public FAQ schema)
--   announcements  — public read of active (renders in the site banner)
--   Writes on all three: service role only, behind an app-layer super-admin gate.
-- ─────────────────────────────────────────────────────────────────────────────
alter table seo_settings  enable row level security;
alter table aeo_entries   enable row level security;
alter table announcements enable row level security;

drop policy if exists aeo_public_read on aeo_entries;
create policy aeo_public_read on aeo_entries for select using (published = true);

drop policy if exists announcements_public_read on announcements;
create policy announcements_public_read on announcements for select
  using (active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));
