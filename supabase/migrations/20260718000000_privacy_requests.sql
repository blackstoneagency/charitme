-- ─────────────────────────────────────────────────────────────────────────────
-- Privacy & consent: data-export and account-deletion requests
--
-- Records user-initiated GDPR/CCPA requests (export or deletion) with a
-- lifecycle and an admin fulfillment path, plus a lightweight consent ledger.
-- Complements the existing api/exports/* endpoints by making requests auditable.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists privacy_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  request_type text not null check (request_type in ('export','deletion')),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','rejected','cancelled')),
  details text,
  resolution_note text,
  resolver_id uuid references profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists privacy_requests_user_idx on privacy_requests(user_id);
create index if not exists privacy_requests_status_idx on privacy_requests(status);
-- At most one active (pending/processing) request per type per user.
create unique index if not exists privacy_requests_active_unique
  on privacy_requests(user_id, request_type)
  where status in ('pending','processing');

create table if not exists consent_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists consent_records_user_idx on consent_records(user_id);
create index if not exists consent_records_type_idx on consent_records(consent_type);

drop trigger if exists privacy_requests_set_updated_at on privacy_requests;
create trigger privacy_requests_set_updated_at before update on privacy_requests
  for each row execute function set_updated_at();

-- RLS ─────────────────────────────────────────────────────────────────────────
alter table privacy_requests enable row level security;
alter table consent_records enable row level security;

drop policy if exists privacy_requests_select on privacy_requests;
create policy privacy_requests_select on privacy_requests for select
  using (auth.uid() = user_id or is_admin());
-- Users may file for themselves; admins may file on behalf.
drop policy if exists privacy_requests_insert on privacy_requests;
create policy privacy_requests_insert on privacy_requests for insert
  with check (auth.uid() = user_id or is_admin());
-- Users may cancel their own; admins fulfill (any update).
drop policy if exists privacy_requests_update on privacy_requests;
create policy privacy_requests_update on privacy_requests for update
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- Consent: users read/append their own; admins read all.
drop policy if exists consent_records_select on consent_records;
create policy consent_records_select on consent_records for select
  using (auth.uid() = user_id or is_admin());
drop policy if exists consent_records_insert on consent_records;
create policy consent_records_insert on consent_records for insert
  with check (auth.uid() = user_id or is_admin());
