drop trigger if exists connected_accounts_sync_payout_ready on public.connected_accounts;
drop trigger if exists campaigns_set_payout_ready on public.campaigns;
drop index if exists public.campaigns_payout_ready_active_idx;
drop function if exists public.recompute_campaigns_for_account();
drop function if exists public.recompute_campaign_payout_ready();
drop function if exists public.campaign_payout_ready(uuid, uuid);
drop function if exists public.account_is_payout_ready(uuid);
alter table if exists public.campaigns drop column if exists payout_ready;
