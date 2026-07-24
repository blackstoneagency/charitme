-- =============================================================================
-- Marketing Goals — goal-based marketing entry point ("tell CharitMe the outcome")
-- =============================================================================
-- The foundation of the Marketing OS goal→campaign loop. A marketing leader
-- enters a business objective in natural language (or via the structured form);
-- the system stores it as a measurable goal with a baseline, a target, a
-- deadline, an owner, and an autonomy level. Progress is measured against LIVE
-- CharitMe data (campaign starts, donation volume) where the metric maps to a
-- real table; other metrics are stored and clearly labelled "measurement
-- pending" rather than faked.
--
-- RLS: marketing data is admin/service-role only — matches the existing
-- marketing_* tables. No anon/authenticated policies; API routes read/write via
-- the service role after verifyAdmin() + zod validation. Every mutation is
-- recorded in marketing_audit_logs by the API layer.
-- =============================================================================

create table if not exists public.marketing_goals (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  description             text,
  objective               text,                       -- plain-English business objective
  natural_language_input  text,                       -- the original NL prompt, if any

  target_metric           text not null default 'custom',
  baseline_value          numeric,                    -- value captured when the goal was set
  target_value            numeric,
  unit                    text not null default 'count',   -- count | cents | percent | ratio

  deadline                date,
  priority                text not null default 'medium',
  geography               text,
  audience                text,
  category                text,                       -- campaign category the goal targets
  budget_cents            bigint check (budget_cents is null or budget_cents >= 0),
  channels                text[] not null default '{}',

  autonomy_level          smallint not null default 1, -- 1 recommend, 2 create, 3 guardrailed, 4 exception-based
  constraints             jsonb not null default '{}'::jsonb,

  status                  text not null default 'draft',
  confidence              numeric,                    -- 0..1, nullable until forecast exists
  forecast_value          numeric,

  owner_id                uuid references auth.users(id) on delete set null,
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint marketing_goals_metric_chk check (target_metric in (
    'fundraiser_starts','donation_volume','recurring_donors','donation_conversion',
    'verified_charities','donor_acquisition_cost','organizer_retention',
    'aeo_visibility','organic_traffic','custom'
  )),
  constraint marketing_goals_unit_chk check (unit in ('count','cents','percent','ratio')),
  constraint marketing_goals_priority_chk check (priority in ('low','medium','high','critical')),
  constraint marketing_goals_status_chk check (status in ('draft','active','paused','achieved','missed','archived')),
  constraint marketing_goals_autonomy_chk check (autonomy_level between 1 and 4),
  constraint marketing_goals_confidence_chk check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists idx_marketing_goals_status   on public.marketing_goals (status, priority);
create index if not exists idx_marketing_goals_deadline on public.marketing_goals (deadline);
create index if not exists idx_marketing_goals_created  on public.marketing_goals (created_at desc);
create index if not exists idx_marketing_goals_owner    on public.marketing_goals (owner_id);

-- updated_at trigger (reuses the marketing_engine helper if present, else defines it)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'marketing_touch_updated_at') then
    create function public.marketing_touch_updated_at()
    returns trigger language plpgsql as 'begin new.updated_at = now(); return new; end';
  end if;
end $$;

drop trigger if exists marketing_goals_touch on public.marketing_goals;
create trigger marketing_goals_touch
  before update on public.marketing_goals
  for each row execute function public.marketing_touch_updated_at();

-- RLS: service-role only, same as every other marketing_* table.
alter table public.marketing_goals enable row level security;
-- (no anon/authenticated policies: service role bypasses RLS, everyone else denied)

-- =============================================================================
-- Rollback (manual): drop table public.marketing_goals cascade;
-- =============================================================================
