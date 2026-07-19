-- ─────────────────────────────────────────────────────────────────────────────
-- Corporate matching gifts — companies run matching programs; employees submit
-- match claims for their donations; the company approves and the platform tracks
-- the matched amount against a per-employee annual cap. Fully wired with RLS.
--
-- (Prior state: only a static employer-match estimator widget existed — no
--  persistence, programs, claims, or approvals.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── matching_programs ────────────────────────────────────────────────────────
create table if not exists matching_programs (
  id                uuid primary key default uuid_generate_v4(),
  sponsor_id        uuid not null references profiles(id) on delete cascade,
  company_name      text not null check (char_length(company_name) between 2 and 160),
  description       text,
  match_ratio       numeric(6,2) not null default 1.0 check (match_ratio > 0 and match_ratio <= 100),
  annual_cap_cents  bigint not null default 0 check (annual_cap_cents >= 0),
  min_donation_cents bigint not null default 0 check (min_donation_cents >= 0),
  categories        text[] not null default '{}',
  currency          text not null default 'USD',
  status            text not null default 'active'
                      check (status in ('active','paused','closed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists matching_programs_status_idx  on matching_programs(status);
create index if not exists matching_programs_sponsor_idx on matching_programs(sponsor_id);

-- ── matching_claims ──────────────────────────────────────────────────────────
create table if not exists matching_claims (
  id                    uuid primary key default uuid_generate_v4(),
  program_id            uuid not null references matching_programs(id) on delete cascade,
  employee_id           uuid not null references profiles(id) on delete cascade,
  campaign_id           uuid references campaigns(id) on delete set null,
  donation_id           uuid references donations(id) on delete set null,
  donation_amount_cents bigint not null check (donation_amount_cents > 0),
  match_amount_cents    bigint not null default 0 check (match_amount_cents >= 0),
  status                text not null default 'pending'
                          check (status in ('pending','approved','declined','paid')),
  note                  text,
  reviewer_id           uuid references profiles(id) on delete set null,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists matching_claims_program_idx  on matching_claims(program_id);
create index if not exists matching_claims_employee_idx on matching_claims(employee_id);
create index if not exists matching_claims_status_idx   on matching_claims(status);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists matching_programs_updated_at on matching_programs;
create trigger matching_programs_updated_at before update on matching_programs
  for each row execute function public.set_updated_at();

drop trigger if exists matching_claims_updated_at on matching_claims;
create trigger matching_claims_updated_at before update on matching_claims
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table matching_programs enable row level security;
alter table matching_claims   enable row level security;

-- programs: anyone may read listed (active/paused/closed) programs; sponsor/admin manage.
drop policy if exists matching_programs_public_read on matching_programs;
create policy matching_programs_public_read on matching_programs for select
  using (status in ('active','paused','closed') or auth.uid() = sponsor_id or is_admin());

drop policy if exists matching_programs_sponsor_write on matching_programs;
create policy matching_programs_sponsor_write on matching_programs for all
  using (auth.uid() = sponsor_id or is_admin())
  with check (auth.uid() = sponsor_id or is_admin());

-- claims: readable by the employee, the program sponsor, and admins.
drop policy if exists matching_claims_read on matching_claims;
create policy matching_claims_read on matching_claims for select
  using (
    auth.uid() = employee_id
    or is_admin()
    or exists (select 1 from matching_programs p where p.id = program_id and p.sponsor_id = auth.uid())
  );

drop policy if exists matching_claims_insert on matching_claims;
create policy matching_claims_insert on matching_claims for insert
  with check (auth.uid() = employee_id);

drop policy if exists matching_claims_update on matching_claims;
create policy matching_claims_update on matching_claims for update
  using (
    auth.uid() = employee_id
    or is_admin()
    or exists (select 1 from matching_programs p where p.id = program_id and p.sponsor_id = auth.uid())
  );
