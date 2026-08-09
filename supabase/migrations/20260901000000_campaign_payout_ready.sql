-- ─────────────────────────────────────────────────────────────────────────────
-- campaigns.payout_ready — "this campaign can actually take a donation"
--
-- WHY A DENORMALIZED COLUMN, and not a filter in the application:
--
-- Whether a campaign can accept money depends on a row in `connected_accounts`
-- belonging to EITHER the beneficiary or the organizer (see
-- lib/payout-destination.ts — the beneficiary wins when verified, otherwise the
-- organizer). That is a predicate over a different table, reached through
-- profiles, and it is an OR across TWO different foreign keys.
--
-- PostgREST cannot express that. A nested embed can inner-join campaigns ->
-- profiles -> connected_accounts for ONE of the two keys, but there is no way to
-- say "organizer is ready OR beneficiary is ready" in a single request. Joining
-- on the organizer alone would hide campaigns that are genuinely donatable
-- through a verified beneficiary — the exact over-filtering this change is
-- required not to do.
--
-- Filtering in application code instead would mean fetching candidates and
-- discarding some after the fact, which breaks `.range()` pagination (short
-- pages) and `count: 'exact'` (totals that disagree with the rows shown). This
-- repo has already shipped one bug of that shape.
--
-- So the predicate is computed once, stored on the row, and kept current by
-- triggers on both sides. Listings then filter on an indexed boolean.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.campaigns
  add column if not exists payout_ready boolean not null default false;

comment on column public.campaigns.payout_ready is
  'Maintained by trigger. True when the beneficiary or organizer has a verified, '
  'fully-onboarded connected account, i.e. a destination charge would succeed. '
  'Never write this directly — see recompute_campaign_payout_ready().';

-- ─── the predicate, in ONE place ─────────────────────────────────────────────
--
-- Mirrors accountIsPayoutReady() in lib/payout-destination.ts exactly: the
-- account must exist, have submitted details, and have BOTH charges and payouts
-- enabled. Anything less and a destination charge fails or funds cannot be paid
-- out. `verification_status = 'verified'` matches the application's own
-- `verifiedAccount()` query.
create or replace function public.account_is_payout_ready(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connected_accounts ca
    where ca.user_id = p_user_id
      and ca.verification_status = 'verified'
      and ca.stripe_account_id is not null
      and ca.details_submitted
      and ca.payouts_enabled
      and ca.charges_enabled
  );
$$;

create or replace function public.campaign_payout_ready(
  p_user_id uuid,
  p_beneficiary_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Beneficiary first, matching resolvePayoutDestination()'s resolution order.
  -- The OR is why this cannot be a PostgREST join.
  select public.account_is_payout_ready(p_user_id)
      or (p_beneficiary_profile_id is not null
          and public.account_is_payout_ready(p_beneficiary_profile_id));
$$;

-- ─── keeping it current ──────────────────────────────────────────────────────

create or replace function public.recompute_campaign_payout_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.payout_ready := public.campaign_payout_ready(new.user_id, new.beneficiary_profile_id);
  return new;
end $$;

drop trigger if exists campaigns_set_payout_ready on public.campaigns;
create trigger campaigns_set_payout_ready
  before insert or update of user_id, beneficiary_profile_id
  on public.campaigns
  for each row
  execute function public.recompute_campaign_payout_ready();

-- The other side: when an account's onboarding state changes, every campaign
-- that resolves to that user has to be re-evaluated.
--
-- ⚠️ Fires on DELETE too. Dropping a connected account must CLOSE donations, and
-- a trigger that only handled insert/update would leave campaigns advertising a
-- destination that no longer exists.
create or replace function public.recompute_campaigns_for_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid := coalesce(new.user_id, old.user_id);
begin
  update public.campaigns c
     set payout_ready = public.campaign_payout_ready(c.user_id, c.beneficiary_profile_id)
   where c.user_id = affected
      or c.beneficiary_profile_id = affected;
  return null;
end $$;

drop trigger if exists connected_accounts_sync_payout_ready on public.connected_accounts;
create trigger connected_accounts_sync_payout_ready
  after insert or update or delete
  on public.connected_accounts
  for each row
  execute function public.recompute_campaigns_for_account();

-- ─── backfill ────────────────────────────────────────────────────────────────
update public.campaigns c
   set payout_ready = public.campaign_payout_ready(c.user_id, c.beneficiary_profile_id)
 where c.payout_ready is distinct from
       public.campaign_payout_ready(c.user_id, c.beneficiary_profile_id);

-- Partial index: every discovery listing asks for `payout_ready = true` AND
-- `status = 'active'`, so the index only needs to cover live rows.
create index if not exists campaigns_payout_ready_active_idx
  on public.campaigns (payout_ready)
  where status = 'active';

-- ─── self-check ──────────────────────────────────────────────────────────────
--
-- Proves the backfill actually agrees with the predicate rather than assuming
-- it. A migration that silently left rows stale would close donations on
-- campaigns that can take them.
do $$
declare
  mismatched bigint;
begin
  select count(*) into mismatched
    from public.campaigns c
   where c.payout_ready is distinct from
         public.campaign_payout_ready(c.user_id, c.beneficiary_profile_id);

  if mismatched <> 0 then
    raise exception 'payout_ready backfill left % campaign row(s) disagreeing with the predicate', mismatched;
  end if;
end $$;
