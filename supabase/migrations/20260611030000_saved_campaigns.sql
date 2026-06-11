-- ─────────────────────────────────────────────────────────────────────────────
-- Saved / favorited campaigns — donor-facing "save for later" feature
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists saved_campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, campaign_id)
);

create index if not exists saved_campaigns_user_id_idx on saved_campaigns(user_id);
create index if not exists saved_campaigns_campaign_id_idx on saved_campaigns(campaign_id);

alter table saved_campaigns enable row level security;

drop policy if exists saved_campaigns_owner_all on saved_campaigns;
create policy saved_campaigns_owner_all on saved_campaigns for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());
