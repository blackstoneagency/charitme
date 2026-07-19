-- ─────────────────────────────────────────────────────────────────────────────
-- Impact tracking — how each campaign spends funds and the outcomes it delivers.
-- Powers the "Impact Intelligence" + "Transparency Score" pillars.
--
--   impact_plans        — one spending plan per campaign (planned budget)
--   impact_plan_items   — budget line items (planned vs actual spend)
--   impact_updates      — verified progress posts (optionally tied to spend)
--   impact_evidence     — proof attached to an update (receipt/photo/doc/link)
--   impact_metrics      — outcome metrics (target vs current)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ownership helper: does the current user own the given campaign?
create or replace function public.owns_campaign(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns c where c.id = cid and c.user_id = auth.uid());
$$;

-- ── impact_plans ─────────────────────────────────────────────────────────────
create table if not exists impact_plans (
  id                 uuid primary key default uuid_generate_v4(),
  campaign_id        uuid not null unique references campaigns(id) on delete cascade,
  created_by         uuid references profiles(id) on delete set null,
  title              text not null default 'Impact Plan',
  summary            text,
  total_budget_cents bigint not null default 0 check (total_budget_cents >= 0),
  status             text not null default 'draft' check (status in ('draft','published')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists impact_plan_items (
  id                  uuid primary key default uuid_generate_v4(),
  plan_id             uuid not null references impact_plans(id) on delete cascade,
  label               text not null,
  category            text,
  planned_amount_cents bigint not null default 0 check (planned_amount_cents >= 0),
  spent_amount_cents   bigint not null default 0 check (spent_amount_cents >= 0),
  sort                int not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists impact_plan_items_plan_idx on impact_plan_items(plan_id);

-- ── impact_updates + evidence ────────────────────────────────────────────────
create table if not exists impact_updates (
  id                uuid primary key default uuid_generate_v4(),
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  title             text not null check (char_length(title) between 2 and 200),
  body              text not null check (char_length(body) between 1 and 12000),
  amount_spent_cents bigint check (amount_spent_cents is null or amount_spent_cents >= 0),
  status            text not null default 'published' check (status in ('draft','published')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists impact_updates_campaign_idx on impact_updates(campaign_id);

create table if not exists impact_evidence (
  id         uuid primary key default uuid_generate_v4(),
  update_id  uuid not null references impact_updates(id) on delete cascade,
  kind       text not null default 'image' check (kind in ('image','receipt','video','document','link')),
  url        text not null,
  caption    text,
  created_at timestamptz not null default now()
);
create index if not exists impact_evidence_update_idx on impact_evidence(update_id);

-- ── impact_metrics ───────────────────────────────────────────────────────────
create table if not exists impact_metrics (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  label         text not null,
  unit          text,
  target_value  numeric,
  current_value numeric not null default 0,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists impact_metrics_campaign_idx on impact_metrics(campaign_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists impact_plans_updated_at on impact_plans;
create trigger impact_plans_updated_at before update on impact_plans
  for each row execute function public.set_updated_at();
drop trigger if exists impact_updates_updated_at on impact_updates;
create trigger impact_updates_updated_at before update on impact_updates
  for each row execute function public.set_updated_at();
drop trigger if exists impact_metrics_updated_at on impact_metrics;
create trigger impact_metrics_updated_at before update on impact_metrics
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — public read of published impact; campaign owner + admin write.
-- ─────────────────────────────────────────────────────────────────────────────
alter table impact_plans      enable row level security;
alter table impact_plan_items enable row level security;
alter table impact_updates    enable row level security;
alter table impact_evidence   enable row level security;
alter table impact_metrics    enable row level security;

drop policy if exists impact_plans_read on impact_plans;
create policy impact_plans_read on impact_plans for select
  using (status = 'published' or owns_campaign(campaign_id) or is_admin());
drop policy if exists impact_plans_write on impact_plans;
create policy impact_plans_write on impact_plans for all
  using (owns_campaign(campaign_id) or is_admin())
  with check (owns_campaign(campaign_id) or is_admin());

drop policy if exists impact_plan_items_read on impact_plan_items;
create policy impact_plan_items_read on impact_plan_items for select
  using (is_admin() or exists (
    select 1 from impact_plans p where p.id = plan_id
      and (p.status = 'published' or owns_campaign(p.campaign_id))));
drop policy if exists impact_plan_items_write on impact_plan_items;
create policy impact_plan_items_write on impact_plan_items for all
  using (is_admin() or exists (select 1 from impact_plans p where p.id = plan_id and owns_campaign(p.campaign_id)))
  with check (is_admin() or exists (select 1 from impact_plans p where p.id = plan_id and owns_campaign(p.campaign_id)));

drop policy if exists impact_updates_read on impact_updates;
create policy impact_updates_read on impact_updates for select
  using (status = 'published' or owns_campaign(campaign_id) or is_admin());
drop policy if exists impact_updates_write on impact_updates;
create policy impact_updates_write on impact_updates for all
  using (owns_campaign(campaign_id) or is_admin())
  with check (owns_campaign(campaign_id) or is_admin());

drop policy if exists impact_evidence_read on impact_evidence;
create policy impact_evidence_read on impact_evidence for select
  using (is_admin() or exists (
    select 1 from impact_updates u where u.id = update_id
      and (u.status = 'published' or owns_campaign(u.campaign_id))));
drop policy if exists impact_evidence_write on impact_evidence;
create policy impact_evidence_write on impact_evidence for all
  using (is_admin() or exists (select 1 from impact_updates u where u.id = update_id and owns_campaign(u.campaign_id)))
  with check (is_admin() or exists (select 1 from impact_updates u where u.id = update_id and owns_campaign(u.campaign_id)));

drop policy if exists impact_metrics_read on impact_metrics;
create policy impact_metrics_read on impact_metrics for select
  using (owns_campaign(campaign_id) or is_admin() or exists (
    select 1 from campaigns c where c.id = campaign_id and c.status = 'active' and c.visibility = 'public'));
drop policy if exists impact_metrics_write on impact_metrics;
create policy impact_metrics_write on impact_metrics for all
  using (owns_campaign(campaign_id) or is_admin())
  with check (owns_campaign(campaign_id) or is_admin());
