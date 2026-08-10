revoke select on table public.volunteer_shifts from anon, authenticated;

grant select (
  id,
  opportunity_id,
  title,
  starts_at,
  ends_at,
  location,
  is_remote,
  capacity,
  filled_count,
  notes,
  status,
  created_by,
  created_at,
  updated_at,
  deleted_at
) on table public.volunteer_shifts to anon, authenticated;

comment on column public.volunteer_shifts.checkin_code is
  'Organizer-only attendance code. Browser roles have no SELECT privilege; server routes enforce ownership before reading it.';
