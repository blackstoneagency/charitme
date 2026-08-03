-- Rollback for 20260806010000 — RESTORES THE PREVIOUS FUNCTION BODY.
--
-- ⚠️ Generated, not written. The inverse of `create or replace function` is
-- the previous definition, and a near-miss compiles fine and behaves
-- differently. This body came from `pg_get_functiondef()` on a database
-- replayed to the migration immediately before 20260806010000, and
-- `scripts/generate-function-rollback.sh` re-derives and byte-compares it.
--
-- Regenerate:  ./scripts/generate-function-rollback.sh 20260806010000 volunteer_hours_guard_verification

-- Drop the signatures the target migration leaves behind, so a changed
-- parameter list cannot leave two overloads resolvable.
drop function if exists public.volunteer_hours_guard_verification() cascade;

CREATE OR REPLACE FUNCTION public.volunteer_hours_guard_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- Triggers that called these functions. The drops above cascade them
-- away, so restoring the body alone would silently remove the guard.
CREATE TRIGGER volunteer_hours_verify_guard BEFORE UPDATE ON public.volunteer_hours FOR EACH ROW EXECUTE FUNCTION volunteer_hours_guard_verification();
