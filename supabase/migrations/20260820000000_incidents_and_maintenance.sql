-- Incidents (design #168) and scheduled maintenance (design #169).
--
-- Both feed the PUBLIC /status page, which already exists but could only report
-- live probe results — it had no way to say "we know, here is what happened".
-- A status page that shows a red dot and no explanation is the moment a user
-- most needs words, so this is the missing half of a page that already ships.
--
-- ⚠️ These tables do NOT exist in production until this migration is applied.
-- Every reader treats a failed query as "unknown", never as "no incidents" —
-- see app/status/page.tsx. That distinction matters more here than anywhere
-- else in the app: reporting "no incidents" because the incidents table is
-- unreachable is the single most misleading thing a status page can do.

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Which surface is affected. Free text rather than an enum: the component
  -- list on /status is authored in TypeScript and will change faster than a
  -- Postgres enum can be migrated.
  component text not null default 'platform',
  status text not null default 'investigating'
    check (status in ('investigating','identified','monitoring','resolved')),
  impact text not null default 'minor'
    check (impact in ('minor','major','critical')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A resolved incident with no resolved_at renders as still-open forever, and
  -- an unresolved one carrying a timestamp claims an all-clear that never
  -- happened. Both directions are wrong, so both are refused.
  constraint incidents_resolved_consistency check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

-- Chronological updates on an incident, so the public page can show a timeline
-- rather than only the latest state.
create table if not exists public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  body text not null,
  status text not null
    check (status in ('investigating','identified','monitoring','resolved')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  component text not null default 'platform',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','completed','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_time_order check (ends_at > starts_at)
);

create index if not exists incidents_started_at_idx on public.incidents (started_at desc);
create index if not exists incidents_unresolved_idx on public.incidents (started_at desc)
  where resolved_at is null;
create index if not exists incident_updates_incident_idx
  on public.incident_updates (incident_id, created_at desc);
create index if not exists maintenance_windows_starts_at_idx
  on public.maintenance_windows (starts_at desc);

alter table public.incidents enable row level security;
alter table public.incident_updates enable row level security;
alter table public.maintenance_windows enable row level security;

-- Public read is the POINT of a status page: an unauthenticated visitor during
-- an outage is the primary audience, and they may well be unable to sign in.
-- Writes are admin-only.
--
-- These rows are written to be read by strangers, so they carry no user data —
-- unlike creator_tips, whose `using (true)` exposed supporter identities and
-- Stripe payment intent IDs (20260812010000). Public-read is correct here and
-- was wrong there; the difference is what is in the row, not the policy.
drop policy if exists incidents_public_read on public.incidents;
create policy incidents_public_read on public.incidents for select using (true);
drop policy if exists incidents_admin_write on public.incidents;
create policy incidents_admin_write on public.incidents
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists incident_updates_public_read on public.incident_updates;
create policy incident_updates_public_read on public.incident_updates for select using (true);
drop policy if exists incident_updates_admin_write on public.incident_updates;
create policy incident_updates_admin_write on public.incident_updates
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists maintenance_public_read on public.maintenance_windows;
create policy maintenance_public_read on public.maintenance_windows for select using (true);
drop policy if exists maintenance_admin_write on public.maintenance_windows;
create policy maintenance_admin_write on public.maintenance_windows
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists incidents_touch on public.incidents;
create trigger incidents_touch before update on public.incidents
  for each row execute function public.set_updated_at();

drop trigger if exists maintenance_windows_touch on public.maintenance_windows;
create trigger maintenance_windows_touch before update on public.maintenance_windows
  for each row execute function public.set_updated_at();
