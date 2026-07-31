-- ─────────────────────────────────────────────────────────────────────────────
-- profiles.locale — the visitor's chosen MARKET locale (full BCP 47 tag).
--
-- `profiles.language` already exists and stores the primary subtag only ('es'),
-- which is the right grain for picking a translation file and is validated as
-- such by /api/settings. It cannot express the distinction the footer picker
-- offers, where "Español (México)" and "Español (España)" are separate choices
-- that differ in currency, date and address conventions.
--
-- So this adds a sibling column rather than widening `language`: existing
-- readers (the dashboard settings dropdown, the settings API validator) keep
-- working unchanged against `language`, and the locale picker writes both —
-- the full tag here, the primary subtag there.
--
-- Application code treats this column as OPTIONAL and falls back to `language`
-- when PostgREST reports it missing (PGRST204 / 42703), so the footer works
-- before this migration is applied.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text;

COMMENT ON COLUMN public.profiles.locale IS
  'Full BCP 47 market locale tag chosen in the footer picker (e.g. es-MX). The primary subtag is mirrored into profiles.language.';
