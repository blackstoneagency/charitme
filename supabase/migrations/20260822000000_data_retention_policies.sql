-- Data retention policies (design #172).
--
-- Configuration for how long each category of non-financial data is kept, plus
-- an explicit per-category opt-in before anything is actually deleted.
--
-- ⚠️ THE SAFETY MODEL IS THE POINT OF THIS TABLE, so it is stated here rather
-- than only in the route:
--
--   1. `auto_delete` defaults to FALSE. With it off the retention job REPORTS
--      what is past its window and deletes nothing. A scheduled job that
--      destroys production data on the strength of a config screen someone
--      clicked through is not a feature, and the damage is unrecoverable.
--   2. Financial and identity records are NOT eligible. Donations, refunds,
--      ledger entries, tax receipts and verification documents carry legal
--      retention requirements that outlast any preference set here, so the
--      category list is a closed allowlist in lib/retention.ts — not free text,
--      and not "every table".
--   3. Deleting is the only irreversible thing in this feature, so it is the
--      one thing that requires a second, explicit action.

create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  -- Matches a key in RETENTION_CATEGORIES (lib/retention.ts). Unique so the
  -- admin screen cannot create two conflicting rules for one category — with
  -- two rows, which window applied would depend on row order.
  category text not null unique,
  retention_days integer not null check (retention_days between 1 and 3650),
  auto_delete boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every run is recorded, deletions and dry runs alike. A retention job with no
-- audit trail cannot answer the only question anyone asks after the fact:
-- "what happened to that record?"
create table if not exists public.data_retention_runs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  cutoff_at timestamptz not null,
  matched_count integer not null default 0,
  deleted_count integer not null default 0,
  dry_run boolean not null default true,
  error text,
  ran_at timestamptz not null default now()
);

create index if not exists data_retention_runs_ran_at_idx
  on public.data_retention_runs (ran_at desc);

alter table public.data_retention_policies enable row level security;
alter table public.data_retention_runs enable row level security;

-- Admin-only both ways: retention settings describe how long the platform keeps
-- user data, which is a compliance disclosure, not public configuration.
drop policy if exists retention_policies_admin_all on public.data_retention_policies;
create policy retention_policies_admin_all on public.data_retention_policies
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists retention_runs_admin_all on public.data_retention_runs;
create policy retention_runs_admin_all on public.data_retention_runs
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists data_retention_policies_touch on public.data_retention_policies;
create trigger data_retention_policies_touch before update on public.data_retention_policies
  for each row execute function public.set_updated_at();
