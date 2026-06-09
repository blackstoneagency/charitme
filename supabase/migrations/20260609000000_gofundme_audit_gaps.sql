-- ─────────────────────────────────────────────────────────────────────────────
-- GoFundMe Parity Audit — Gap Remediation Migration
-- Date: 2026-06-09
-- Adds: accept_donations, deleted_at, visibility, UTM tracking, share_events,
--       donation_receipts, admin_notes, campaign_status_log, extended statuses
-- ─────────────────────────────────────────────────────────────────────────────

-- ── campaigns: accept_donations toggle ───────────────────────────────────────
alter table public.campaigns
  add column if not exists accept_donations boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','unlisted','private'));

-- Update public-read policy to exclude deleted campaigns and respect visibility
drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns for select using (
  (
    status = 'active'
    and visibility = 'public'
    and deleted_at is null
  )
  or auth.uid() = user_id
  or is_admin()
  or exists (
    select 1 from public.team_members tm
    where tm.campaign_id = id and tm.user_id = auth.uid()
  )
);

comment on column public.campaigns.accept_donations is
  'When false, the campaign page remains visible but the Donate button is hidden.';
comment on column public.campaigns.deleted_at is
  'Soft-delete timestamp. NULL = not deleted. Kept for compliance audit trail.';
comment on column public.campaigns.visibility is
  'public = discoverable; unlisted = only via direct link; private = organizer+team only';

-- ── donations: UTM / source attribution ──────────────────────────────────────
alter table public.donations
  add column if not exists source_utm jsonb not null default '{}'::jsonb;

comment on column public.donations.source_utm is
  'UTM parameters captured at donation time: {utm_source, utm_medium, utm_campaign, utm_content, referrer}';

-- ── refunds: extend status enum ──────────────────────────────────────────────
-- PostgreSQL CHECK constraints cannot be altered in-place; we must drop and recreate.
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check
  check (status in ('requested','under_review','approved','declined','processing','processed','failed','canceled'));

-- ── campaign_reports: extend status enum ─────────────────────────────────────
alter table public.campaign_reports drop constraint if exists campaign_reports_status_check;
alter table public.campaign_reports add constraint campaign_reports_status_check
  check (status in ('open','triaged','investigating','info_requested','action_taken','resolved','dismissed','escalated'));

-- ── share_events ─────────────────────────────────────────────────────────────
create table if not exists public.share_events (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  sharer_id    uuid references public.profiles(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  channel      text not null default 'link'
                 check (channel in ('link','email','sms','facebook','twitter','instagram','linkedin','whatsapp','qr','other')),
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  referrer     text,
  ip_hash      text,
  converted    boolean not null default false,
  donation_id  uuid references public.donations(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_share_events_campaign on public.share_events(campaign_id, created_at desc);
create index if not exists idx_share_events_sharer on public.share_events(sharer_id) where sharer_id is not null;
alter table public.share_events enable row level security;
create policy share_insert_any on public.share_events for insert with check (true);
create policy share_owner_read on public.share_events for select
  using (
    is_admin()
    or auth.uid() = sharer_id
    or exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.campaign_id = share_events.campaign_id and tm.user_id = auth.uid())
  );
grant all on public.share_events to anon, authenticated, service_role;

-- ── donation_receipts ─────────────────────────────────────────────────────────
create table if not exists public.donation_receipts (
  id              uuid primary key default uuid_generate_v4(),
  donation_id     uuid not null references public.donations(id) on delete cascade,
  donor_id        uuid references public.profiles(id) on delete set null,
  campaign_id     uuid references public.campaigns(id) on delete cascade,
  receipt_number  text not null unique default 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 8),
  amount_cents    bigint not null,
  tip_cents       bigint not null default 0,
  processing_fee_cents bigint not null default 0,
  currency        text not null default 'usd',
  is_tax_deductible boolean not null default false,
  nonprofit_ein   text,
  campaign_title  text not null,
  donor_name      text,
  donor_email     text,
  email_sent_at   timestamptz,
  resent_at       timestamptz,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  receipt_type    text not null default 'donation'
                    check (receipt_type in ('donation','recurring','refund','tip')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_receipts_donation on public.donation_receipts(donation_id);
create index if not exists idx_receipts_donor on public.donation_receipts(donor_id) where donor_id is not null;
create index if not exists idx_receipts_campaign on public.donation_receipts(campaign_id);
alter table public.donation_receipts enable row level security;
create policy receipts_own_read on public.donation_receipts for select
  using (auth.uid() = donor_id or is_admin()
         or exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid()));
create policy receipts_svc_insert on public.donation_receipts for insert with check (true);
create policy receipts_admin_update on public.donation_receipts for update using (is_admin());
grant all on public.donation_receipts to anon, authenticated, service_role;

-- ── admin_notes ───────────────────────────────────────────────────────────────
create table if not exists public.admin_notes (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('user','campaign','donation','payout','refund','dispute','support_case','report')),
  target_id   uuid not null,
  body        text not null,
  internal    boolean not null default true,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_admin_notes_target on public.admin_notes(target_type, target_id, created_at desc);
alter table public.admin_notes enable row level security;
create policy admin_notes_admin_all on public.admin_notes for all using (is_admin()) with check (is_admin());
grant all on public.admin_notes to anon, authenticated, service_role;

-- ── campaign_status_log ───────────────────────────────────────────────────────
create table if not exists public.campaign_status_log (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  changed_by  uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status   text not null,
  reason      text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_status_log_campaign on public.campaign_status_log(campaign_id, created_at desc);
alter table public.campaign_status_log enable row level security;
create policy status_log_owner_read on public.campaign_status_log for select
  using (is_admin() or exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid()));
create policy status_log_svc_insert on public.campaign_status_log for insert with check (true);
grant all on public.campaign_status_log to anon, authenticated, service_role;

-- ── nonprofit_profiles: add EIN verification status ──────────────────────────
alter table public.nonprofit_profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  add column if not exists tax_receipt_enabled boolean not null default false,
  add column if not exists country text not null default 'US',
  add column if not exists address text,
  add column if not exists public_profile_enabled boolean not null default true;

-- ── team_members: add invite token for co-organizer links ────────────────────
alter table public.team_members
  add column if not exists invite_token text unique default substr(md5(random()::text || clock_timestamp()::text), 1, 32),
  add column if not exists invite_email text,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists permissions jsonb not null default '{"post_updates":true,"thank_donors":true,"view_donors":true,"view_ledger":false,"manage_payout":false}'::jsonb;

comment on column public.team_members.permissions is
  'Fine-grained permission overrides for this team member beyond their role.';

-- ── Re-grant to PostgREST roles ───────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');
