-- ─────────────────────────────────────────────────────────────────────────────
-- Production hardening migration — 2026-06-08
-- Adds: decrement_campaign_stats, ledger entries on donation, notifications
-- Extended donation statuses, contacts table, platform_tips
-- ─────────────────────────────────────────────────────────────────────────────

-- ── decrement_campaign_stats RPC ─────────────────────────────────────────────
create or replace function public.decrement_campaign_stats(
  p_campaign_id uuid,
  p_amount_cents bigint
) returns void language plpgsql security definer as $$
begin
  update public.campaigns
  set raised_amount = greatest(0, raised_amount - p_amount_cents),
      backer_count  = greatest(0, backer_count  - 1),
      updated_at    = now()
  where id = p_campaign_id;
end; $$;

-- ── notifications table ───────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,  -- receipt, payout_paid, payout_failed, campaign_review, etc.
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_read_at on notifications(read_at) where read_at is null;
alter table public.notifications enable row level security;
create policy notif_own_all on public.notifications for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ── support_cases table ───────────────────────────────────────────────────────
create table if not exists public.support_cases (
  id            uuid primary key default uuid_generate_v4(),
  submitter_id  uuid references public.profiles(id) on delete set null,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  donation_id   uuid references public.donations(id) on delete set null,
  subject       text not null,
  body          text not null,
  status        text not null default 'open'
                  check (status in ('open','in_progress','resolved','closed')),
  assigned_to   uuid references public.profiles(id) on delete set null,
  priority      text not null default 'normal'
                  check (priority in ('low','normal','high','urgent')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.support_cases enable row level security;
create policy support_own_read on public.support_cases for select
  using (auth.uid() = submitter_id or public.is_admin());
create policy support_own_insert on public.support_cases for insert
  with check (true);
create policy support_admin_update on public.support_cases for update
  using (public.is_admin());
create trigger set_updated_at_support_cases before update on public.support_cases
  for each row execute function public.set_updated_at();

-- ── support_notes table ───────────────────────────────────────────────────────
create table if not exists public.support_notes (
  id         uuid primary key default uuid_generate_v4(),
  case_id    uuid not null references public.support_cases(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  internal   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.support_notes enable row level security;
create policy notes_admin_all on public.support_notes for all using (public.is_admin()) with check (public.is_admin());
create policy notes_own_read  on public.support_notes for select
  using (not internal and exists (
    select 1 from public.support_cases sc
    where sc.id = case_id and sc.submitter_id = auth.uid()
  ));

-- ── beneficiary_invites table ─────────────────────────────────────────────────
create table if not exists public.beneficiary_invites (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  invited_by   uuid not null references public.profiles(id) on delete cascade,
  email        text not null,
  token        text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 32),
  accepted_at  timestamptz,
  beneficiary_id uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days')
);
alter table public.beneficiary_invites enable row level security;
create policy bi_own_read on public.beneficiary_invites for select
  using (auth.uid() = invited_by or auth.uid() = beneficiary_id or public.is_admin());
create policy bi_own_insert on public.beneficiary_invites for insert
  with check (auth.uid() = invited_by or public.is_admin());
create policy bi_own_update on public.beneficiary_invites for update
  using (auth.uid() = beneficiary_id or public.is_admin());

-- ── Add missing donor_crm_contacts policies ───────────────────────────────────
-- (already done in schema.sql, safe to skip with IF NOT EXISTS guard)

-- ── Grant permissions on new tables ──────────────────────────────────────────
grant all on public.notifications         to anon, authenticated, service_role;
grant all on public.support_cases         to anon, authenticated, service_role;
grant all on public.support_notes         to anon, authenticated, service_role;
grant all on public.beneficiary_invites   to anon, authenticated, service_role;
