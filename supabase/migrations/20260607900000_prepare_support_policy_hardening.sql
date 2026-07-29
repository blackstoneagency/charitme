-- The original support migration and production hardening reuse these policy names.
-- Only clean replays need the earlier definitions removed. Existing environments
-- may receive this older compatibility migration after hardening is already live.

do $$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260608000000'
  ) then
    drop policy if exists support_own_read on public.support_cases;
    drop policy if exists support_own_insert on public.support_cases;
  end if;
end
$$;
