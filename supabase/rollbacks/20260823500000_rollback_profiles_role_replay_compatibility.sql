-- Run only after rolling back migrations that depend on profiles.role.

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
