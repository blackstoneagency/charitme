-- ─────────────────────────────────────────────────────────────────────────────
-- Corporate giving: accounts, members, and matching-gift rules
--
-- Completes CHAR-0001. A company registers a corporate account (with an email
-- domain), invites/enrolls employees, and defines matching-gift rules (ratio +
-- per-gift / annual caps, optionally per category). Matching-gift claims can
-- then be resolved against these rules instead of the static estimator.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists corporate_accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email_domain text,                    -- e.g. 'acme.com'; used to auto-match employees
  admin_user_id uuid not null references profiles(id) on delete cascade,
  default_match_ratio numeric not null default 1 check (default_match_ratio >= 0),
  annual_cap_cents bigint check (annual_cap_cents is null or annual_cap_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_domain)
);

create index if not exists corporate_accounts_admin_idx on corporate_accounts(admin_user_id);

create table if not exists corporate_members (
  id uuid primary key default uuid_generate_v4(),
  corporate_id uuid not null references corporate_accounts(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'invited' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (corporate_id, email)
);

create index if not exists corporate_members_corporate_idx on corporate_members(corporate_id);
create index if not exists corporate_members_user_idx on corporate_members(user_id);

create table if not exists matching_gift_rules (
  id uuid primary key default uuid_generate_v4(),
  corporate_id uuid not null references corporate_accounts(id) on delete cascade,
  category text,                        -- null = applies to all categories
  ratio numeric not null default 1 check (ratio >= 0),
  per_gift_cap_cents bigint check (per_gift_cap_cents is null or per_gift_cap_cents >= 0),
  annual_cap_cents bigint check (annual_cap_cents is null or annual_cap_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matching_gift_rules_corporate_idx on matching_gift_rules(corporate_id);

-- Link a claim to the corporate account that will match it (optional).
alter table matching_gift_claims
  add column if not exists corporate_account_id uuid references corporate_accounts(id) on delete set null;

-- updated_at triggers ─────────────────────────────────────────────────────────
drop trigger if exists corporate_accounts_set_updated_at on corporate_accounts;
create trigger corporate_accounts_set_updated_at before update on corporate_accounts for each row execute function set_updated_at();
drop trigger if exists corporate_members_set_updated_at on corporate_members;
create trigger corporate_members_set_updated_at before update on corporate_members for each row execute function set_updated_at();
drop trigger if exists matching_gift_rules_set_updated_at on matching_gift_rules;
create trigger matching_gift_rules_set_updated_at before update on matching_gift_rules for each row execute function set_updated_at();

-- RLS ─────────────────────────────────────────────────────────────────────────
alter table corporate_accounts enable row level security;
alter table corporate_members enable row level security;
alter table matching_gift_rules enable row level security;

-- Accounts: the admin and enrolled members can read; only the admin (or platform
-- admin) writes.
drop policy if exists corporate_accounts_select on corporate_accounts;
create policy corporate_accounts_select on corporate_accounts for select
  using (
    auth.uid() = admin_user_id
    or is_admin()
    or exists (select 1 from corporate_members m where m.corporate_id = corporate_accounts.id and m.user_id = auth.uid())
  );
drop policy if exists corporate_accounts_write on corporate_accounts;
create policy corporate_accounts_write on corporate_accounts for all
  using (auth.uid() = admin_user_id or is_admin())
  with check (auth.uid() = admin_user_id or is_admin());

-- Members: the corporate admin manages; a member reads their own membership row.
drop policy if exists corporate_members_select on corporate_members;
create policy corporate_members_select on corporate_members for select
  using (
    auth.uid() = user_id
    or is_admin()
    or exists (select 1 from corporate_accounts a where a.id = corporate_members.corporate_id and a.admin_user_id = auth.uid())
  );
drop policy if exists corporate_members_write on corporate_members;
create policy corporate_members_write on corporate_members for all
  using (
    is_admin()
    or exists (select 1 from corporate_accounts a where a.id = corporate_members.corporate_id and a.admin_user_id = auth.uid())
  )
  with check (
    is_admin()
    or exists (select 1 from corporate_accounts a where a.id = corporate_members.corporate_id and a.admin_user_id = auth.uid())
  );

-- Rules: readable by admin + enrolled members (to see match terms); writable by
-- the corporate admin.
drop policy if exists matching_gift_rules_select on matching_gift_rules;
create policy matching_gift_rules_select on matching_gift_rules for select
  using (
    is_admin()
    or exists (select 1 from corporate_accounts a where a.id = matching_gift_rules.corporate_id and a.admin_user_id = auth.uid())
    or exists (select 1 from corporate_members m where m.corporate_id = matching_gift_rules.corporate_id and m.user_id = auth.uid())
  );
drop policy if exists matching_gift_rules_write on matching_gift_rules;
create policy matching_gift_rules_write on matching_gift_rules for all
  using (
    is_admin()
    or exists (select 1 from corporate_accounts a where a.id = matching_gift_rules.corporate_id and a.admin_user_id = auth.uid())
  )
  with check (
    is_admin()
    or exists (select 1 from corporate_accounts a where a.id = matching_gift_rules.corporate_id and a.admin_user_id = auth.uid())
  );
