-- ─────────────────────────────────────────────────────────────────────────────
-- CHAR-1102 — Volunteer shifts, check-in/out and verified hours.
--
-- Builds on 20260719010000_volunteers.sql (opportunities / profiles /
-- applications). An opportunity says "we need help"; a SHIFT is a specific
-- block of time a volunteer can actually show up for, and an HOURS row is the
-- record of them having done so.
--
-- The integrity requirement that shapes this file: hours are exported to
-- employers for corporate volunteer-matching programs, so "verified" has to
-- mean something. A volunteer must not be able to verify their own hours. That
-- is enforced by a trigger below rather than by convention in the API, because
-- RLS alone cannot restrict *which columns* a permitted writer may change.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists volunteer_shifts (
  id               uuid primary key default uuid_generate_v4(),
  opportunity_id   uuid not null references volunteer_opportunities(id) on delete cascade,
  title            text not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  location         text,
  is_remote        boolean not null default false,
  -- null = unlimited, matching volunteer_opportunities.slots
  capacity         integer,
  filled_count     integer not null default 0,
  notes            text,
  -- Rotating per-shift code backing QR check-in. Not a secret in the
  -- cryptographic sense — it only proves presence at a shift, and it is scoped
  -- to one shift — but it is unique so a scan resolves to exactly one shift.
  checkin_code     text unique,
  status           text not null default 'scheduled'
                     check (status in ('scheduled','cancelled','completed')),
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint volunteer_shifts_time_order check (ends_at > starts_at),
  constraint volunteer_shifts_capacity_nonneg check (capacity is null or capacity >= 0),
  constraint volunteer_shifts_filled_nonneg check (filled_count >= 0)
);

create index if not exists vol_shift_opp_idx    on volunteer_shifts(opportunity_id) where deleted_at is null;
create index if not exists vol_shift_starts_idx on volunteer_shifts(starts_at) where deleted_at is null;

create table if not exists volunteer_hours (
  id               uuid primary key default uuid_generate_v4(),
  -- Nullable: hours can be logged against an opportunity without a scheduled
  -- shift (ad-hoc help), which is why opportunity_id is the required link.
  shift_id         uuid references volunteer_shifts(id) on delete set null,
  opportunity_id   uuid not null references volunteer_opportunities(id) on delete cascade,
  volunteer_user_id uuid not null references profiles(id) on delete cascade,
  checked_in_at    timestamptz,
  checked_out_at   timestamptz,
  -- Stored rather than always derived: a manual entry has no check-in pair, and
  -- an organizer may adjust a figure after the fact. Kept consistent with the
  -- timestamps by the application layer, which is the only writer of both.
  hours            numeric(7,2) not null default 0,
  source           text not null default 'manual'
                     check (source in ('manual','check_in')),
  status           text not null default 'pending'
                     check (status in ('pending','verified','rejected')),
  verified_by      uuid references profiles(id) on delete set null,
  verified_at      timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint volunteer_hours_nonneg check (hours >= 0),
  constraint volunteer_hours_time_order
    check (checked_out_at is null or checked_in_at is null or checked_out_at >= checked_in_at)
);

create index if not exists vol_hours_volunteer_idx on volunteer_hours(volunteer_user_id) where deleted_at is null;
create index if not exists vol_hours_opp_idx       on volunteer_hours(opportunity_id) where deleted_at is null;
create index if not exists vol_hours_shift_idx     on volunteer_hours(shift_id) where deleted_at is null;
-- Corporate export reads verified hours for a person across a date range.
create index if not exists vol_hours_verified_idx
  on volunteer_hours(volunteer_user_id, status, checked_in_at) where deleted_at is null;

-- One open check-in per volunteer per shift: scanning twice must not start a
-- second clock. Partial unique index so completed rows are unconstrained.
create unique index if not exists vol_hours_one_open_checkin
  on volunteer_hours(volunteer_user_id, shift_id)
  where checked_out_at is null and deleted_at is null and shift_id is not null;

-- ── Integrity: only the opportunity owner or an admin may verify hours ───────
--
-- Without this, a volunteer with ordinary RLS write access to their own row
-- could set status='verified' and export self-certified hours to an employer.
-- RLS decides WHO may write the row; this decides WHAT they may change.
create or replace function volunteer_hours_guard_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status = 'verified' then

    select created_by into owner_id
      from volunteer_opportunities
     where id = new.opportunity_id;

    if not (is_admin() or owner_id = auth.uid()) then
      raise exception 'only the opportunity owner or an admin can verify volunteer hours'
        using errcode = 'check_violation';
    end if;

    -- Stamp the attribution here so it cannot be forged by the caller.
    new.verified_by := auth.uid();
    new.verified_at := now();
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'verified' then
    new.verified_by := null;
    new.verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists volunteer_hours_verify_guard on volunteer_hours;
create trigger volunteer_hours_verify_guard
  before update on volunteer_hours
  for each row execute function volunteer_hours_guard_verification();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table volunteer_shifts enable row level security;
alter table volunteer_hours  enable row level security;

-- Shifts are public in the same sense opportunities are: a volunteer has to be
-- able to see what they can sign up for before applying.
drop policy if exists vol_shift_public_read on volunteer_shifts;
create policy vol_shift_public_read on volunteer_shifts for select
  using (
    deleted_at is null
    and status = 'scheduled'
    and exists (
      select 1 from volunteer_opportunities o
       where o.id = opportunity_id
         and o.deleted_at is null
         and o.status in ('open','upcoming')
    )
  );

drop policy if exists vol_shift_owner on volunteer_shifts;
create policy vol_shift_owner on volunteer_shifts for all
  using (
    is_admin() or exists (
      select 1 from volunteer_opportunities o
       where o.id = opportunity_id and o.created_by = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from volunteer_opportunities o
       where o.id = opportunity_id and o.created_by = auth.uid()
    )
  );

-- Hours: the volunteer owns their record; the organizer running the
-- opportunity can see and verify them. No public read — hours are personal
-- participation data, not marketing material.
drop policy if exists vol_hours_volunteer on volunteer_hours;
create policy vol_hours_volunteer on volunteer_hours for all
  using (volunteer_user_id = auth.uid() or is_admin())
  with check (volunteer_user_id = auth.uid() or is_admin());

drop policy if exists vol_hours_organizer on volunteer_hours;
create policy vol_hours_organizer on volunteer_hours for all
  using (
    is_admin() or exists (
      select 1 from volunteer_opportunities o
       where o.id = opportunity_id and o.created_by = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from volunteer_opportunities o
       where o.id = opportunity_id and o.created_by = auth.uid()
    )
  );
