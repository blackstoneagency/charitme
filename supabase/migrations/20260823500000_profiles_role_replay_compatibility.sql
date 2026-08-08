-- Historical editorial migrations reference profiles.role. The canonical role
-- contract is profiles.roles (jsonb), so expose a generated compatibility value
-- before those migrations run without changing already-published migration files.

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
