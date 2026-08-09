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
  ('people-in-need', '120+', 'Countries Reached',   3, 3, false, 'From design mockup — replace with a real source before publishing'),
  -- Health & Wellness. No mockup exists for this cause, so these are not copied
  -- from one: they are PLACEHOLDER SHAPES showing the owner what the four tiles
  -- would hold. They ship `published = false` like every row above, so the page
  -- keeps rendering measured counts until someone with the standing to make the
  -- claim fills in `source_note` and flips them on. Do not publish them as they
  -- stand — the values are illustrative, not measured.
  ('health-wellness', '—', 'Patients Supported',    0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('health-wellness', '—', 'Treatments Funded',     1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('health-wellness', '—', 'Families Helped',       2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('health-wellness', '—', 'Hospitals Reached',     3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  -- The remaining 17 causes, same treatment: em-dash values, published =
  -- false, and a source_note that says outright these are placeholders. The
  -- labels name what a tile WOULD hold for that cause; the values are not
  -- guesses at it. Publishing a row without editing shows the unmeasured
  -- indicator, which is the safe failure mode by design.
  ('community-relief', '—', 'Neighbours Reached', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('community-relief', '—', 'Responses Funded', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('community-relief', '—', 'Repairs Completed', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('community-relief', '—', 'Households Supported', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('education', '—', 'Students Supported', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('education', '—', 'Places Funded', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('education', '—', 'Classrooms Equipped', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('education', '—', 'Schools Reached', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('animals-planet', '—', 'Animals Rescued', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('animals-planet', '—', 'Veterinary Cases Funded', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('animals-planet', '—', 'Habitats Protected', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('animals-planet', '—', 'Sanctuaries Supported', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('arts-culture', '—', 'Artists Supported', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('arts-culture', '—', 'Works Commissioned', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('arts-culture', '—', 'Performances Funded', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('arts-culture', '—', 'Venues Sustained', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('faith-belief', '—', 'Meals Served', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('faith-belief', '—', 'Nights of Shelter', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('faith-belief', '—', 'Households Advised', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('faith-belief', '—', 'Congregations Involved', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('sports-recreation', '—', 'Players Supported', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('sports-recreation', '—', 'Clubs Funded', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('sports-recreation', '—', 'Facilities Repaired', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('sports-recreation', '—', 'Seasons Completed', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('youth-development', '—', 'Young People Reached', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('youth-development', '—', 'Mentors Matched', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('youth-development', '—', 'Placements Created', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('youth-development', '—', 'Programmes Funded', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('food-hunger', '—', 'Meals Provided', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('food-hunger', '—', 'Households Fed', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('food-hunger', '—', 'Deliveries Made', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('food-hunger', '—', 'Food Banks Supported', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('disaster-relief', '—', 'People Sheltered', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('disaster-relief', '—', 'Emergency Responses', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('disaster-relief', '—', 'Water Units Deployed', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('disaster-relief', '—', 'Regions Reached', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('mental-health', '—', 'Sessions Funded', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('mental-health', '—', 'Crisis Calls Answered', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('mental-health', '—', 'Groups Supported', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('mental-health', '—', 'Schools Reached', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('medical-research', '—', 'Studies Funded', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('medical-research', '—', 'Trials Supported', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('medical-research', '—', 'Equipment Replaced', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('medical-research', '—', 'Papers Published', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('environment', '—', 'Trees Planted', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('environment', '—', 'Hectares Restored', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('environment', '—', 'Clean-ups Completed', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('environment', '—', 'Volunteer Days', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('veterans-military', '—', 'Veterans Housed', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('veterans-military', '—', 'Treatments Funded', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('veterans-military', '—', 'Careers Started', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('veterans-military', '—', 'Families Supported', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('human-rights', '—', 'Cases Represented', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('human-rights', '—', 'People Relocated', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('human-rights', '—', 'Guides Distributed', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('human-rights', '—', 'Precedents Set', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('seniors-elderly', '—', 'Calls Made', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('seniors-elderly', '—', 'Homes Heated', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('seniors-elderly', '—', 'Repairs Completed', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('seniors-elderly', '—', 'Lunch Clubs Sustained', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('women-girls', '—', 'Refuge Places', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('women-girls', '—', 'Qualifications Completed', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('women-girls', '—', 'Businesses Started', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('women-girls', '—', 'Orders Obtained', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('lgbtq-support', '—', 'Young People Housed', 0, 0, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('lgbtq-support', '—', 'Clinics Supported', 1, 1, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('lgbtq-support', '—', 'Groups Funded', 2, 2, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing'),
  ('lgbtq-support', '—', 'Elders Reached', 3, 3, false, 'PLACEHOLDER — no figure has been measured; set a real value and source before publishing')
on conflict (cause_slug, sort_order) do nothing;
