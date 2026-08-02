# Composite image — seed data

## What exists

The database backing these pages is already populated: `/campaigns` serves real
campaign slugs (e.g. `campaign-123-b1ad88b8`), and the share page was verified
against one. `volunteer_opportunities` carries live rows that `/volunteer`
renders. `sponsors` is administered through `/admin/sponsors`.

No new seed script was written, because no new table was created — see
`composite-image-architecture-decisions.md`, decision 2.

## The one gap, stated plainly

**No `volunteer_opportunities` row currently carries an internship category**, so
`/internships` renders its empty state. That state is real and tested; the
populated state is exercised by unit tests over the same pure helpers
(`internships-core.test.ts`, 15 tests) rather than by a browser run.

To populate it, insert opportunities whose `category` is one of the values in
`INTERNSHIP_CATEGORIES` (`internship`, `internships`, `intern`, `placement`,
`fellowship`) — matched case-insensitively. Anything posted through the existing
volunteer admin with one of those categories appears on `/internships`
immediately, with no second admin screen and no second table.

## Why no fabricated internships were inserted

`/internships` previously said, in hand-written copy: "We would rather say so than
list positions we are not actively filling." That judgement was correct and is
preserved verbatim in the new empty state. Seeding invented openings to make a
screenshot match the reference would waste real applicants' time, so the page
reports what the database actually holds.
