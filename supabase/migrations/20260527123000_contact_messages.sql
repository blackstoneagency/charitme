create table if not exists contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewing','closed','spam')),
  source text not null default 'contact_page',
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

create policy contact_messages_insert_public on contact_messages
  for insert
  with check (true);

create policy contact_messages_admin_read on contact_messages
  for select
  using (is_admin());

create policy contact_messages_admin_update on contact_messages
  for update
  using (is_admin())
  with check (is_admin());

drop trigger if exists contact_messages_set_updated_at on contact_messages;
create trigger contact_messages_set_updated_at
  before update on contact_messages
  for each row execute function set_updated_at();
