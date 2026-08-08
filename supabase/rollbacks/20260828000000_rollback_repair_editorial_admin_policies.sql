-- Restore the legacy policy shape while preserving roles as the canonical data.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    alter table public.profiles
      add column role text
      generated always as (
        case
          when roles ? 'super_admin' then 'super_admin'
          when roles ? 'admin' then 'admin'
          else 'member'
        end
      ) stored;

    comment on column public.profiles.role is
      '20260823500000 replay compatibility projection; canonical roles remain in profiles.roles.';
  end if;
end
$$;

drop policy if exists cause_stories_admin_write on public.cause_stories;
create policy cause_stories_admin_write
  on public.cause_stories for all
  using (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  );

drop policy if exists cause_impact_stats_admin_write on public.cause_impact_stats;
create policy cause_impact_stats_admin_write
  on public.cause_impact_stats for all
  using (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  );

drop policy if exists platform_reports_admin_write on public.platform_reports;
create policy platform_reports_admin_write
  on public.platform_reports for all
  using (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "reports_admin_write" on storage.objects;
create policy "reports_admin_write"
  on storage.objects for all
  using (
    bucket_id = 'reports'
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  )
  with check (
    bucket_id = 'reports'
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role in ('admin', 'super_admin')
    )
  );
