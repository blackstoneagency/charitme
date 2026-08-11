-- ═══════════════════════════════════════════════════════════════════════════
-- share_events: allow the two channels the UI already emits.
--
-- WHY
--
-- `share_events_channel_check` lists ten channels. The share grid can emit two
-- more:
--
--   · `messenger` — has ALWAYS been emitted. The tile renders whenever
--     NEXT_PUBLIC_FACEBOOK_APP_ID is set and posts `channel: 'messenger'`, which
--     the API's zod enum rejected with a 400. The client fires that request with
--     `void fetch(...)`, so the rejection was discarded and the share simply
--     never reached attribution — invisible from both ends.
--   · `native` — the OS share sheet (`navigator.share`), which is the
--     visibly-native interaction `mobileGo.md` item 5 asks for.
--
-- ⚠️ The API does NOT depend on this migration having been applied. It inserts
-- the true channel first and, on 23514, retries once under a fallback
-- (`messenger` → `facebook`, `native` → `other`), because this repo carries
-- unapplied migrations as its normal state and losing the event again would be
-- the very bug being fixed. Applying this migration upgrades the data; not
-- applying it costs precision, not events.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.share_events
  DROP CONSTRAINT IF EXISTS share_events_channel_check;

ALTER TABLE public.share_events
  ADD CONSTRAINT share_events_channel_check CHECK (
    channel = ANY (ARRAY[
      'link'::text, 'email'::text, 'sms'::text,
      'facebook'::text, 'messenger'::text,
      'twitter'::text, 'instagram'::text, 'linkedin'::text, 'whatsapp'::text,
      'qr'::text, 'native'::text, 'other'::text
    ])
  );
