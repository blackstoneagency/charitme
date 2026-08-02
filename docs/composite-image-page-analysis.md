# Composite image — page analysis (sub-images 36–47)

The composite is a 4×3 grid of twelve labelled screens, numbered **36–47** in the
artwork itself, so identification is not inferred — it is read off the reference.

**The single most important finding of this analysis: nine of the twelve pages
already exist in this codebase.** The brief forbids duplicating a page when a
suitable one exists, and forbids overwriting stronger existing functionality. So
this is not a twelve-page greenfield build. It is:

- **2 genuinely missing pages** to create,
- **4 existing pages that are static shells** to connect to real data,
- **6 existing pages already backed by Supabase** to verify and elevate.

Building twelve new routes would have produced duplicates of `/search`,
`/leaderboard`, `/causes/[slug]`, `/volunteer`, `/feedback` and `/transparency`,
all of which are live and several of which are already wired.

---

## Audit table — what actually exists

Measured on 2026-08-02 by reading every route file and counting Supabase
references, not by assuming from the route name.

| # | Reference label | Existing route | State found |
|---|---|---|---|
| 36 | Search Page (Global Search) | `/search` | 267 L, **wired** (3 Supabase refs) |
| 37 | Advanced Search / Filters | `/search`, `/campaigns` | Filters live on `/campaigns`; `/search` has no facets |
| 38 | Cause Category Page | `/causes/[slug]` | 155 L, **wired** |
| 39 | Cause Leaderboard | `/leaderboard` | 30 L shell → `lib/leaderboard`, **wired** |
| 40 | Donation Receipt | `/thank-you`, `/donor/receipt` | 160 L, **wired** (4 refs) |
| 41 | Share Cause | — *(owner-only `/dashboard/campaigns/[id]/share`)* | **No public page** |
| 42 | Report / Transparency | `/transparency`, `/reports` | `/transparency` static; `/reports` uses `getHomeData` |
| 43 | Partnerships | `/partner`, `/corporate-partnerships` | 103 L, **fully static** |
| 44 | Volunteer | `/volunteer` | 40 L shell → `lib/volunteers-server`, **wired** |
| 45 | Volunteer Opportunities | `/volunteer` + `/volunteer/[slug]` | **wired** |
| 46 | Internships | `/internships` | 86 L, **fully static** |
| 47 | Feedback / Suggest | `/feedback` | Form posts to existing `/api/contact` |

---

## The two genuine gaps

### 41 — Share Cause (public)

**Route:** `/campaigns/[slug]/share` · **Persona:** a supporter, not the organiser.

`/dashboard/campaigns/[id]/share` exists but is **owner-gated** — a supporter who
wants to spread a campaign has no page. The campaign detail page has inline
`ShareButtons`, but nothing linkable, nothing indexable, and nothing a campaign
can point at in a text message.

**Reused rather than rebuilt:** `ShareButtons.tsx` (190 L, already renders the
exact channel set in the reference — Facebook, X, LinkedIn, WhatsApp, Email, Copy
Link) and `POST /api/share-events` (111 L). A second share system would fragment
the conversion tracking that `/api/donations` and the Stripe webhook already
depend on: they look up a `share_events` row and mark `converted` + `donation_id`
on it. **This is why the share buttons here are real functionality and not
decorative** — every share writes a row that a later donation can be attributed to.

**Data:** `share_events` (exists; `channel` CHECK already matches the reference's
channel list exactly), `campaigns`.

### 37 — Advanced Search / Filters

**Route:** `/search` (elevated, not a new route) · **Persona:** a donor who knows
roughly what they want.

`/campaigns` has category/location/sort facets; `/search` has a type tab strip but
no facets. The reference shows both on one screen. Adding a *third* search route
would be the duplicate the brief forbids — the work is to bring the facets to the
global search that already exists.

---

## The four static shells to connect

### 43 — Partnerships → `sponsors`

**Route:** `/partner` (elevated). The reference shows a partner-logo strip
(UNICEF, World Vision, Save the Children, GlobalGiving) and three stats.

The `sponsors` table already exists with exactly the needed shape —
`name, logo_url, website, active, sort_order` — and had no reader on this page.
The stats come from real platform aggregates, not typed-in numbers.

### 46 — Internships → `volunteer_opportunities`

**Route:** `/internships` (elevated). `volunteer_opportunities` already carries a
`category` column, `is_remote`, `location`, `time_commitment`, `slots` and a
`status` CHECK. An internship **is** an opportunity, so this is a filtered view of
a live table rather than a second parallel system with its own schema, its own
admin screen and its own drift.

### 42 — Report / Transparency

`/transparency` is static; `/reports` already reads `getHomeData`. The reference's
downloadable annual PDFs are the one element with **no table and no storage bucket
behind it** — see the open dependency below.

### 47 — Feedback

Already posts to `/api/contact`. The reference's "feedback type" selector and
character counter are real UI gaps, not backend gaps.

---

## Open dependency, stated rather than faked

The reference's **downloadable impact/financial/annual report PDFs** (page 42)
have no table and no storage bucket in this schema. Producing that surface
honestly needs a migration, and **this sandbox cannot apply migrations to the
live database** — the same constraint already documented for `organizations`,
which is code-complete but inert for exactly this reason.

Shipping a downloads UI against a table that does not exist would be a page that
"appears complete but is not connected to the backend" — explicitly forbidden by
the brief. So that element is recorded here as an owner-gated dependency rather
than mocked, and the rest of page 42 is built on data that does exist.

---

## Per-page detail

Acceptance criteria for every page below are the same baseline: real Supabase
reads, no placeholder buttons, both themes, no horizontal overflow at 320/390 px,
keyboard reachable, empty state distinct from error state, and a route reachable
from navigation.

Detail for each page is maintained in `composite-image-page-matrix.md`, which
carries the per-page route, tables, navigation location and live test status.
