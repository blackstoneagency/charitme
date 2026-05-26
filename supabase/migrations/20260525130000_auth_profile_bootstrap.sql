-- Create public profiles automatically for new Supabase Auth users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_roles jsonb;
begin
  requested_roles := coalesce(new.raw_user_meta_data -> 'roles', '["donor"]'::jsonb);

  if jsonb_typeof(requested_roles) <> 'array' then
    requested_roles := '["donor"]'::jsonb;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    roles
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    requested_roles
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy profiles_insert_self on profiles
  for insert
  with check (auth.uid() = id or public.is_admin());
