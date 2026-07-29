\set ON_ERROR_STOP on

begin;

do $$
begin
  if has_table_privilege('anon', 'public.team_members', 'select')
    or has_table_privilege('anon', 'public.team_members', 'insert')
    or has_table_privilege('authenticated', 'public.team_members', 'insert')
    or has_table_privilege('authenticated', 'public.team_members', 'update')
    or has_table_privilege('authenticated', 'public.team_members', 'delete')
  then
    raise exception 'browser roles still have team membership mutation privileges';
  end if;
end
$$;

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  target_campaign_id uuid;
begin
  select id
  into target_campaign_id
  from public.campaigns
  where user_id <> auth.uid()
  order by id
  limit 1;

  begin
    insert into public.team_members (campaign_id, user_id, role)
    values (target_campaign_id, auth.uid(), 'admin');
    raise exception 'self-enrollment unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;

update public.profiles
set roles = '["donor","super_admin"]'::jsonb
where id = '10000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  if not public.is_admin() then
    raise exception 'super_admin does not inherit admin RLS access';
  end if;
end
$$;

reset role;
rollback;
