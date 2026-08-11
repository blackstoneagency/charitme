-- Rollback: 20260905000000_web_push_subscriptions
--
-- Dropping this table un-subscribes every device, and cannot be undone from
-- here: the endpoint + keys only exist in the browser that produced them, so a
-- restore requires each user to visit the site again and re-grant permission.
-- Nothing else references it, so the drop is otherwise self-contained.

DROP POLICY IF EXISTS "own push subscriptions" ON public.push_subscriptions;
DROP INDEX IF EXISTS public.push_subscriptions_user_id_idx;
DROP TABLE IF EXISTS public.push_subscriptions;
