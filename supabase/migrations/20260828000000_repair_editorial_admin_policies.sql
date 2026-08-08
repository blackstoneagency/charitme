-- Replace legacy profiles.role policy checks with the hardened SECURITY DEFINER
-- admin predicate used by the rest of the platform.

drop policy if exists cause_stories_admin_write on public.cause_stories;
create policy cause_stories_admin_write
  on public.cause_stories for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists cause_impact_stats_admin_write on public.cause_impact_stats;
create policy cause_impact_stats_admin_write
  on public.cause_impact_stats for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists platform_reports_admin_write on public.platform_reports;
create policy platform_reports_admin_write
  on public.platform_reports for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "reports_admin_write" on storage.objects;
create policy "reports_admin_write"
  on storage.objects for all
  using (bucket_id = 'reports' and public.is_admin())
  with check (bucket_id = 'reports' and public.is_admin());

-- Remove only the generated compatibility column created by the replay bridge.
-- A pre-existing role column in a deployed database is left untouched.
do $$
declare
  compatibility_comment text;
begin
  select col_description('public.profiles'::regclass, attribute.attnum)
  into compatibility_comment
  from pg_attribute attribute
  where attribute.attrelid = 'public.profiles'::regclass
    and attribute.attname = 'role'
    and not attribute.attisdropped;

  if compatibility_comment =
    '20260823500000 replay compatibility projection; canonical roles remain in profiles.roles.'
  then
    alter table public.profiles drop column role;
  end if;
end
$$;
