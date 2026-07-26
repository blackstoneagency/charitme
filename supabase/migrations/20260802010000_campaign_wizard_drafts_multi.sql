-- =============================================================================
-- F8 — multiple in-flight campaign drafts per organizer
-- =============================================================================
-- `campaign_wizard_drafts` was one row per user (user_id as PK), so an organizer
-- running several campaigns could only ever have one draft in flight: starting a
-- second silently overwrote the first. This re-keys the table on a surrogate id
-- so a user can hold several named drafts and pick which to resume.
--
-- Existing rows are preserved — they simply gain a generated id and keep their
-- content, so anyone mid-draft when this ships continues uninterrupted.
--
-- RLS stays owner-scoped (this is user data): every policy already filters on
-- user_id, which is unchanged, so they keep working against the new key.
-- =============================================================================

-- 1. Surrogate key. Added first (nullable-with-default) so existing rows fill in.
alter table public.campaign_wizard_drafts
  add column if not exists id uuid not null default gen_random_uuid();

-- 2. Human label so a picker can distinguish drafts. Backfilled from the stored
--    form's title where one exists, otherwise left null and shown as "Untitled".
alter table public.campaign_wizard_drafts
  add column if not exists title text;

update public.campaign_wizard_drafts
   set title = nullif(trim(form->>'title'), '')
 where title is null;

-- 3. Re-key: drop the user_id primary key, promote id.
do $$
declare pk_name text;
begin
  select conname into pk_name
    from pg_constraint
   where conrelid = 'public.campaign_wizard_drafts'::regclass
     and contype = 'p';
  if pk_name is not null then
    execute format('alter table public.campaign_wizard_drafts drop constraint %I', pk_name);
  end if;
end $$;

-- Guard against a re-run leaving the table without a primary key.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaign_wizard_drafts'::regclass and contype = 'p'
  ) then
    alter table public.campaign_wizard_drafts add primary key (id);
  end if;
end $$;

-- 4. user_id is now a plain FK (many drafts per user) and needs its own index
--    for the "list my drafts, newest first" query.
create index if not exists idx_cwd_user_updated
  on public.campaign_wizard_drafts (user_id, updated_at desc);

-- RLS policies are unchanged: each already filters on `auth.uid() = user_id`,
-- which still holds now that user_id is non-unique. Re-asserted here so the
-- intent is visible alongside the re-key.
alter table public.campaign_wizard_drafts enable row level security;

-- =============================================================================
-- Rollback (manual, destructive — collapses each user to a single draft):
--   delete from public.campaign_wizard_drafts a using public.campaign_wizard_drafts b
--     where a.user_id = b.user_id and a.updated_at < b.updated_at;
--   alter table public.campaign_wizard_drafts drop constraint campaign_wizard_drafts_pkey;
--   alter table public.campaign_wizard_drafts add primary key (user_id);
--   alter table public.campaign_wizard_drafts drop column id, drop column title;
-- =============================================================================
