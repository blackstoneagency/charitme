-- =============================================================================
-- Campaign wizard drafts — cross-device resume for the /create journey
-- =============================================================================
-- The guided builder autosaves in-progress state to localStorage, which is
-- instant and offline-safe but strictly device-local: a signed-in organizer who
-- starts on their phone and finishes on a laptop lost everything. The wizard
-- already requires sign-in at the Location step, so from that point on we know
-- who the user is and can durably persist their work.
--
-- One row per user (the wizard is single-draft by design) holding the same
-- payload shape the localStorage draft uses, so the two are interchangeable and
-- the newer of the pair wins on restore.
--
-- RLS: this is USER data, not admin data — so unlike the marketing_* tables this
-- gets real owner-scoped policies and the app reads/writes it with the
-- anon+cookies server client. A user can only ever see or touch their own row.
-- =============================================================================

create table if not exists public.campaign_wizard_drafts (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  step        text not null default 'type',
  story_mode  text not null default 'guided',
  form        jsonb not null default '{}'::jsonb,
  images      jsonb not null default '[]'::jsonb,
  client_ts   bigint not null default 0,      -- draft timestamp from the client, for newest-wins merge
  updated_at  timestamptz not null default now(),
  constraint campaign_wizard_drafts_form_is_object check (jsonb_typeof(form) = 'object'),
  constraint campaign_wizard_drafts_images_is_array check (jsonb_typeof(images) = 'array')
);

create index if not exists idx_cwd_updated on public.campaign_wizard_drafts (updated_at desc);

create or replace function public.campaign_wizard_drafts_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists campaign_wizard_drafts_touch on public.campaign_wizard_drafts;
create trigger campaign_wizard_drafts_touch
  before update on public.campaign_wizard_drafts
  for each row execute function public.campaign_wizard_drafts_touch();

alter table public.campaign_wizard_drafts enable row level security;

-- Owner-only access. Service role still bypasses RLS for support/admin tooling.
drop policy if exists cwd_select_own on public.campaign_wizard_drafts;
create policy cwd_select_own on public.campaign_wizard_drafts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists cwd_insert_own on public.campaign_wizard_drafts;
create policy cwd_insert_own on public.campaign_wizard_drafts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists cwd_update_own on public.campaign_wizard_drafts;
create policy cwd_update_own on public.campaign_wizard_drafts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cwd_delete_own on public.campaign_wizard_drafts;
create policy cwd_delete_own on public.campaign_wizard_drafts
  for delete to authenticated using (auth.uid() = user_id);

-- =============================================================================
-- Rollback (manual): drop table public.campaign_wizard_drafts cascade;
-- =============================================================================
