-- ─────────────────────────────────────────────────────────────────────────────
-- Peer-to-peer attribution — the one column that makes P2P real.
--
-- WHY THIS IS THE BLOCKER, not the supporter page
--
-- `peer_fundraisers` has existed for a long time: full schema, FKs, RLS, a
-- parent-campaign index, a `slug` column ready for per-supporter URLs, and 240
-- rows in production. `POST /api/campaigns/[id]/peer-fundraisers` lets a
-- supporter join a team, and the campaign page renders the roster
-- (TeamFundraisers.tsx). What has never existed is a way to say WHICH
-- supporter's page a donation came through:
--
--   * `donations` carries `campaign_id` and nothing else identifying a peer
--   * the donate flow has no peer parameter
--   * nothing maintains `peer_fundraisers.raised_amount`
--
-- So every one of those 240 rows shows a total that no donation produced. Build
-- the supporter page before this migration and it renders a progress bar that
-- can never move — a surface that looks alive and silently does nothing.
--
-- WHAT THIS DOES
--
-- 1. Adds the attribution column, nullable: a donation that did not come through
--    a supporter page has no peer, which is the overwhelmingly common case.
-- 2. Rolls a completed donation into the peer's total, via a SEPARATE trigger
--    from `donations_increment_campaign_stats`.
--
-- The parent campaign trigger is deliberately left untouched. It already
-- increments `campaigns.raised_amount` for every completed donation regardless
-- of peer, so a peer-attributed gift counts toward the parent exactly once and
-- toward the peer exactly once. Adding the parent increment here as well is the
-- obvious-looking change that would double-count the campaign total — the same
-- mistake `record_donation`'s header already warns about.
--
-- 3. Backfills the 240 seeded rows to 0. Their current totals are fiction: no
--    donation row supports them, so leaving them would mean the first real
--    attributed gift lands on top of an invented number.
--
-- WHAT THIS DELIBERATELY DOES **NOT** DO — read before writing the follow-up
--
-- The main donation path is the `record_donation` RPC, called from the Stripe
-- webhook. Its INSERT has a fixed column list that does not include
-- `peer_fundraiser_id`, so until that function is extended, attribution works
-- only for any path that inserts into `donations` directly. This migration
-- stops short of touching it on purpose: it is the money path, and there is a
-- specific trap in the obvious change.
--
--   ⚠️ `create or replace function record_donation(... , p_peer_fundraiser_id
--      uuid default null)` does NOT replace the existing function. A different
--      argument list makes it an OVERLOAD, and the caller uses NAMED arguments
--      (`supabase.rpc('record_donation', { p_stripe_event_id: … })`), which then
--      match BOTH the 10-arg and 11-arg signatures — Postgres fails the call
--      with "function record_donation(...) is not unique". Every donation
--      webhook would start erroring, and because the handler rethrows so Stripe
--      retries, it would keep erroring.
--
--   The safe form is `drop function public.record_donation(text, uuid, uuid,
--   bigint, bigint, bigint, text, boolean, text, text);` followed by a single
--   `create function` carrying the new parameter — in one transaction, so no
--   window exists where the function is missing.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.donations
  add column if not exists peer_fundraiser_id uuid
    references public.peer_fundraisers(id) on delete set null;

comment on column public.donations.peer_fundraiser_id is
  'The supporter''s peer fundraiser page this gift came through, when any. NULL '
  'for a direct campaign donation. ON DELETE SET NULL: removing a supporter page '
  'must never delete the money that came through it.';

-- Attribution is queried per peer page ("show this supporter''s donors"), so the
-- partial index skips the majority of rows that have no peer.
create index if not exists donations_peer_fundraiser_id_idx
  on public.donations (peer_fundraiser_id)
  where peer_fundraiser_id is not null;

-- ── Roll a completed, peer-attributed donation into that peer's total ────────
create or replace function public.increment_peer_fundraiser_after_donation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mirrors increment_campaign_stats_after_donation's guard: only completed
  -- money counts. A pending or failed row must not move a public total.
  if new.status = 'completed' and new.peer_fundraiser_id is not null then
    update public.peer_fundraisers
    set raised_amount = raised_amount + new.amount_cents,
        updated_at    = now()
    where id = new.peer_fundraiser_id;
  end if;
  return new;
end;
$$;

drop trigger if exists donations_increment_peer_fundraiser on public.donations;
create trigger donations_increment_peer_fundraiser
  after insert on public.donations
  for each row
  execute function public.increment_peer_fundraiser_after_donation();

-- ── Reset the seeded fiction ─────────────────────────────────────────────────
-- Recompute from the donations that actually exist. Written as a recompute
-- rather than `set raised_amount = 0` so it is idempotent and stays correct if
-- this file is ever re-run after real attributed donations exist.
update public.peer_fundraisers p
set raised_amount = coalesce((
      select sum(d.amount_cents)
      from public.donations d
      where d.peer_fundraiser_id = p.id
        and d.status = 'completed'
    ), 0),
    updated_at = now()
where p.raised_amount is distinct from coalesce((
      select sum(d.amount_cents)
      from public.donations d
      where d.peer_fundraiser_id = p.id
        and d.status = 'completed'
    ), 0);
