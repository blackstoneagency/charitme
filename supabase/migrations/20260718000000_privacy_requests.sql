-- ─────────────────────────────────────────────────────────────────────────────
-- Privacy request workflow (GDPR / CCPA) — data export + account deletion.
--
-- Users can request a data export (fulfilled immediately, self-serve) or account
-- deletion (queued for admin review + PII anonymization). Every request is an
-- auditable record. Fully wired with RLS.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists privacy_requests (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  type            text not null check (type in ('export','deletion')),
  status          text not null default 'pending'
                    check (status in ('pending','in_progress','completed','rejected','cancelled')),
  note            text,
  resolution_note text,
  resolver_id     uuid references profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists privacy_requests_user_idx   on privacy_requests(user_id);
create index if not exists privacy_requests_status_idx on privacy_requests(status);

-- At most one active (pending/in_progress) request per user per type.
create unique index if not exists privacy_requests_active_uniq
  on privacy_requests(user_id, type)
  where status in ('pending','in_progress');

drop trigger if exists privacy_requests_updated_at on privacy_requests;
create trigger privacy_requests_updated_at before update on privacy_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table privacy_requests enable row level security;

-- Users read/manage their own requests; admins read/resolve all.
drop policy if exists privacy_requests_read on privacy_requests;
create policy privacy_requests_read on privacy_requests for select
  using (auth.uid() = user_id or is_admin());

drop policy if exists privacy_requests_insert on privacy_requests;
create policy privacy_requests_insert on privacy_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists privacy_requests_update on privacy_requests;
create policy privacy_requests_update on privacy_requests for update
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());
