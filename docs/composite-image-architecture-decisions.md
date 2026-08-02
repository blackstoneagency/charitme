# Composite image — architecture decisions

Four decisions shaped this work. Each one chose *not* to build something.

## 1. Nine of twelve pages already existed — so nine were not rebuilt

The brief reads as a twelve-page greenfield build. The repository says otherwise:
`/search`, `/causes/[slug]`, `/leaderboard`, `/thank-you`, `/transparency`,
`/reports`, `/partner`, `/volunteer`, `/internships` and `/feedback` are all live
routes, and several are already Supabase-backed.

Building twelve new routes would have produced twelve duplicates — explicitly
forbidden ("do not create duplicate pages when a suitable page already exists",
"do not overwrite stronger existing functionality"). The work was therefore
scoped by *measuring* each page, not by counting sub-images.

## 2. No new tables — internships and partners are views over existing ones

An internship IS a volunteer opportunity. `volunteer_opportunities` already
carries `category`, `is_remote`, `location`, `time_commitment`, `slots`, `skills`
and a `status` CHECK, plus a public listing, a detail page, an apply flow and an
admin surface.

An `internships` table would have duplicated every one of those and then drifted
from them — the failure mode this repository has documented repeatedly (three
hand-maintained copies of `CAMPAIGN_CATEGORIES` that disagreed). A test now
asserts no `internships` table exists and no code calls `from('internships')`.

Same reasoning for partners: `sponsors` already existed, with an admin CRUD.

## 3. The share page reuses the share pipeline rather than re-implementing it

`POST /api/share-events` writes a `share_events` row. Both `/api/donations` and
the Stripe webhook read that row back and mark `converted` + `donation_id` — that
is how an organiser's share-to-donation conversion number is produced.

A second share implementation on the new page would have written rows the
attribution logic did not know about, or none at all. Either way the organiser's
conversion figures would have quietly stopped meaning anything. So the new page
imports the existing `ShareButtons` component unchanged.

## 4. A failed read is never rendered as an empty result

Applied to every reader added here, because on these pages the two states are
*opposite claims*:

- "We have no partners" vs "we could not load our partners".
- "No internships are open" vs "the internships list is broken".
- "Nobody has shared this campaign" vs "the share counter is down".

Each loader returns `null` on error and `[]` on genuinely empty, and each page
renders a different thing for each. Note that the pre-existing `/api/sponsors`
endpoint returns `{ sponsors: [] }` on error and therefore *cannot* distinguish
them — which is one reason `/partner` reads the table directly through a server
component rather than fetching that endpoint.
