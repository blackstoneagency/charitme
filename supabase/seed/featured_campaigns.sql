-- ─────────────────────────────────────────────────────────────────────────────
-- Feature a few campaigns on every cause page.
--
-- Cause pages sort `featured` DESC before `raised_amount`, so anything flagged
-- here lands in the visible top six of its cause and renders the ring + badge.
--
-- ⚠️ THIS ONLY EVER SETS `featured = true`. It NEVER clears the flag.
-- `campaigns.featured` is also set by the Stripe webhook when a creator PAYS for
-- homepage-rotator placement (app/api/stripe/webhook/route.ts). A "reset then
-- re-apply" version of this script would silently un-feature every creator who
-- paid, and nothing in the schema records that they had. There is no DELETE,
-- no `set featured = false`, and no truncate in this file, on purpose.
--
-- ⚠️ SIDE EFFECT, stated because it is not obvious: the homepage hero rotator
-- shows featured campaigns INSTEAD of its fallback selection
-- (`selectRotatorCampaigns` in lib/featured.ts). Flagging campaigns here
-- therefore changes the homepage hero as well as the cause grids.
--
-- Idempotent: re-running returns ZERO rows once applied, because the update
-- skips rows already flagged. Safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The selection rule ───────────────────────────────────────────────────────
-- Per CATEGORY, the top 2 by the platform's own quality signal
-- (`campaign_health_score`), tie-broken by amount raised, then by id so the
-- result is deterministic and a re-run picks the same rows.
--
-- Per category rather than per cause because causes OVERLAP: /health-wellness,
-- /mental-health, /medical-research and /seniors-elderly all draw on Medical.
-- Picking per cause would flag the same campaigns repeatedly and hand a
-- two-category cause a different count than a one-category cause for no reason.
-- Every cause draws on at least one category, so every cause page gets at
-- least two featured campaigns; a two-category cause gets up to four.
--
-- Eligibility matches what the grid and the rotator already enforce, so a
-- featured campaign is never one a visitor cannot act on:
--   · status active, public, not soft-deleted   — the discovery rule
--   · deadline null or still ahead              — `notExpiredFilter`, `hasEnded`
--   · not already fully funded                  — `hasReachedGoal`: a funded
--     campaign in a promoted slot takes it from one that still needs money
--
-- The 15 categories below are the union of every `categories` entry in
-- `apps/web/lib/causes.ts`. `__tests__/featured-seed.test.ts` fails if the two
-- ever drift.

with eligible as (
  select
    c.id,
    row_number() over (
      partition by c.category
      order by
        coalesce(c.campaign_health_score, 0) desc,
        coalesce(c.raised_amount, 0) desc,
        c.id
    ) as rank
  from public.campaigns c
  where c.status = 'active'
    and c.visibility = 'public'
    and c.deleted_at is null
    -- Not expired. `>` not `>=`: a deadline of today has already arrived, which
    -- is what the app renders as "Ended".
    and (c.deadline is null or c.deadline > now())
    -- Not already funded. A null/zero goal means "no target set", which can
    -- never be reached — so those stay eligible.
    and (
      c.goal_amount is null
      or c.goal_amount <= 0
      or coalesce(c.raised_amount, 0) < c.goal_amount
    )
    and c.category in (
      'Sports',
      'Competition',
      'Family',
      'Wishes',
      'Memorial',
      'Community',
      'Emergency',
      'Medical',
      'Education',
      'Animal',
      'Environment',
      'Creative',
      'Event',
      'Faith',
      'Nonprofit'
    )
)
update public.campaigns t
   set featured = true
  from eligible e
 where t.id = e.id
   and e.rank <= 2
   -- Skips rows already featured, so `returning` lists only what THIS run
   -- changed — that list is the undo record, since nothing else distinguishes
   -- a staff-set flag from a paid one.
   and t.featured is distinct from true
returning t.id, t.slug, t.category, t.title;

-- ── To undo ──────────────────────────────────────────────────────────────────
-- Keep the ids the statement above returned, then:
--
--   update public.campaigns set featured = false where id in ('…', '…');
--
-- Do NOT undo with `set featured = false` across the table — that would clear
-- the paid placements too.

-- ── To check what is featured now ────────────────────────────────────────────
--   select category, count(*)
--     from public.campaigns
--    where featured and status = 'active'
--    group by category
--    order by category;
