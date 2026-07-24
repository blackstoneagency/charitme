-- =============================================================================
-- Marketing Campaign Plans — one goal → a connected multichannel campaign
-- =============================================================================
-- The "Create" hop of the Marketing OS loop. A goal generates a campaign plan
-- plus a connected set of real draft assets (landing page, email, social posts,
-- SEO metadata, FAQ) — all linked to the same goal so strategy, audience, and
-- measurement stay coherent. Assets are genuine persisted drafts a human edits
-- and approves; nothing publishes to an external channel (no connectors exist),
-- so plan/asset status stops at 'approved' and that limit is shown honestly.
--
-- RLS: service-role only, matching every other marketing_* table. API routes
-- gate on verifyAdmin() + zod and audit mutations to marketing_audit_logs.
-- =============================================================================

create table if not exists public.marketing_campaign_plans (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid references public.marketing_goals(id) on delete set null,
  title         text not null,
  objective     text,
  audience      text,
  geography     text,
  category      text,
  summary       text,
  status        text not null default 'draft',
  source        text not null default 'generated',   -- generated | manual
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint marketing_cplans_status_chk check (status in ('draft','in_review','approved','archived')),
  constraint marketing_cplans_source_chk check (source in ('generated','manual'))
);

create table if not exists public.marketing_campaign_plan_assets (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.marketing_campaign_plans(id) on delete cascade,
  asset_type    text not null,     -- landing_page | email | social_post | seo_meta | faq | sms | ad | blog_post
  channel       text not null,     -- web | email | social | search | sms | paid
  title         text not null,
  body          text not null default '',
  meta          jsonb not null default '{}'::jsonb,
  status        text not null default 'draft',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint marketing_cpa_type_chk check (asset_type in (
    'landing_page','email','social_post','seo_meta','faq','sms','ad','blog_post'
  )),
  constraint marketing_cpa_status_chk check (status in ('draft','approved','archived'))
);

create index if not exists idx_marketing_cplans_goal    on public.marketing_campaign_plans (goal_id);
create index if not exists idx_marketing_cplans_status  on public.marketing_campaign_plans (status, created_at desc);
create index if not exists idx_marketing_cpa_plan       on public.marketing_campaign_plan_assets (plan_id, sort_order);

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'marketing_touch_updated_at') then
    create function public.marketing_touch_updated_at()
    returns trigger language plpgsql as 'begin new.updated_at = now(); return new; end';
  end if;
end $$;

drop trigger if exists marketing_cplans_touch on public.marketing_campaign_plans;
create trigger marketing_cplans_touch
  before update on public.marketing_campaign_plans
  for each row execute function public.marketing_touch_updated_at();

drop trigger if exists marketing_cpa_touch on public.marketing_campaign_plan_assets;
create trigger marketing_cpa_touch
  before update on public.marketing_campaign_plan_assets
  for each row execute function public.marketing_touch_updated_at();

alter table public.marketing_campaign_plans enable row level security;
alter table public.marketing_campaign_plan_assets enable row level security;
-- (no anon/authenticated policies: service role bypasses RLS, everyone else denied)

-- =============================================================================
-- Rollback (manual):
--   drop table public.marketing_campaign_plan_assets cascade;
--   drop table public.marketing_campaign_plans cascade;
-- =============================================================================
