-- ─────────────────────────────────────────────────────────────────────────────
-- Fix the verification guard added in 20260806000000.
--
-- Two defects, both found by actually running the trigger against Postgres with
-- `auth.uid()` stubbed to NULL (the service-role condition) rather than by
-- reading the code:
--
--   RESULT: UPDATE SUCCEEDED
--   verified_by = NULL
--
-- 1. THREE-VALUED LOGIC. The condition was
--        if not (is_admin() or owner_id = auth.uid()) then raise
--    With auth.uid() NULL, `owner_id = auth.uid()` is NULL, so the expression is
--    `not (false or NULL)` = NULL. An IF only branches on TRUE, so the guard
--    silently did not fire. A guard written to be strict was permissive in the
--    one case it was never tested against.
--
-- 2. LOST ATTRIBUTION. It then stamped `verified_by := auth.uid()` = NULL, so a
--    verification carried out server-side recorded nobody as having done it —
--    on the exact records that get exported to an employer.
--
-- The fix makes the service-role path explicit instead of accidental. Every API
-- route in this codebase writes through `supabaseAdmin`, which bypasses RLS by
-- design and authorizes in the route; `auth.uid()` is NULL there. So that path
-- is allowed — but it must name the verifier, because "verified by nobody" is
-- not a verification. All boolean comparisons are coalesced so the guard can
-- only be TRUE or FALSE, never NULL.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function volunteer_hours_guard_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  actor    uuid;
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status = 'verified' then

    actor := auth.uid();

    select created_by into owner_id
      from volunteer_opportunities
     where id = new.opportunity_id;

    if actor is null then
      -- Server context (service role). RLS is bypassed here by design and the
      -- API route has already authorized the caller. Attribution is still
      -- mandatory: refuse an anonymous verification rather than record one.
      if new.verified_by is null then
        raise exception 'verified_by must be set when verifying volunteer hours from a server context'
          using errcode = 'check_violation';
      end if;
      new.verified_at := coalesce(new.verified_at, now());
    else
      -- End-user JWT. Only the opportunity owner or an admin may verify, and
      -- the attribution is stamped from the token so it cannot be forged.
      if not (coalesce(is_admin(), false) or coalesce(owner_id = actor, false)) then
        raise exception 'only the opportunity owner or an admin can verify volunteer hours'
          using errcode = 'check_violation';
      end if;
      new.verified_by := actor;
      new.verified_at := now();
    end if;
  end if;

  -- Leaving 'verified' clears the attribution so a rejected or reopened row
  -- never carries a stale verifier.
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status <> 'verified' then
    new.verified_by := null;
    new.verified_at := null;
  end if;

  return new;
end;
$$;
