-- Rollback: 20260905010000_share_events_native_channels
--
-- ⚠️ NOT a bare constraint swap. Rows written while the wider constraint was in
-- force may hold 'messenger' or 'native', and re-adding the narrower CHECK
-- against existing rows fails outright — leaving the table with NO channel
-- constraint at all if the DROP is run and the ADD is not.
--
-- So the values are folded into the same buckets the API falls back to
-- (messenger -> facebook, native -> other) BEFORE the constraint is narrowed.
-- That loses precision, which is the honest cost of rolling this back; it does
-- not lose the share events themselves.

UPDATE public.share_events SET channel = 'facebook' WHERE channel = 'messenger';
UPDATE public.share_events SET channel = 'other'    WHERE channel = 'native';

ALTER TABLE public.share_events
  DROP CONSTRAINT IF EXISTS share_events_channel_check;

ALTER TABLE public.share_events
  ADD CONSTRAINT share_events_channel_check CHECK (
    channel = ANY (ARRAY[
      'link'::text, 'email'::text, 'sms'::text, 'facebook'::text,
      'twitter'::text, 'instagram'::text, 'linkedin'::text, 'whatsapp'::text,
      'qr'::text, 'other'::text
    ])
  );
