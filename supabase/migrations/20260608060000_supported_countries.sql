-- ── Supported Countries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supported_countries (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  flag_emoji   text        NOT NULL DEFAULT '',
  iso_code     text        NOT NULL DEFAULT '',
  can_fundraise boolean    NOT NULL DEFAULT false,
  can_donate   boolean     NOT NULL DEFAULT true,
  currency_code text       NOT NULL DEFAULT 'USD',
  notes        text,
  active       boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.supported_countries ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can see the list)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'supported_countries'
      AND policyname = 'public_read_countries'
  ) THEN
    CREATE POLICY "public_read_countries"
      ON public.supported_countries FOR SELECT USING (true);
  END IF;
END $$;

-- Only service role can write (admin API uses supabaseAdmin which bypasses RLS)
GRANT SELECT ON public.supported_countries TO anon, authenticated;
