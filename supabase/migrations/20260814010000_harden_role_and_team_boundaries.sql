create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (roles ? 'admin' or roles ? 'super_admin')
  );
$$;

update public.profiles
set roles = roles || to_jsonb('admin'::text)
where roles ? 'super_admin'
  and not (roles ? 'admin');

drop policy if exists team_members_admin_owner_write on public.team_members;
drop policy if exists team_members_visible_to_team on public.team_members;
drop policy if exists team_members_read_own on public.team_members;

create policy team_members_read_own
on public.team_members
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

revoke all on table public.team_members from anon;
revoke insert, update, delete, truncate, references, trigger
on table public.team_members
from authenticated;
grant select on table public.team_members to authenticated;
grant all on table public.team_members to service_role;
