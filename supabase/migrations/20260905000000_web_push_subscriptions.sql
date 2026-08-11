-- ═══════════════════════════════════════════════════════════════════════════
-- Web push subscriptions — one row per DEVICE, not per user.
--
-- WHY THIS EXISTS
--
-- `mobileGo.md` item 5: Apple Guideline 4.2 rejects a shell that is "a
-- repackaged website", and the mitigation is native capability the site cannot
-- otherwise offer. Push is the strongest of those — it is the one thing iOS
-- Safari cannot do for a non-installed site, and the one organisers actually
-- want (a donation alert). It is also the only item on that list that is repo
-- work rather than credentials, so it is the one that could be built.
--
-- WHAT A SUBSCRIPTION IS
--
-- The browser hands back an endpoint URL on the vendor's push service plus two
-- keys used to encrypt the payload. Those three values ARE the subscription;
-- there is no server-side identifier to reuse. Hence:
--
--   · `endpoint` is UNIQUE, and the write path upserts on it. A browser hands
--     back the SAME endpoint every time until permission is revoked, so a
--     re-subscribe from a device already on file must update that row rather
--     than accumulate duplicates — otherwise one organiser with a laptop that
--     re-subscribes on every visit gets the same alert five times.
--   · ON DELETE CASCADE from auth.users, so deleting an account takes its
--     devices with it. `lib/deletion-cascade.ts` computes the closure from the
--     schema, so this table joins it automatically and needs no hand-listing.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- No `notification_push` column on `profiles`. Push already has a consent
-- record the user controls directly — the browser permission grant, which they
-- can revoke in the OS without telling us. A second flag would be a second
-- source of truth that silently disagrees with the first, and the disagreement
-- is invisible from both sides. **The presence of a row IS the opt-in**, and
-- turning the toggle off deletes it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  -- The two keys from PushSubscription.getKey(), base64url. Without both, the
  -- payload cannot be encrypted and the send is rejected by the push service.
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  -- Lets someone recognise which device they are revoking in the UI. Truncated
  -- by the write path; never used for anything but display.
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Set on every successful send. A push service keeps an endpoint alive for
  -- months, so without this there is no way to tell a live device from one that
  -- has not been seen since it was registered.
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A subscription is a device fingerprint: the endpoint is a capability URL that
-- anyone holding it can push to. Only its owner may see or change it, and the
-- send path runs as the service role, which bypasses RLS.
DROP POLICY IF EXISTS "own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Web push endpoints, one per device. Row presence is the opt-in; there is no separate preference column.';
