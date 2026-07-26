-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER_SPEC §7 — multi-tenant `organizations` / `brands`: FOUNDATION ONLY.
--
-- Scope, stated up front so nobody mistakes this for the finished item: this
-- adds the tenancy tables and their access rules. It does NOT add `org_id` to
-- any `marketing_*` table yet. Backfilling and scoping ~14 live tables is a
-- separate, riskier migration that needs a decision about what happens to rows
-- that predate tenancy — and doing it half-way would leave marketing data
-- reachable across tenants, which is worse than not starting.
--
-- Everything here is additive. No existing table is altered, so this cannot
-- break a running deployment.
--
-- A `brand` is a presentation identity (name, voice, palette) belonging to an
-- organization. Kept separate from the org because one nonprofit can legitimately
-- run several campaign brands, and the spec asks for both.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists organizations (
  id           uuid primary key default uuid_generate_v4(),
  slug         text not null unique,
  name         text not null,
  description  text,
  website_url  text,
  logo_url     text,
  -- Free by default; a paid tier is a billing decision, not a schema one.
  plan         text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  status       text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists org_created_by_idx on organizations(created_by) where deleted_at is null;

create table if not exists organization_members (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  -- Deliberately distinct from the platform-wide roles in lib/roles-shared.ts.
  -- A platform `admin` is staff; an org `owner` runs one tenant. Conflating them
  -- is how a tenant admin ends up with platform reach.
  role         text not null default 'member'
                 check (role in ('owner', 'admin', 'editor', 'viewer', 'member')),
  invited_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, user_id)
);

create index if not exists org_member_user_idx on organization_members(user_id) where deleted_at is null;
create index if not exists org_member_org_idx  on organization_members(org_id) where deleted_at is null;

create table if not exists brands (
  id           uuid primary key default uuid_generate_v4(),
  org_id       uuid not null references organizations(id) on delete cascade,
  slug         text not null,
  name         text not null,
  -- Voice/palette live here so a future Brand Constitution (§10) has somewhere
  -- to attach without another migration.
  voice        text,
  palette      jsonb,
  logo_url     text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, slug)
);

create index if not exists brand_org_idx on brands(org_id) where deleted_at is null;

-- ── Membership helper ────────────────────────────────────────────────────────
--
-- `security definer` so RLS on organization_members cannot recurse while the
-- policies below are evaluating membership.
--
-- Returns FALSE rather than NULL when auth.uid() is null (service role). Learned
-- the hard way in 20260806010000: `not (x or y = auth.uid())` evaluates to NULL,
-- not TRUE, when auth.uid() is NULL, so a guard written to be strict silently
-- does not fire. Every comparison here is coalesced to a real boolean.
create or replace function is_org_member(target_org uuid, min_role text default 'member')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when auth.uid() is null then false
      else exists (
        select 1
          from organization_members m
         where m.org_id = target_org
           and m.user_id = auth.uid()
           and m.deleted_at is null
           and case min_role
                 when 'owner'  then m.role = 'owner'
                 when 'admin'  then m.role in ('owner', 'admin')
                 when 'editor' then m.role in ('owner', 'admin', 'editor')
                 else true
               end
      )
    end
  ), false);
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table organizations       enable row level security;
alter table organization_members enable row level security;
alter table brands              enable row level security;

-- Organizations are visible to their members and to platform admins. There is no
-- public read: an org's existence is not marketing material, and a directory is a
-- product decision rather than a default.
drop policy if exists org_member_read on organizations;
create policy org_member_read on organizations for select
  using (deleted_at is null and (is_org_member(id) or coalesce(is_admin(), false)));

drop policy if exists org_admin_write on organizations;
create policy org_admin_write on organizations for all
  using (is_org_member(id, 'admin') or coalesce(is_admin(), false))
  with check (is_org_member(id, 'admin') or coalesce(is_admin(), false));

-- A member can see who else is in their org; only org admins may change it.
drop policy if exists org_members_read on organization_members;
create policy org_members_read on organization_members for select
  using (deleted_at is null and (is_org_member(org_id) or coalesce(is_admin(), false)));

drop policy if exists org_members_admin_write on organization_members;
create policy org_members_admin_write on organization_members for all
  using (is_org_member(org_id, 'admin') or coalesce(is_admin(), false))
  with check (is_org_member(org_id, 'admin') or coalesce(is_admin(), false));

drop policy if exists brands_member_read on brands;
create policy brands_member_read on brands for select
  using (deleted_at is null and (is_org_member(org_id) or coalesce(is_admin(), false)));

drop policy if exists brands_editor_write on brands;
create policy brands_editor_write on brands for all
  using (is_org_member(org_id, 'editor') or coalesce(is_admin(), false))
  with check (is_org_member(org_id, 'editor') or coalesce(is_admin(), false));
