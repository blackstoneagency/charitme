-- ─────────────────────────────────────────────────────────────────────────────
-- Message thread state — per-organizer read/archive tracking for donor
-- message threads shown on /dashboard/messages (Inbox / Unread / Archived tabs)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists message_thread_state (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  donor_id uuid not null references profiles(id) on delete cascade,
  archived boolean not null default false,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id, donor_id)
);

create index if not exists message_thread_state_owner_id_idx on message_thread_state(owner_id);

alter table message_thread_state enable row level security;

drop policy if exists message_thread_state_owner_all on message_thread_state;
create policy message_thread_state_owner_all on message_thread_state for all
  using (auth.uid() = owner_id or is_admin())
  with check (auth.uid() = owner_id or is_admin());
