-- Close browser-accessible privilege escalation and financial mutation paths.

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.roles is distinct from '["donor"]'::jsonb
      or new.identity_verified is distinct from false
      or new.trust_passport_score is distinct from 0
      or coalesce(new.plan, 'free') <> 'free'
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
      or new.email is distinct from nullif(auth.jwt() ->> 'email', '')
    then
      raise insufficient_privilege using
        message = 'Privileged profile fields may only be changed by the service role';
    end if;
  elsif new.roles is distinct from old.roles
    or new.identity_verified is distinct from old.identity_verified
    or new.trust_passport_score is distinct from old.trust_passport_score
    or new.plan is distinct from old.plan
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.email is distinct from old.email
  then
    raise insufficient_privilege using
      message = 'Privileged profile fields may only be changed by the service role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  display_name text;
begin
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
    '["donor"]'::jsonb
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

    insert into public.marketing_identities (contact_id, kind, value)
    select c.id, 'email', lower(new.email)
    from public.marketing_contacts c
    where lower(c.email) = lower(new.email)
    order by c.created_at
    limit 1
    on conflict (kind, value) do nothing;

    insert into public.marketing_identities (contact_id, kind, value)
    select c.id, 'user_id', new.id::text
    from public.marketing_contacts c
    where c.user_id = new.id
    order by c.created_at
    limit 1
    on conflict (kind, value) do nothing;
  end if;

  return new;
end;
$$;

drop policy if exists donations_insert_service on public.donations;
drop policy if exists donor_tips_insert_service on public.donor_tips;
drop policy if exists platform_fees_insert_service on public.platform_fees;
drop policy if exists reports_insert_public on public.campaign_reports;

revoke insert on table public.donations from public, anon, authenticated;
revoke insert on table public.donor_tips from public, anon, authenticated;
revoke insert on table public.platform_fees from public, anon, authenticated;
revoke insert on table public.campaign_reports from public, anon, authenticated;

grant insert on table public.donations to service_role;
grant insert on table public.donor_tips to service_role;
grant insert on table public.platform_fees to service_role;
grant insert on table public.campaign_reports to service_role;

revoke create on schema public from public, anon, authenticated;

alter table public.donations
  add column if not exists tip_cents bigint not null default 0;
alter table public.donations
  add column if not exists processing_fee_cents bigint not null default 0;

alter function public.record_donation(text, uuid, uuid, bigint, bigint, bigint, text, boolean, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.increment_campaign_stats(uuid, bigint)
  set search_path = pg_catalog, public, pg_temp;
alter function public.decrement_campaign_stats(uuid, bigint)
  set search_path = pg_catalog, public, pg_temp;
alter function public.claim_campaign_reward(uuid)
  set search_path = pg_catalog, public, pg_temp;
alter function public.get_admin_system_resource_usage()
  set search_path = pg_catalog, public, pg_temp;

revoke all on function public.record_donation(text, uuid, uuid, bigint, bigint, bigint, text, boolean, text, text)
  from public, anon, authenticated;
revoke all on function public.increment_campaign_stats(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.decrement_campaign_stats(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.claim_campaign_reward(uuid)
  from public, anon, authenticated;
revoke all on function public.get_admin_system_resource_usage()
  from public, anon, authenticated;

grant execute on function public.record_donation(text, uuid, uuid, bigint, bigint, bigint, text, boolean, text, text)
  to service_role;
grant execute on function public.increment_campaign_stats(uuid, bigint)
  to service_role;
grant execute on function public.decrement_campaign_stats(uuid, bigint)
  to service_role;
grant execute on function public.claim_campaign_reward(uuid)
  to service_role;
grant execute on function public.get_admin_system_resource_usage()
  to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'donations_amount_cents_positive'
      and conrelid = 'public.donations'::regclass
  ) then
    alter table public.donations
      add constraint donations_amount_cents_positive
      check (amount_cents > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'donations_fee_cents_nonnegative'
      and conrelid = 'public.donations'::regclass
  ) then
    alter table public.donations
      add constraint donations_fee_cents_nonnegative
      check (tip_cents >= 0 and processing_fee_cents >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'donor_tips_amount_cents_positive'
      and conrelid = 'public.donor_tips'::regclass
  ) then
    alter table public.donor_tips
      add constraint donor_tips_amount_cents_positive
      check (amount_cents > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_fees_amount_cents_nonnegative'
      and conrelid = 'public.platform_fees'::regclass
  ) then
    alter table public.platform_fees
      add constraint platform_fees_amount_cents_nonnegative
      check (amount_cents >= 0) not valid;
  end if;
end;
$$;
