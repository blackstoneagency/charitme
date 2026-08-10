-- Rollback for 20260904020002_push_subscriptions.
--
-- Drops the table and with it every stored subscription. That is the correct
-- behaviour rather than a loss: a subscription is a device capability, not user
-- content, and a device re-subscribes on its next visit once the feature is back.
-- Nothing else references the table, so there is no orphan to clean up.

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
drop index if exists public.push_subscriptions_user_idx;
drop table if exists public.push_subscriptions;
