# Composite image — production readiness

## Verdict

**11 of 12 pages are production-ready. 1 is partial, for a reason only the owner
can clear.**

| Outcome | Pages |
|---|---|
| Ready, already shipped and verified | 36, 37, 38, 39, 40, 44, 45, 47 |
| Ready, built or wired in this pass | 41, 43, 46 |
| Partial — blocked on an owner-only dependency | 42 |

## What was actually built

Three pages changed. Nine did not need to.

**41 — `/campaigns/[slug]/share` (new).** The only genuinely missing route. It
reuses `ShareButtons` and `POST /api/share-events` rather than adding a second
share path, because those write the `share_events` row that `/api/donations` and
the Stripe webhook read back to mark `converted` + `donation_id`. A parallel
implementation would have fragmented conversion attribution and quietly corrupted
the numbers organisers see.

**43 — `/partner` wired to `sponsors`.** The table had an admin CRUD and a public
API endpoint with **no public consumer**: an administrator could add a partner and
it appeared nowhere on the site.

**46 — `/internships` wired to `volunteer_opportunities`.** Was hardcoded to "no
internships are currently open" — the right answer, but not a measured one, so a
real posting entered through the existing volunteer admin would never have shown.

## Schema, RLS and storage

**No migrations were needed, and none were written.** Every page above runs on a
table that already exists with the columns it needs: `share_events`, `sponsors`,
`volunteer_opportunities`, `campaigns`.

This is the intended outcome, not a shortcut. The alternative — an `internships`
table, a `partners` table — would have duplicated a listing, a detail page, an
apply flow and an admin surface each, then drifted from them. A test now asserts
no `internships` table exists and no code reaches for one.

- **RLS:** unchanged. No new user-accessible table was introduced, so there is no
  new policy surface. Reads go through `supabaseAdmin` in server components that
  return only already-public fields (an active sponsor's name and website; an open
  opportunity's public columns; a live campaign's public counts).
- **Storage:** unchanged. No new bucket. Partner logos are existing `logo_url`
  values, with a derived favicon fallback; campaign covers use the existing
  `resolveCampaignCover` pipeline.
- **Edge Functions:** none added. Nothing here needs one.

## Security notes from this pass

- `sponsorHref` refuses any URL that is not `http(s)` — a stored
  `javascript:` or `data:` value would otherwise have become a live link on a
  public page. Administrator-entered is not the same as safe. Tested both ways.
- Outbound partner links carry `rel="noopener noreferrer nofollow"`.
- The share page takes no user input and writes nothing directly; shares go
  through the existing rate-limited `/api/share-events` (60/min per IP, durable
  across instances).
- Partner logos render `alt=""` with the name as adjacent text, so a screen
  reader announces each partner once rather than twice.

## Images

No new external image was introduced, so `docs/image-attribution.md` records the
existing pipeline rather than a new inventory. Campaign covers on the share page
come from `resolveCampaignCover` — a real uploaded cover, else a themed Unsplash
photo (key-gated), else a deterministic Picsum placeholder. All three branches
already carry attribution handling and none is hotlinked from an unreliable host.

## The one unresolved dependency

**Page 42 — downloadable impact / financial / annual report PDFs.**

The reference shows dated report cards with `Download · PDF · 4.3 MB` and a
previous-reports list. There is **no table and no storage bucket** for these, and
this sandbox cannot apply migrations to the live database — the same constraint
already documented for `organizations`, which is code-complete but inert for
exactly this reason.

Shipping a downloads UI over a table that does not exist would be "a feature that
appears complete but is not connected to the backend", which the brief forbids
explicitly. So it is not built. `/transparency` and `/reports` keep the real
platform aggregates they already render.

**To clear it, the owner needs to:** apply a migration adding a `reports` table
(id, title, kind, period, published_at, file_path, byte_size) plus a
`reports` storage bucket with public read; then the page becomes a
straightforward reader in the shape of `PartnerRoster`.

## Remaining owner-gated items (unchanged by this work)

- Apply the `organizations` migration (blocks 4 orphan tables).
- Stripe test keys, GitHub Actions billing, Vercel quota, staging Supabase.
- Seed at least one `volunteer_opportunities` row with an internship category to
  exercise `/internships` in its populated state in a browser.
