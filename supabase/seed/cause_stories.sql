-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: "Stories from the Field" — 101 stories across all 20 causes.
--
-- Run AFTER migrations/20260824000000_cause_stories.sql, in the Supabase SQL
-- editor or via psql. Idempotent: `on conflict do nothing`, safe to re-run.
--
-- The first three sports-youth rows are the exact cards the design draws —
-- "From Underdog to Team Captain", "Stronger Together", "Building More Than
-- Athletes" — with the reference's chips and copy. The rest give every other
-- cause landing page a populated section rather than a fallback.
--
-- ⚠️ `video_url` is NULL throughout, and that is the one thing this seed
-- deliberately does not reproduce from the screenshot.
--
-- The card renders a play control ONLY when `video_url` is set. Seeding a
-- placeholder would put the button back and have it play nothing — the fake
-- affordance this table exists to remove. Every existing `campaign_media` video
-- row already points at `storage.CharitMe.example`, a reserved TLD that cannot
-- resolve; that is exactly how the page ended up saying "Read the story".
--
-- To complete the match, host the clips anywhere (Supabase Storage, Mux,
-- YouTube — the column is just a URL) and:
--     update public.cause_stories
--        set video_url = 'https://…'
--      where title = 'From Underdog to Team Captain';
-- The play control and "Watch Story →" then appear with no code change.
--
-- Poster images are Unsplash URLs matching this repo's existing photo catalogue.
-- Replace with owned assets before relying on them long-term.
-- ─────────────────────────────────────────────────────────────────────────────

-- 101 stories across 20 causes
insert into public.cause_stories
  (cause_slug, title, blurb, chip_label, chip_accent, poster_url, sort_order, published, published_at)
values
  ('sports-youth', 'From Underdog to Team Captain', 'See how your support helped Miguel find confidence and become a leader.', 'YOUTH EMPOWERMENT', 0, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('sports-youth', 'Stronger Together', 'A new court. A new team. A new future for these young champions.', 'GIRLS IN SPORTS', 1, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('sports-youth', 'Building More Than Athletes', 'How one program is changing lives and strengthening a whole community.', 'COMMUNITY IMPACT', 2, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('sports-youth', 'The Season That Almost Wasn''t', 'Travel costs nearly ended their year. Two weeks of giving changed that.', 'YOUTH EMPOWERMENT', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('sports-youth', 'Boots for Every Boy and Girl', 'A kit drive that put 240 children back on the pitch before winter.', 'GIRLS IN SPORTS', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('sports-youth', 'Coaching the Coaches', 'Training local volunteers so the club outlasts any one season.', 'COMMUNITY IMPACT', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 5, true, now()),
  ('people-in-need', 'A New Home, A New Beginning', 'After losing everything to floods, the Rahman family found safety and hope.', 'SHELTER & HOUSING', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('people-in-need', 'The Pantry That Never Closed', 'Volunteers kept the shelves full through the hardest winter in a decade.', 'FOOD & HUNGER', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('people-in-need', 'Back on Her Feet', 'A deposit, a reference, and a front door key after eleven months in a shelter.', 'HOPE & DIGNITY', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('people-in-need', 'One Bill at a Time', 'How a small emergency fund stopped three evictions in a single month.', 'SHELTER & HOUSING', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('people-in-need', 'The Last Goodbye', 'Neighbours covered a funeral so a grieving family did not face debt as well.', 'FOOD & HUNGER', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('community-relief', 'Forty-Eight Hours After the Flood', 'Boats, blankets and hot food before any official convoy arrived.', 'RAPID RESPONSE', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('community-relief', 'The Hall That Came Back', 'A community centre rebuilt by the people who grew up in it.', 'NEIGHBOURS', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('community-relief', 'When the Power Went Out', 'Generators and warm rooms for 300 households through a five-day outage.', 'REBUILDING', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('community-relief', 'Clearing the Road Together', 'Volunteers reopened the only route to a cut-off village in two days.', 'RAPID RESPONSE', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('community-relief', 'A Street That Refused to Move', 'Rebuilding in place, because home was never just the building.', 'NEIGHBOURS', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('health-wellness', 'The Treatment That Could Not Wait', 'Funded in nine days, when the waiting list said fourteen months.', 'PATIENT CARE', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('health-wellness', 'Getting to Chemo', 'A year of travel costs covered, so no appointment was ever missed.', 'RECOVERY', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('health-wellness', 'Home Adaptations, Fast', 'Ramps and rails fitted the week before discharge, not months after.', 'ACCESS', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('health-wellness', 'Two Hundred Miles for Care', 'How a rural family reached the specialist their daughter needed.', 'PATIENT CARE', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('health-wellness', 'The Prescription Gap', 'Covering what insurance left behind for 84 households this year.', 'RECOVERY', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('education', 'Books Before Breakfast', 'A reading club that turned a struggling year group around.', 'CLASSROOMS', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('education', 'The First in Her Family', 'A scholarship, a laptop, and a place at the university she chose.', 'SCHOLARSHIPS', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('education', 'Rebuilding the Science Lab', 'Equipment for 400 students after a fire closed the block.', 'SUPPLIES', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('education', 'Term Fees, Quietly Paid', 'How anonymous givers kept 37 pupils enrolled through a hard year.', 'CLASSROOMS', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('education', 'A Bus to School', 'Ending a four-mile walk that was costing children their attendance.', 'SCHOLARSHIPS', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('animals-planet', 'Sixty Dogs, One Night', 'An emergency intake when a rescue lost its lease without warning.', 'RESCUE', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('animals-planet', 'The Sanctuary Stays Open', 'Feed and veterinary cover secured for a season that nearly ended it.', 'SANCTUARY', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('animals-planet', 'Back to the Wild', 'Rehabilitation and release for birds nobody expected to fly again.', 'CONSERVATION', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('animals-planet', 'Hedgerows and Habitat', 'Planting that gave a farm''s wildlife corridor back to the wildlife.', 'RESCUE', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('animals-planet', 'The Cat Who Waited', 'Nine years in care, and the adoption that finally came.', 'SANCTUARY', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('arts-culture', 'The Show That Nearly Closed', 'A run saved in its final week by the audience it had built.', 'ARTISTS', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('arts-culture', 'Studio Space for Twelve', 'Affordable workspace in a city that had priced artists out.', 'PERFORMANCE', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('arts-culture', 'Saving the Old Cinema', 'A century-old screen restored by the town that grew up watching it.', 'HERITAGE', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('arts-culture', 'Instruments for Everyone', 'A lending library that put music back into three schools.', 'ARTISTS', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('arts-culture', 'First Commission', 'How a small grant turned a side project into a working practice.', 'PERFORMANCE', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('faith-belief', 'The Kitchen That Feeds Everyone', 'No questions, no forms, 900 meals a week.', 'OUTREACH', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('faith-belief', 'A Roof Over the Hall', 'Repairs that kept a hundred-year-old meeting place in use.', 'COMMUNITY', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('faith-belief', 'Night Shelter, Winter Long', 'Rotating beds across four congregations for five cold months.', 'SERVICE', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('faith-belief', 'The Debt Advice Desk', 'Free, trained, and booked out every week since it opened.', 'OUTREACH', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('faith-belief', 'Welcoming the Newly Arrived', 'Language classes and paperwork help for 60 families.', 'COMMUNITY', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('sports-recreation', 'Floodlights for the Winter Season', 'Training after dark, for the first time in the club''s history.', 'FACILITIES', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('sports-recreation', 'The Pitch That Drained', 'Ending a decade of cancelled Saturdays with proper groundwork.', 'LEAGUES', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('sports-recreation', 'A League for Everyone', 'Adaptive fixtures that doubled the club''s membership.', 'EQUIPMENT', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('sports-recreation', 'Kit Bags and Away Days', 'Travel and gear for a squad that had been paying its own way.', 'FACILITIES', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('sports-recreation', 'The Clubhouse Reopens', 'Volunteers rebuilt what a burst pipe closed for two years.', 'LEAGUES', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('youth-development', 'An Hour a Week', 'The mentoring match that changed a school year, and then a career.', 'MENTORING', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('youth-development', 'Somewhere to Go at Four O''Clock', 'An after-school club in a town that had lost its youth centre.', 'AFTER SCHOOL', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('youth-development', 'First Job, First Reference', 'Work placements for 45 young people leaving care.', 'OPPORTUNITY', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('youth-development', 'The Coding Club', 'Laptops, a room, and volunteers — now a waiting list.', 'MENTORING', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('youth-development', 'Summer That Counted', 'Six weeks of activity for children who would otherwise have had none.', 'AFTER SCHOOL', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('food-hunger', 'The Shelves Stayed Full', 'How a food bank met a 40% rise in need without turning anyone away.', 'FOOD BANKS', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('food-hunger', 'Hot Meals, Every Day', 'A community kitchen serving through school holidays.', 'MEALS', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('food-hunger', 'Surplus, Not Waste', 'Redirecting supermarket surplus to 12 neighbourhood projects.', 'EMERGENCY FOOD', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('food-hunger', 'Breakfast Before the Bell', 'Ending hungry mornings for 300 primary pupils.', 'FOOD BANKS', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('food-hunger', 'A Van That Reaches Further', 'Deliveries to villages the nearest food bank could not serve.', 'MEALS', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('disaster-relief', 'First Trucks In', 'Water and tarpaulins on the ground within thirty-six hours.', 'RAPID RESPONSE', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('disaster-relief', 'Tents Before Nightfall', 'Emergency shelter for 700 people displaced in a single evening.', 'SHELTER', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('disaster-relief', 'After the Cameras Left', 'Six months of rebuilding, funded when the headlines had moved on.', 'RECOVERY', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('disaster-relief', 'Clean Water, Fast', 'Filtration units that stopped an outbreak before it started.', 'RAPID RESPONSE', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('disaster-relief', 'Rebuilding the School First', 'Because routine was what the children needed most.', 'SHELTER', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('mental-health', 'Someone Answered', 'A crisis line kept staffed through the night, every night.', 'COUNSELLING', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('mental-health', 'Twelve Sessions, No Waiting List', 'Counselling funded for people the NHS queue had priced out of time.', 'CRISIS SUPPORT', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('mental-health', 'The Men''s Shed', 'A workshop, a kettle, and conversations that would not happen elsewhere.', 'WELLBEING', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('mental-health', 'Back to Work, Gently', 'Supported return-to-work for 30 people after long absence.', 'COUNSELLING', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('mental-health', 'Talking to Teenagers', 'School-based support that reached students before crisis did.', 'CRISIS SUPPORT', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('medical-research', 'The Grant That Ran Out', 'Bridging funding that kept four years of work from stopping.', 'TRIALS', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('medical-research', 'A Freezer, and Everything In It', 'Replacing failing storage that held a decade of samples.', 'EQUIPMENT', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('medical-research', 'Trial Places for Twenty', 'Travel and accommodation so participation was not a luxury.', 'DISCOVERY', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('medical-research', 'Sharing the Data', 'Open publication that let three other labs skip a dead end.', 'TRIALS', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('medical-research', 'The Question Nobody Funded', 'Early-stage work on a condition too rare for a big grant.', 'EQUIPMENT', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('environment', 'Ten Thousand Trees', 'Planting that reconnected two fragments of ancient woodland.', 'CONSERVATION', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('environment', 'The River Runs Clear', 'Eighteen months of clean-up, and the fish came back.', 'CLEAN-UP', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('environment', 'Solar on the Village Hall', 'Energy bills cut by two thirds, savings back into the community.', 'CLIMATE', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('environment', 'Rewilding the Verges', 'Councils persuaded, mowers stopped, wildflowers returned.', 'CONSERVATION', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('environment', 'Beach, Cleaned by Hand', 'Four tonnes of plastic removed by 200 volunteers in one weekend.', 'CLEAN-UP', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('veterans-military', 'Keys, Not Waiting Lists', 'Housing secured for eleven veterans who had been sleeping rough.', 'HOUSING', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('veterans-military', 'Translating the CV', 'Turning service experience into civilian job offers.', 'TRANSITION', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('veterans-military', 'The Family Left Behind', 'Support for spouses and children through a difficult discharge.', 'FAMILIES', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('veterans-military', 'Peer Support, Weekly', 'A group run by veterans, for veterans, in its fourth year.', 'HOUSING', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('veterans-military', 'Adapting the House', 'Modifications that let a wounded veteran live independently.', 'TRANSITION', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('human-rights', 'A Lawyer in the Room', 'Representation for people facing removal with no means to pay.', 'LEGAL AID', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('human-rights', 'The Case That Set a Precedent', 'One family''s appeal that changed guidance for hundreds.', 'ADVOCACY', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('human-rights', 'Safe Passage', 'Emergency relocation for three activists at immediate risk.', 'PROTECTION', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('human-rights', 'Know Your Rights', 'Plain-language guides distributed in nine languages.', 'LEGAL AID', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('human-rights', 'Documented', 'Evidence-gathering that made an inquiry impossible to dismiss.', 'ADVOCACY', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('seniors-elderly', 'The Weekly Phone Call', 'Volunteers who became the only conversation of the week.', 'COMPANIONSHIP', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('seniors-elderly', 'Warm Rooms, Cold Winter', 'Heating costs covered for 120 older households.', 'CARE', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('seniors-elderly', 'Getting to the Shops', 'A minibus that ended isolation for a rural village.', 'DIGNITY', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('seniors-elderly', 'Repairs Nobody Else Would Do', 'Small jobs that kept people safe in their own homes.', 'COMPANIONSHIP', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('seniors-elderly', 'Lunch Club, Thursdays', 'Forty years running, and nearly closed last spring.', 'CARE', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('women-girls', 'A Refuge With Room', 'Two more family spaces in a service turning women away weekly.', 'SAFETY', 0, 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('women-girls', 'Back to Study', 'Childcare that let 26 mothers finish their qualifications.', 'EDUCATION', 1, 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('women-girls', 'Starting the Business', 'Microloans and mentoring for women locked out of credit.', 'OPPORTUNITY', 2, 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('women-girls', 'Period Dignity', 'Free products in every school in the borough.', 'SAFETY', 0, 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('women-girls', 'Legal Help, Quickly', 'Emergency orders obtained for women at immediate risk.', 'EDUCATION', 1, 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=840&q=70', 4, true, now()),
  ('lgbtq-support', 'Somewhere Safe on a Friday Night', 'A youth group for people who had nowhere else.', 'COMMUNITY', 0, 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=840&q=70', 0, true, now()),
  ('lgbtq-support', 'Housing After Rejection', 'Emergency accommodation for young people made homeless by family.', 'HEALTHCARE', 1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=840&q=70', 1, true, now()),
  ('lgbtq-support', 'Healthcare Without Explaining', 'Affirming clinical services in a region with none.', 'SAFETY', 2, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70', 2, true, now()),
  ('lgbtq-support', 'The First Pride', 'A small town''s first march, and the year that followed.', 'COMMUNITY', 0, 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70', 3, true, now()),
  ('lgbtq-support', 'Older and Out', 'Support for LGBTQ+ elders facing care alone.', 'HEALTHCARE', 1, 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=840&q=70', 4, true, now())
on conflict do nothing;
