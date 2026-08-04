-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: the "Real Impact" band figures the Sports & Youth design draws.
--
-- Run AFTER migrations/20260825000000_cause_impact_stats.sql.
--
-- ⚠️ READ THIS BEFORE PUBLISHING.
--
-- These four values come from the DESIGN MOCKUP, not from this database.
-- Nothing in the schema records "youth impacted" or "athletes supported", and
-- the country figure beside them is already recorded in docs/ as a fabricated
-- statistic this platform published once and had to retract.
--
-- They are therefore inserted with `published = false`. The page keeps showing
-- live measured counts until someone with the standing to make the claim flips
-- them on:
--
--     update public.cause_impact_stats
--        set published = true, source_note = 'FY2026 programme report, p.12'
--      where cause_slug = 'sports-youth';
--
-- `source_note` is not decoration. An impact claim shown to donors should be
-- attributable, and this is where the person publishing it records what it is
-- based on. Fill it in before you publish, not after.
--
-- Publishing all four replaces the whole band. A partial set is ignored — mixing
-- an authored claim with a live count in one row would give both the same
-- apparent provenance.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.cause_impact_stats
  (cause_slug, value, label, icon, sort_order, published, source_note)
values
  ('sports-youth', '125K+', 'Youth Impacted',       0, 0, false, 'From design mockup — replace with a real source before publishing'),
  ('sports-youth', '68K+',  'Athletes Supported',   1, 1, false, 'From design mockup — replace with a real source before publishing'),
  ('sports-youth', '1,250+','Programs Funded',      2, 2, false, 'From design mockup — replace with a real source before publishing'),
  ('sports-youth', '250+',  'Communities Reached',  3, 3, false, 'From design mockup — replace with a real source before publishing'),
  ('people-in-need', '2.3M+','People Helped',       0, 0, false, 'From design mockup — replace with a real source before publishing'),
  ('people-in-need', '68K+', 'Lives Transformed',   1, 1, false, 'From design mockup — replace with a real source before publishing'),
  ('people-in-need', '1,250+','Programs Funded',    2, 2, false, 'From design mockup — replace with a real source before publishing'),
  ('people-in-need', '120+', 'Countries Reached',   3, 3, false, 'From design mockup — replace with a real source before publishing')
on conflict (cause_slug, sort_order) do nothing;
