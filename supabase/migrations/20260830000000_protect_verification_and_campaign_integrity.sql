create or replace function public.protect_nonprofit_verification_fields()
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
    if new.verified is distinct from false
      or new.verification_status is distinct from 'unverified'
      or new.tax_receipt_enabled is distinct from false
      or new.verified_at is not null
    then
      raise insufficient_privilege using
        message = 'Nonprofit verification fields may only be changed by the service role';
    end if;
  elsif new.verified is distinct from old.verified
    or new.verification_status is distinct from old.verification_status
    or new.tax_receipt_enabled is distinct from old.tax_receipt_enabled
    or new.verified_at is distinct from old.verified_at
  then
    raise insufficient_privilege using
      message = 'Nonprofit verification fields may only be changed by the service role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_nonprofit_verification_fields on public.nonprofit_profiles;
create trigger protect_nonprofit_verification_fields
  before insert or update on public.nonprofit_profiles
  for each row execute function public.protect_nonprofit_verification_fields();

create or replace function public.protect_verification_document_fields()
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
    if new.status is distinct from 'pending'
      or new.verified is distinct from false
      or new.verified_at is not null
      or new.verified_by is not null
      or new.is_public is distinct from false
      or new.public_url is not null
    then
      raise insufficient_privilege using
        message = 'Document verification fields may only be changed by the service role';
    end if;
  elsif new.status is distinct from old.status
    or new.verified is distinct from old.verified
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.is_public is distinct from old.is_public
    or new.public_url is distinct from old.public_url
  then
    raise insufficient_privilege using
      message = 'Document verification fields may only be changed by the service role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_verification_document_fields on public.verification_documents;
create trigger protect_verification_document_fields
  before insert or update on public.verification_documents
  for each row execute function public.protect_verification_document_fields();

create or replace function public.protect_campaign_integrity_fields()
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
    if new.raised_amount is distinct from 0
      or new.backer_count is distinct from 0
      or new.status is distinct from 'draft'
      or new.trust_status is distinct from 'Needs More Info'
      or new.campaign_health_score is distinct from 0
      or new.payout_frozen is distinct from false
      or new.featured is distinct from false
      or new.pinned is distinct from false
      or new.nonprofit_verified is distinct from false
      or new.deleted_at is not null
    then
      raise insufficient_privilege using
        message = 'Campaign integrity fields may only be changed by the service role';
    end if;
  elsif new.user_id is distinct from old.user_id
    or new.raised_amount is distinct from old.raised_amount
    or new.backer_count is distinct from old.backer_count
    or new.status is distinct from old.status
    or new.trust_status is distinct from old.trust_status
    or new.campaign_health_score is distinct from old.campaign_health_score
    or new.payout_frozen is distinct from old.payout_frozen
    or new.featured is distinct from old.featured
    or new.pinned is distinct from old.pinned
    or new.nonprofit_verified is distinct from old.nonprofit_verified
    or new.deleted_at is distinct from old.deleted_at
  then
    raise insufficient_privilege using
      message = 'Campaign integrity fields may only be changed by the service role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_campaign_integrity_fields on public.campaigns;
create trigger protect_campaign_integrity_fields
  before insert or update on public.campaigns
  for each row execute function public.protect_campaign_integrity_fields();
