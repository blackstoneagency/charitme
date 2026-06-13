-- ═══════════════════════════════════════════════════════════════
-- Organizer Marketing — "My Supporters" + template-based
-- re-engagement sends, scoped to a single campaign.
-- Sends are template-constrained and recorded here for rate
-- limiting, history, and abuse review.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.organizer_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,              -- thank_recent|update_blast|lapsed_nudge|monthly_upgrade
  target_group text not null,              -- recent_donors|all_donors|lapsed_donors|one_time_donors
  subject text not null,
  body text not null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  suppressed_count int not null default 0,
  status text not null default 'sent',     -- sent|partial|failed
  created_at timestamptz not null default now()
);

create index if not exists organizer_sends_campaign_idx on public.organizer_sends (campaign_id, created_at desc);
create index if not exists organizer_sends_organizer_idx on public.organizer_sends (organizer_id, created_at desc);

alter table public.organizer_sends enable row level security;

-- Organizers can read their own send history; writes go through the API (service role).
drop policy if exists organizer_sends_select_own on public.organizer_sends;
create policy organizer_sends_select_own on public.organizer_sends
  for select using (auth.uid() = organizer_id);
