-- ── support_cases ─────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to enable the Support admin page.
create table if not exists public.support_cases (
  id           uuid primary key default uuid_generate_v4(),
  submitter_id uuid references profiles(id) on delete set null,
  subject      text not null,
  body         text,
  priority     text not null default 'normal'
                 check (priority in ('low','normal','high','urgent')),
  status       text not null default 'open'
                 check (status in ('open','in_progress','resolved','closed')),
  assigned_to  uuid references profiles(id) on delete set null,
  source       text not null default 'web'
                 check (source in ('web','email','api')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_support_cases_status     on support_cases(status);
create index if not exists idx_support_cases_priority   on support_cases(priority);
create index if not exists idx_support_cases_submitter  on support_cases(submitter_id);
create index if not exists idx_support_cases_created    on support_cases(created_at desc);

alter table support_cases enable row level security;

-- Admins can read/write all cases
do $$ begin
  if not exists (select 1 from pg_policies where tablename='support_cases' and policyname='support_admin_all') then
    create policy support_admin_all on support_cases for all using (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='support_cases' and policyname='support_own_read') then
    create policy support_own_read on support_cases for select using (auth.uid() = submitter_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='support_cases' and policyname='support_own_insert') then
    create policy support_own_insert on support_cases for insert with check (auth.uid() = submitter_id);
  end if;
end $$;

create trigger set_updated_at_support
  before update on support_cases
  for each row execute function set_updated_at();
