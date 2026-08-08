-- Reproduce columns and constraints that predate the migration ledger but are
-- already part of the production schema contract. Existing deployments are a
-- no-op; fresh provisions receive the exact production definitions.

create temporary table charitme_20260829000000_added_columns (
  table_name text not null,
  column_name text not null,
  primary key (table_name, column_name)
) on commit drop;

insert into charitme_20260829000000_added_columns (table_name, column_name)
select candidate.table_name, candidate.column_name
from (
  values
    ('ai_generations', 'result'),
    ('ai_generations', 'tokens_used'),
    ('audit_logs', 'ip_address'),
    ('audit_logs', 'user_agent'),
    ('campaign_media', 'alt_text'),
    ('campaign_media', 'caption'),
    ('campaign_media', 'sort_order'),
    ('campaign_reports', 'resolved_at'),
    ('campaign_reports', 'resolved_by'),
    ('campaign_updates', 'published_at'),
    ('campaign_updates', 'scheduled_at'),
    ('campaign_updates', 'updated_at'),
    ('campaigns', 'ai_generated'),
    ('campaigns', 'location'),
    ('campaigns', 'nonprofit_verified'),
    ('campaigns', 'thank_donors_sent_at'),
    ('campaigns', 'video_url'),
    ('connected_accounts', 'first_payout_hold_until'),
    ('donor_crm_contacts', 'donor_id'),
    ('donor_crm_contacts', 'notes'),
    ('membership_tiers', 'interval'),
    ('nonprofit_profiles', 'ein'),
    ('nonprofit_profiles', 'logo_url'),
    ('nonprofit_profiles', 'verified_at'),
    ('payouts', 'paid_at'),
    ('payouts', 'requested_at'),
    ('platform_settings', 'created_at'),
    ('recurring_donations', 'cancelled_at'),
    ('refunds', 'notes'),
    ('refunds', 'processed_at'),
    ('refunds', 'requested_by'),
    ('subscriptions', 'cancel_at_period_end'),
    ('subscriptions', 'current_period_start'),
    ('subscriptions', 'plan'),
    ('subscriptions', 'stripe_customer_id'),
    ('team_members', 'accepted_at'),
    ('team_members', 'invited_by'),
    ('trust_scores', 'activity_score'),
    ('trust_scores', 'computed_at'),
    ('trust_scores', 'identity_score'),
    ('trust_scores', 'story_score'),
    ('trust_scores', 'transparency_score'),
    ('verification_documents', 'doc_type'),
    ('verification_documents', 'is_public'),
    ('verification_documents', 'notes'),
    ('verification_documents', 'public_url'),
    ('verification_documents', 'verified'),
    ('verification_documents', 'verified_at'),
    ('verification_documents', 'verified_by')
) as candidate(table_name, column_name)
where to_regclass('public.' || quote_ident(candidate.table_name)) is not null
  and not exists (
    select 1
    from information_schema.columns existing
    where existing.table_schema = 'public'
      and existing.table_name = candidate.table_name
      and existing.column_name = candidate.column_name
  );

alter table if exists public.ai_generations
  add column if not exists result jsonb default '{}'::jsonb not null;
alter table if exists public.ai_generations
  add column if not exists tokens_used integer;

alter table if exists public.audit_logs
  add column if not exists ip_address text;
alter table if exists public.audit_logs
  add column if not exists user_agent text;

alter table if exists public.campaign_media
  add column if not exists alt_text text;
alter table if exists public.campaign_media
  add column if not exists caption text;
alter table if exists public.campaign_media
  add column if not exists sort_order integer default 0 not null;

alter table if exists public.campaign_reports
  add column if not exists resolved_at timestamp with time zone;
alter table if exists public.campaign_reports
  add column if not exists resolved_by uuid;

alter table if exists public.campaign_updates
  add column if not exists published_at timestamp with time zone;
alter table if exists public.campaign_updates
  add column if not exists scheduled_at timestamp with time zone;
alter table if exists public.campaign_updates
  add column if not exists updated_at timestamp with time zone default now() not null;

alter table if exists public.campaigns
  add column if not exists ai_generated boolean default false not null;
alter table if exists public.campaigns
  add column if not exists location text;
alter table if exists public.campaigns
  add column if not exists nonprofit_verified boolean default false not null;
alter table if exists public.campaigns
  add column if not exists thank_donors_sent_at timestamp with time zone;
alter table if exists public.campaigns
  add column if not exists video_url text;

alter table if exists public.connected_accounts
  add column if not exists first_payout_hold_until timestamp with time zone;

alter table if exists public.donor_crm_contacts
  add column if not exists donor_id uuid;
alter table if exists public.donor_crm_contacts
  add column if not exists notes text;

alter table if exists public.membership_tiers
  add column if not exists "interval" text default 'month'::text not null;

alter table if exists public.nonprofit_profiles
  add column if not exists ein text;
alter table if exists public.nonprofit_profiles
  add column if not exists logo_url text;
alter table if exists public.nonprofit_profiles
  add column if not exists verified_at timestamp with time zone;

alter table if exists public.payouts
  add column if not exists paid_at timestamp with time zone;
alter table if exists public.payouts
  add column if not exists requested_at timestamp with time zone default now() not null;

alter table if exists public.platform_settings
  add column if not exists created_at timestamp with time zone default now() not null;

alter table if exists public.recurring_donations
  add column if not exists cancelled_at timestamp with time zone;

alter table if exists public.refunds
  add column if not exists notes text;
alter table if exists public.refunds
  add column if not exists processed_at timestamp with time zone;
alter table if exists public.refunds
  add column if not exists requested_by uuid;

alter table if exists public.subscriptions
  add column if not exists cancel_at_period_end boolean default false not null;
alter table if exists public.subscriptions
  add column if not exists current_period_start timestamp with time zone;
alter table if exists public.subscriptions
  add column if not exists plan text;
alter table if exists public.subscriptions
  add column if not exists stripe_customer_id text;

alter table if exists public.team_members
  add column if not exists accepted_at timestamp with time zone;
alter table if exists public.team_members
  add column if not exists invited_by uuid;

alter table if exists public.trust_scores
  add column if not exists activity_score integer default 0 not null;
alter table if exists public.trust_scores
  add column if not exists computed_at timestamp with time zone default now() not null;
alter table if exists public.trust_scores
  add column if not exists identity_score integer default 0 not null;
alter table if exists public.trust_scores
  add column if not exists story_score integer default 0 not null;
alter table if exists public.trust_scores
  add column if not exists transparency_score integer default 0 not null;

alter table if exists public.verification_documents
  add column if not exists doc_type text;
alter table if exists public.verification_documents
  add column if not exists is_public boolean default false not null;
alter table if exists public.verification_documents
  add column if not exists notes text;
alter table if exists public.verification_documents
  add column if not exists public_url text;
alter table if exists public.verification_documents
  add column if not exists verified boolean default false not null;
alter table if exists public.verification_documents
  add column if not exists verified_at timestamp with time zone;
alter table if exists public.verification_documents
  add column if not exists verified_by uuid;

do $$
begin
  if to_regclass('public.subscriptions') is not null then
    update public.subscriptions
    set plan = case
      when lower(coalesce(tier, '')) in ('free', 'starter', 'pro', 'enterprise')
        then lower(tier)
      else 'free'
    end
    where plan is null;

    alter table public.subscriptions alter column plan set not null;
  end if;

  if to_regclass('public.verification_documents') is not null then
    update public.verification_documents
    set doc_type = case document_type
      when 'bank_statement' then 'financial'
      when 'nonprofit_ein' then 'nonprofit'
      when 'medical' then 'medical'
      when 'legal' then 'legal'
      else 'id'
    end
    where doc_type is null;

    alter table public.verification_documents alter column doc_type set not null;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.campaign_reports') is not null
    and not exists (select 1 from pg_constraint where conname = 'campaign_reports_resolved_by_fkey' and conrelid = 'public.campaign_reports'::regclass)
  then
    alter table public.campaign_reports
      add constraint campaign_reports_resolved_by_fkey
      foreign key (resolved_by) references public.profiles(id) on delete set null;
  end if;

  if to_regclass('public.donor_crm_contacts') is not null
    and not exists (select 1 from pg_constraint where conname = 'donor_crm_contacts_donor_id_fkey' and conrelid = 'public.donor_crm_contacts'::regclass)
  then
    alter table public.donor_crm_contacts
      add constraint donor_crm_contacts_donor_id_fkey
      foreign key (donor_id) references public.profiles(id) on delete set null;
  end if;

  if to_regclass('public.membership_tiers') is not null
    and not exists (select 1 from pg_constraint where conname = 'membership_tiers_interval_check' and conrelid = 'public.membership_tiers'::regclass)
  then
    alter table public.membership_tiers
      add constraint membership_tiers_interval_check
      check ("interval" = any (array['month'::text, 'year'::text]));
  end if;

  if to_regclass('public.nonprofit_profiles') is not null
    and not exists (select 1 from pg_constraint where conname = 'nonprofit_profiles_ein_key' and conrelid = 'public.nonprofit_profiles'::regclass)
  then
    alter table public.nonprofit_profiles
      add constraint nonprofit_profiles_ein_key unique (ein);
  end if;

  if to_regclass('public.refunds') is not null
    and not exists (select 1 from pg_constraint where conname = 'refunds_requested_by_fkey' and conrelid = 'public.refunds'::regclass)
  then
    alter table public.refunds
      add constraint refunds_requested_by_fkey
      foreign key (requested_by) references public.profiles(id) on delete set null;
  end if;

  if to_regclass('public.subscriptions') is not null
    and not exists (select 1 from pg_constraint where conname = 'subscriptions_plan_check' and conrelid = 'public.subscriptions'::regclass)
  then
    alter table public.subscriptions
      add constraint subscriptions_plan_check
      check (plan = any (array['free'::text, 'starter'::text, 'pro'::text, 'enterprise'::text]));
  end if;

  if to_regclass('public.team_members') is not null
    and not exists (select 1 from pg_constraint where conname = 'team_members_invited_by_fkey' and conrelid = 'public.team_members'::regclass)
  then
    alter table public.team_members
      add constraint team_members_invited_by_fkey
      foreign key (invited_by) references public.profiles(id) on delete set null;
  end if;

  if to_regclass('public.trust_scores') is not null
    and not exists (select 1 from pg_constraint where conname = 'trust_scores_activity_score_check' and conrelid = 'public.trust_scores'::regclass)
  then
    alter table public.trust_scores
      add constraint trust_scores_activity_score_check check (activity_score >= 0 and activity_score <= 25);
  end if;

  if to_regclass('public.trust_scores') is not null
    and not exists (select 1 from pg_constraint where conname = 'trust_scores_identity_score_check' and conrelid = 'public.trust_scores'::regclass)
  then
    alter table public.trust_scores
      add constraint trust_scores_identity_score_check check (identity_score >= 0 and identity_score <= 25);
  end if;

  if to_regclass('public.trust_scores') is not null
    and not exists (select 1 from pg_constraint where conname = 'trust_scores_story_score_check' and conrelid = 'public.trust_scores'::regclass)
  then
    alter table public.trust_scores
      add constraint trust_scores_story_score_check check (story_score >= 0 and story_score <= 25);
  end if;

  if to_regclass('public.trust_scores') is not null
    and not exists (select 1 from pg_constraint where conname = 'trust_scores_transparency_score_check' and conrelid = 'public.trust_scores'::regclass)
  then
    alter table public.trust_scores
      add constraint trust_scores_transparency_score_check check (transparency_score >= 0 and transparency_score <= 25);
  end if;

  if to_regclass('public.verification_documents') is not null
    and not exists (select 1 from pg_constraint where conname = 'verification_documents_doc_type_check' and conrelid = 'public.verification_documents'::regclass)
  then
    alter table public.verification_documents
      add constraint verification_documents_doc_type_check
      check (doc_type = any (array['id'::text, 'medical'::text, 'financial'::text, 'legal'::text, 'nonprofit'::text, 'other'::text]));
  end if;

  if to_regclass('public.verification_documents') is not null
    and not exists (select 1 from pg_constraint where conname = 'verification_documents_verified_by_fkey' and conrelid = 'public.verification_documents'::regclass)
  then
    alter table public.verification_documents
      add constraint verification_documents_verified_by_fkey
      foreign key (verified_by) references public.profiles(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_refunds_requested_by on public.refunds (requested_by);

do $$
declare
  added record;
begin
  for added in
    select table_name, column_name
    from charitme_20260829000000_added_columns
  loop
    execute format(
      'comment on column public.%I.%I is %L',
      added.table_name,
      added.column_name,
      'charitme:migration:20260829000000'
    );
  end loop;
end
$$;
