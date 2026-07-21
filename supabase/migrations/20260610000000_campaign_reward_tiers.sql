-- ─────────────────────────────────────────────────────────────────────────────
-- Campaign Reward / Perk Tiers (Kickstarter-style)
-- Date: 2026-06-10
-- Adds: campaign_rewards table, donations.reward_id, claim_campaign_reward RPC
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.campaign_rewards (
  id                 uuid primary key default uuid_generate_v4(),
  campaign_id        uuid not null references public.campaigns(id) on delete cascade,
  title              text not null,
  description        text,
  amount_cents       bigint not null check (amount_cents > 0),
  estimated_delivery text,
  item_limit         int check (item_limit is null or item_limit > 0),
  claimed_count      int not null default 0,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists idx_campaign_rewards_campaign on public.campaign_rewards(campaign_id, sort_order);

alter table public.campaign_rewards enable row level security;
create policy rewards_public_read  on public.campaign_rewards for select using (true);
create policy rewards_owner_write  on public.campaign_rewards for insert with check
  (is_admin() or exists (select 1 from public.campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy rewards_owner_update on public.campaign_rewards for update using
  (is_admin() or exists (select 1 from public.campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
create policy rewards_owner_delete on public.campaign_rewards for delete using
  (is_admin() or exists (select 1 from public.campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
grant all on public.campaign_rewards to anon, authenticated, service_role;

-- ── donations: link to claimed reward tier ───────────────────────────────────
alter table public.donations
  add column if not exists reward_id uuid references public.campaign_rewards(id) on delete set null;

comment on column public.donations.reward_id is
  'Reward/perk tier selected at checkout, if any (campaign_rewards.id).';

-- ── claim_campaign_reward RPC: atomically increments claimed_count ───────────
create or replace function public.claim_campaign_reward(p_reward_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.campaign_rewards set claimed_count = claimed_count + 1 where id = p_reward_id and (item_limit is null or claimed_count < item_limit);
$$;
grant execute on function public.claim_campaign_reward(uuid) to anon, authenticated, service_role;

-- ── feature flag ──────────────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, description, rollout_pct) values
  ('reward_tiers', true, 'Kickstarter-style reward/perk tiers on campaigns', 100)
on conflict (key) do nothing;

-- ── Re-grant to PostgREST roles ───────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');
