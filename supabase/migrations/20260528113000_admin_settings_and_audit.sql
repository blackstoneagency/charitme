create table if not exists platform_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on audit_logs(actor_id);
create index if not exists audit_logs_target_idx on audit_logs(target_type, target_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

alter table platform_settings enable row level security;
alter table audit_logs enable row level security;

drop policy if exists platform_settings_admin_all on platform_settings;
create policy platform_settings_admin_all on platform_settings
  for all using (is_admin()) with check (is_admin());

drop policy if exists audit_logs_admin_read on audit_logs;
create policy audit_logs_admin_read on audit_logs
  for select using (is_admin());

drop policy if exists audit_logs_admin_insert on audit_logs;
create policy audit_logs_admin_insert on audit_logs
  for insert with check (is_admin());
