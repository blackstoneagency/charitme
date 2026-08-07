-- ─────────────────────────────────────────────────────────────────────────────
-- campaigns.campaign_path — step 1 of the twelve-step builder.
--
-- WHY THIS COLUMN EXISTS
--
-- Step 1 asks who is raising: an individual, a registered nonprofit, or a team.
-- That answer shipped with nowhere to go — the builder collected it, used it to
-- pick the wording on the verification step, and then dropped it on publish. A
-- question whose answer is discarded is a form that lies to the person filling
-- it in, which is the exact failure the flow's own documentation warns about.
--
-- It is NOT the same question as `beneficiary_name` / `beneficiary_relationship`,
-- which record who BENEFITS. A neighbour raising for a family is `personal` with
-- someone else as beneficiary; a charity raising for its own programme is
-- `nonprofit` with itself as beneficiary. Collapsing the two is how a nonprofit
-- ends up with no route to verification.
--
-- ⚠️ DEFAULTED, NOT NULLABLE-AND-EMPTY. Every existing campaign predates step 1
-- and was created by an individual through the old builder, so 'personal' is the
-- correct historical answer rather than a guess — backfilling to NULL would
-- invent an "unknown" state that never existed.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.campaigns
  add column if not exists campaign_path text not null default 'personal';

-- Constrained to the three the builder offers. A free-text column here would
-- drift the moment anything else writes to it, and the campaign page branches on
-- these values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_campaign_path_check'
  ) then
    alter table public.campaigns
      add constraint campaigns_campaign_path_check
      check (campaign_path in ('personal', 'nonprofit', 'team'));
  end if;
end $$;

-- Partial index: the overwhelming majority of rows are 'personal', so an index
-- over the whole column would be near-useless. The queries worth serving are
-- "show me nonprofit campaigns" and "show me team campaigns".
create index if not exists campaigns_campaign_path_idx
  on public.campaigns (campaign_path)
  where campaign_path <> 'personal';

comment on column public.campaigns.campaign_path is
  'Step 1 of the builder: who is RAISING (personal | nonprofit | team). Distinct '
  'from beneficiary_* which record who BENEFITS. Drives whether verification is '
  'offered and whether the campaign page shows an organisation line.';
