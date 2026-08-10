-- ═══════════════════════════════════════════════════════════════════════════
-- Push subscriptions — the storage behind donation alerts.
--
-- WHY THIS EXISTS
--
-- App Store Guideline 4.2 rejects an app that is "simply a repackaged website".
-- A Capacitor shell pointed at a URL is exactly that shape, and push is the one
-- capability the site genuinely cannot provide on its own inside that shell —
-- so it is both the strongest 4.2 mitigation and a thing organisers actually
-- want: knowing a gift arrived without opening the app.
--
-- ONE TABLE, TWO TRANSPORTS
--
-- Web Push (VAPID) covers Chrome, Android and the Play TWA, and is what this
-- repo can implement and test end to end. A Capacitor iOS build cannot use it:
-- its WKWebView is not Safari, so it needs APNs device tokens instead. Rather
-- than two tables that drift, both live here and are told apart by `platform`:
--
--   platform = 'web'  → endpoint + p256dh + auth are set, device_token is null
--   platform = 'ios' / 'android' → device_token is set, the web columns are null
--
-- The CHECK below enforces exactly that, so a half-populated row cannot be
-- written and then fail at send time with nothing to explain it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('web', 'ios', 'android')),

  -- Web Push
  endpoint text,
  p256dh text,
  auth text,

  -- Native (APNs / FCM)
  device_token text,

  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  -- Consecutive delivery failures. A subscription is pruned on a definitive
  -- rejection (404/410), not on a transient one, so a push outage does not
  -- unsubscribe everybody.
  failure_count integer NOT NULL DEFAULT 0,

  CONSTRAINT push_subscription_shape CHECK (
    (platform = 'web' AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth IS NOT NULL AND device_token IS NULL)
    OR
    (platform IN ('ios', 'android') AND device_token IS NOT NULL AND endpoint IS NULL)
  )
);

-- One row per endpoint. Re-subscribing the same browser must UPDATE, not
-- accumulate: without this a user who reinstalls the PWA a few times gets the
-- same notification three times.
--
-- ⚠️ NOT a partial index, and the difference is load-bearing. The obvious
-- `WHERE endpoint IS NOT NULL` cannot be used to infer `ON CONFLICT (endpoint)`
-- — PostgreSQL will not match a partial index for conflict inference, so the
-- upsert in /api/push/subscribe fails at runtime with "no unique or exclusion
-- constraint matching the ON CONFLICT specification". `upsert-onconflict-has-index`
-- caught exactly that.
--
-- A plain UNIQUE index is correct anyway: PostgreSQL treats NULLs as distinct,
-- so the native rows (endpoint NULL, device_token set) do not collide with each
-- other.
-- ⚠️ Kept on ONE line each. `upsert-onconflict-has-index` matches
-- `CREATE UNIQUE INDEX <name> ON public.<table> (<cols>);` with a single space
-- before `ON`, so wrapping the statement hides the index from the guard — which
-- then reports the upsert as having no inferable target.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_uidx ON public.push_subscriptions (endpoint);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_device_token_uidx ON public.push_subscriptions (device_token);

-- The send path reads every subscription for one user.
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ⚠️ A push subscription is a capability: anyone holding the endpoint and keys
-- can send that browser a notification that looks like it came from CharitMe.
-- So there is NO public SELECT, and a user can only ever see or delete their
-- own. The send path uses the service-role client, which bypasses this.
DROP POLICY IF EXISTS push_subscriptions_own_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_select
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_own_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_insert
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_own_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_delete
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.push_subscriptions FROM anon;

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push endpoints and native device tokens, one row per device per user. Never publicly readable: a subscription is a capability to send that device a notification.';
