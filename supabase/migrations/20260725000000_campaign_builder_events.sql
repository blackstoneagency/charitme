-- =============================================================================
-- Campaign-builder funnel analytics
-- =============================================================================
-- Captures per-step events for the /create wizard (and AI builder) so drop-off,
-- abandonment, and completion time are measurable — previously invisible. Rows
-- are tiny and append-only. Guests must be captured too (many creators start
-- logged-out), so INSERT is open to anon/authenticated with a tight enum on
-- `event`; SELECT is service-role only (admin dashboards read via supabaseAdmin).
-- =============================================================================

create table if not exists public.campaign_builder_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,                     -- client-generated anon funnel id
  user_id      uuid references auth.users(id) on delete set null,
  path         text not null default 'guided',    -- 'guided' | 'ai'
  step         text not null,
  event        text not null,                      -- 'enter' | 'advance' | 'back' | 'publish' | 'save_draft' | 'abandon'
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint campaign_builder_events_event_chk
    check (event in ('enter','advance','back','publish','save_draft','abandon')),
  constraint campaign_builder_events_path_chk
    check (path in ('guided','ai'))
);

create index if not exists idx_cbe_session on public.campaign_builder_events (session_id, created_at);
create index if not exists idx_cbe_step    on public.campaign_builder_events (step, created_at);
create index if not exists idx_cbe_created on public.campaign_builder_events (created_at);

alter table public.campaign_builder_events enable row level security;

-- Anyone (incl. anonymous creators) may append their own funnel events.
drop policy if exists cbe_insert_any on public.campaign_builder_events;
create policy cbe_insert_any on public.campaign_builder_events
  for insert to anon, authenticated with check (true);

-- Reads are admin-only (service role bypasses RLS; no anon/authenticated SELECT policy).
