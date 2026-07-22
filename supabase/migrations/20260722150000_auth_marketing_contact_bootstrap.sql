-- Keep auth, profiles, and the marketing engine synchronized.
-- The trigger handles new users; the idempotent backfills repair users created
-- before the trigger or marketing tables were deployed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_roles jsonb;
  display_name text;
begin
  requested_roles := coalesce(new.raw_user_meta_data -> 'roles', '["donor"]'::jsonb);
  if jsonb_typeof(requested_roles) <> 'array' then
    requested_roles := '["donor"]'::jsonb;
  end if;

  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', '')
  );

  insert into public.profiles (id, email, full_name, avatar_url, roles)
  values (
    new.id,
    new.email,
    display_name,
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    requested_roles
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  if new.email is not null then
    update public.marketing_contacts
    set
      user_id = new.id,
      first_name = coalesce(first_name, display_name),
      last_active_at = now()
    where lower(email) = lower(new.email)
      and user_id is null;

    if not found then
      insert into public.marketing_contacts (
        user_id, email, first_name, client_type, lifecycle_stage, status
      )
      values (new.id, new.email, display_name, 'donor', 'subscriber', 'active')
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url, roles)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', '')),
  nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
  case
    when jsonb_typeof(coalesce(u.raw_user_meta_data -> 'roles', '["donor"]'::jsonb)) = 'array'
      then coalesce(u.raw_user_meta_data -> 'roles', '["donor"]'::jsonb)
    else '["donor"]'::jsonb
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into public.marketing_contacts (
  user_id, email, first_name, client_type, lifecycle_stage, status
)
select
  u.id,
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', '')),
  'donor',
  'subscriber',
  'active'
from auth.users u
where u.email is not null
  and not exists (
    select 1
    from public.marketing_contacts c
    where lower(c.email) = lower(u.email)
       or c.user_id = u.id
  )
on conflict do nothing;
