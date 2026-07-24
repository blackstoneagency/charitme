-- =============================================================================
-- Marketing Opportunities — data-derived, scored opportunity feed
-- =============================================================================
-- The "Prioritize" hop of the Marketing OS loop. Opportunities are generated
-- from LIVE CharitMe data (campaign category momentum + realised funds), scored
-- deterministically, and can be converted straight into a marketing_goal — which
-- closes Prioritize → Plan. Nothing here is invented: every opportunity carries
-- the real numbers that produced it in `evidence`, and the source is recorded.
--
-- RLS: service-role only, matching every other marketing_* table. API routes
-- gate on verifyAdmin() + zod and audit every mutation to marketing_audit_logs.
-- =============================================================================

create table if not exists public.marketing_opportunities (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  rationale         text,                         -- plain-English "why this matters"
  evidence          jsonb not null default '{}'::jsonb,   -- the live numbers behind it

  category          text,                         -- campaign category, when applicable
  geography         text,
  audience          text,
  target_metric     text not null default 'custom',

  -- estimates (clearly labelled as estimates in the UI, never as fact)
  est_impact_cents  bigint,                        -- projected incremental funds
  est_starts        integer,                       -- projected incremental fundraiser starts
  confidence        numeric,                       -- 0..1
  effort            text not null default 'medium',-- low | medium | high
  cost_cents        bigint check (cost_cents is null or cost_cents >= 0),
  time_to_value_days integer,

  score             numeric not null default 0,    -- 0..100 composite priority score
  status            text not null default 'new',
  source            text not null default 'rule',  -- rule | ai | manual
  dedupe_key        text,                          -- stable key so re-generation upserts

  linked_goal_id    uuid references public.marketing_goals(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint marketing_opps_metric_chk check (target_metric in (
    'fundraiser_starts','donation_volume','recurring_donors','donation_conversion',
    'verified_charities','donor_acquisition_cost','organizer_retention',
    'aeo_visibility','organic_traffic','custom'
  )),
  constraint marketing_opps_effort_chk check (effort in ('low','medium','high')),
  constraint marketing_opps_status_chk check (status in ('new','accepted','rejected','deferred','converted','archived')),
  constraint marketing_opps_source_chk check (source in ('rule','ai','manual')),
  constraint marketing_opps_confidence_chk check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint marketing_opps_score_chk check (score >= 0 and score <= 100)
);

-- Re-generation is idempotent per data-derived opportunity: same dedupe_key updates in place.
create unique index if not exists uq_marketing_opps_dedupe
  on public.marketing_opportunities (dedupe_key) where dedupe_key is not null;
create index if not exists idx_marketing_opps_status on public.marketing_opportunities (status, score desc);
create index if not exists idx_marketing_opps_score  on public.marketing_opportunities (score desc);
create index if not exists idx_marketing_opps_created on public.marketing_opportunities (created_at desc);

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'marketing_touch_updated_at') then
    create function public.marketing_touch_updated_at()
    returns trigger language plpgsql as 'begin new.updated_at = now(); return new; end';
  end if;
end $$;

drop trigger if exists marketing_opportunities_touch on public.marketing_opportunities;
create trigger marketing_opportunities_touch
  before update on public.marketing_opportunities
  for each row execute function public.marketing_touch_updated_at();

alter table public.marketing_opportunities enable row level security;
-- (no anon/authenticated policies: service role bypasses RLS, everyone else denied)

-- =============================================================================
-- Rollback (manual): drop table public.marketing_opportunities cascade;
-- =============================================================================
