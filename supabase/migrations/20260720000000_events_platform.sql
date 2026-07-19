-- ─────────────────────────────────────────────────────────────────────────────
-- Events product surface — extends the existing `fundraising_events` /
-- `event_tickets` / `event_registrations` data model (from the competitor-parity
-- migration) with the columns and check-in table needed for a self-serve,
-- organizer-owned events experience with free RSVP registration.
--
-- Additive + idempotent: safe on the live DB where the base tables already exist.
-- ─────────────────────────────────────────────────────────────────────────────

-- Organizer ownership + richer content on the existing events table.
alter table fundraising_events add column if not exists created_by  uuid references profiles(id) on delete set null;
alter table fundraising_events add column if not exists description  text;
alter table fundraising_events add column if not exists capacity     int;  -- null = unlimited
alter table fundraising_events add column if not exists cover_image_url text;

create index if not exists fundraising_events_created_by_idx on fundraising_events(created_by);
create index if not exists fundraising_events_status_starts_idx on fundraising_events(status, starts_at);

-- ── event_checkins ───────────────────────────────────────────────────────────
create table if not exists event_checkins (
  id              uuid primary key default uuid_generate_v4(),
  registration_id uuid not null unique references event_registrations(id) on delete cascade,
  event_id        uuid not null references fundraising_events(id) on delete cascade,
  checked_in_by   uuid references profiles(id) on delete set null,
  checked_in_at   timestamptz not null default now()
);

create index if not exists event_checkins_event_idx on event_checkins(event_id);

alter table event_checkins enable row level security;

-- Owner (event creator) + admin may read/write check-ins for their events.
drop policy if exists event_checkins_owner_all on event_checkins;
create policy event_checkins_owner_all on event_checkins for all
  using (
    is_admin()
    or exists (select 1 from fundraising_events e where e.id = event_id and e.created_by = auth.uid())
  )
  with check (
    is_admin()
    or exists (select 1 from fundraising_events e where e.id = event_id and e.created_by = auth.uid())
  );

-- ── Owner-scoped policies on the existing tables (additive; OR'd with existing) ──
-- Event creators can manage their own events (existing policy already allows public
-- read of published events + admin).
drop policy if exists fundraising_events_owner_write on fundraising_events;
create policy fundraising_events_owner_write on fundraising_events for all
  using (auth.uid() = created_by or is_admin())
  with check (auth.uid() = created_by or is_admin());

-- Registrations: the attendee, the event creator, and admins can read; attendees
-- create their own; the creator/admin can update (e.g. cancel).
drop policy if exists event_registrations_scoped_read on event_registrations;
create policy event_registrations_scoped_read on event_registrations for select
  using (
    auth.uid() = attendee_id
    or is_admin()
    or exists (select 1 from fundraising_events e where e.id = event_id and e.created_by = auth.uid())
  );

drop policy if exists event_registrations_attendee_insert on event_registrations;
create policy event_registrations_attendee_insert on event_registrations for insert
  with check (auth.uid() = attendee_id or is_admin());
