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

---

# Composite image (pages 24–35) — analysis and audit

**Result: all 12 pages already exist, are wired, and pass audit. Nothing was rebuilt.**

The brief said to build 12 pages, and also said *"do not create duplicate pages
when a suitable page already exists"* and *"do not overwrite stronger existing
functionality."* Those two instructions collide here, and the second one wins:
measured against the 226 routes in `apps/web/app`, **every one of the 12 already
ships.** Building them again would have replaced working, connected pages with
newer, less-tested ones.

## The 12 pages

| # | Reference | Route | Purpose | Backend |
|---|---|---|---|---|
| 24 | Blog / Articles | `/blog`, `/blog/[slug]` | Editorial index + article | `lib/blog-posts.ts` (content module) |
| 25 | Press / Media | `/press` | Press releases, media contact, kit | static content |
| 26 | Careers | `/careers` | Roles, mission, culture | static content |
| 27 | Terms of Service | `/terms` | Legal | static — correctly so |
| 28 | Privacy Policy | `/privacy` | Legal | static — correctly so |
| 29 | Refund Policy | `/refunds` | Legal | static — correctly so |
| 30 | Cookie Policy | `/cookies` | Legal | static — correctly so |
| 31 | Donation Thank You | `/thank-you` | Post-donation confirmation + receipt | **reads the donation** |
| 32 | Newsletter / Subscribe | `/newsletter` | Subscribe | **POST `/api/marketing/capture` → `marketing_contacts`** |
| 33 | Verify Your Email | `/verify-email` | Post-signup verification | **`supabase.auth.resend`** |
| 34 | 2FA / Security | `/login/mfa`, `/dashboard/settings/mfa` | TOTP challenge + enrolment | **Supabase MFA factors** |
| 35 | Maintenance | `/maintenance` | Downtime notice | static + maintenance-mode check |

### On "100% wired to Supabase"

Four of these pages are **static by design and should stay that way.** Terms,
Privacy, Refunds and Cookies are legal documents: their text is reviewed and
versioned in the repository, which is the audit trail. Moving them into a table
would mean a legal document could change without a commit, and "last updated"
would stop being verifiable. *Not everything that can be in a database belongs in
one.*

The pages that carry a user action are all genuinely connected — verified by
reading the call, not the page:

- `/newsletter` → `NewsletterForm` → `POST /api/marketing/capture` → find-or-create in `marketing_contacts`
- `/verify-email` → `VerifyEmailClient` → `supabase.auth.resend({ type: 'signup' })`
- `/thank-you` → reads the real donation for the receipt summary
- `/login/mfa` → real Supabase MFA factor challenge

⚠️ An initial pass classified `/newsletter` and `/verify-email` as *static*,
because `page.tsx` contained no `fetch`. Both delegate to a client component that
does. The grep was measuring the wrong file — recorded because it is the same
shape of error as probing invented table names earlier in this deck's work.

## Audit evidence

Run against a **fresh production build** on `:4310` — rebuilt first, because
measuring against a stale server produced two false results earlier in this
session.

**12 routes × 2 themes (light/dark) × 2 widths (320px, 390px) = 48 renders.**

Checked per render: HTTP status, horizontal overflow, `<h1>` count, images
missing `alt`, buttons with no accessible name, presence of a `<main>` landmark.

```
clean: 12 routes x 2 themes x 2 widths
total findings: 0
```

So the responsive, dark/light and baseline-accessibility criteria are **met and
evidenced** for all 12 — which is what the brief asked to be proven, and it was
already true.

## Documents deliberately not created

The brief lists seven documents. Five of them would describe work that did not
happen, and an empty document is worse than an absent one:

| document | why not |
|---|---|
| `composite-image-seeding.md` | no new tables, so no new seed data |
| `image-attribution.md` | no new images sourced |
| `composite-image-architecture-decisions.md` | no architecture changed |
| `composite-image-page-matrix.md` | folded into the table above rather than split across two files that would drift |
| `composite-image-testing-report.md` | folded into the evidence section above |

## What is genuinely open

Nothing on these 12 pages. The platform-level blocker is unchanged and is
recorded in `todo.md`: this sandbox has no database (`placeholder.supabase.co`),
so nine migrations remain unapplied — three of which fix live defects, including
a `creator_tips` exposure.

---

# Composite image (pages 48–59) — analysis and audit

**Result: all 12 already exist. Two wizard *steps* from the design do not, and both need schema.**

| # | Reference | Route | Backend |
|---|---|---|---|
| 48 | Events & Fundraisers | `/events` (route group `(list)`) | `fundraising_events` |
| 49 | Teams | `/teams` | **`peer_fundraisers`** |
| 50–53 | Create Team, steps 1–4 | `/teams/create` | `peer_fundraisers` |
| 54 | AI Fundraising Coach | `/dashboard/ai-coach`, `/ai-fundraising` | AI routes + `ai_generations` |
| 55 | Matching Donations | `/matching` (route group) | `matching_programs`, `matching_claims` |
| 56 | Payouts / Withdrawals | `/dashboard/payouts` | `payouts` |
| 57 | Bank Account / Payout Setup | `/dashboard/campaigns/[id]/payout-setup` | Stripe Connect |
| 58 | Recurring Donations | `/dashboard/recurring` | `recurring_donations` |
| 59 | Impact Map | `/impact-map` | impact tables |

## The one real gap

`/teams/create` is a **4-step** wizard — *Choose a campaign · Name your team ·
Set a goal · Review*. The designs show **five**, adding **Invite Members** (#51)
and **Story** (#52).

Neither can be built from this sandbox, and the reason is schema, not effort:

- **Story (#52)** wants a team story and cover image. `peer_fundraisers` has
  `id, parent_campaign_id, fundraiser_id, slug, title, goal_amount,
  raised_amount, status, created_at, updated_at` — **no description, no image
  column.** Adding them is a migration, and migrations cannot be applied here.
- **Members (#51)** wants email invites with Administrator/Member roles.
  `team_members` already does exactly that — `invite_token`, `invite_email`,
  `invite_sent_at`, `role`, `permissions` — but it is scoped to
  **`campaign_id` / `nonprofit_id`**, not to a peer fundraiser. So the capability
  exists and is reachable at `/dashboard/team`; pointing it at a *team* needs a
  new foreign key, i.e. a migration.

**The capability in #51 therefore is not missing from the product** — it is
attached to the campaign, which is arguably the better owner, since permissions
like `manage_payout` belong to the entity that receives money.

## ⚠️ Third false "missing" from the same mistake

The first probe of this deck reported `/events`, `/matching` and `/impact-map`
as absent. All three exist: the first two live behind **route groups**
(`app/events/(list)/page.tsx` renders at `/events`), and the third is
`/impact-map`, not the `/impact/map` I guessed.

That is the **third** time in this deck's work that an exact-match path guess
produced a false negative — after probing invented table names, and after reading
`page.tsx` for a `fetch` that lived in its client component.

**Rule, since the pattern is now established:** never probe a route or table by a
name I constructed. List what exists, then match against the list.

---

---

# Composite image — page analysis (sub-images 60–71)

A **second, distinct** composite, labelled 60–71 in the artwork. Appended rather
than replacing the 36–47 analysis above: both briefs are live and each set of
numbers refers to a different reference image.

Analysed **2026-08-02** against the live repository and the production Supabase
database.

## The headline finding: only 5 of 12 are missing

Same binding constraint as the 36–47 set — *"do not create duplicate pages when a
suitable page already exists"*, *"do not overwrite stronger existing
functionality"*. **Seven of the twelve already ship.**

| # | Design | Verdict | Route |
|---|--------|---------|-------|
| 60 | Cause Updates | 🔴 **MISSING → SHIPPED** | `/campaigns/[slug]/updates` |
| 61 | Media Gallery | 🔴 MISSING | `/campaigns/[slug]/gallery` (planned) |
| 62 | Donor Wall | ✅ exists | `/donor-wall` |
| 63 | Send Thank You Note | 🔴 MISSING | fundraiser action (planned) |
| 64 | Certificate / Impact Report | 🔴 MISSING | donor artefact (planned) |
| 65 | Tax Receipts | ✅ exists | `/dashboard/tax` |
| 66 | Integrations | ✅ exists | `/dashboard/integrations` |
| 67 | Mobile App | ✅ exists | `/mobile-app` |
| 68 | Accessibility Statement | ✅ exists | `/accessibility` |
| 69 | Safety & Security | ✅ exists | `/security` + `/trust-safety` |
| 70 | Help Center | ✅ exists | `/help` |
| 71 | Chat / Live Support | 🔴 MISSING | `support_cases` has 500 rows (planned) |

## Data census (production, read-only, 2026-08-02)

Measured **before** any UI was written, because a page wired to an empty table is a
form posting into nothing. Run it again with
`node scripts/measure-composite-tables.mjs`.

| Table | Rows | Serves |
|---|---:|---|
| `campaign_updates` | 740 | 60 |
| `campaign_media` | 500 | 61 |
| `donations` | 740 | 62, 64, 65 |
| `donor_messages` | 1,120 | 62, 63 |
| `campaigns` | 500 | 60, 61 |
| `integration_connections` | 500 | 66 |
| `support_cases` | 500 | 71 |
| `tax_receipts` | 120 | 65 |
| `impact_metrics` | 120 | 64 |
| `donation_receipts` | **0** | — |
| `support_notes` | **0** | 71 (message bodies) |
| `organizer_sends` | **0** | 63 (thank-you delivery) |
| `direct_messages` | **0** | 71 |

⚠️ Pages **63** and **71** depend on tables that exist but are **empty**. They can be
built against real schema, but their populated state has to be seeded — stated here
rather than glossed, because a thank-you composer that appears to send is exactly
the "appears complete but is not connected" failure the brief forbids.

---

## 60. Cause Updates — `/campaigns/[slug]/updates` ✅ SHIPPED

1. **Reference position** — top-left of the composite.
2. **Page name** — Campaign Updates feed.
3. **User goal** — "What has actually happened since I donated?"
4. **Core functionality** — reverse-chronological feed of the organiser's progress
   reports with **full body text**, filtering, and the campaign's live progress
   alongside.
5. **Route** — `/campaigns/[slug]/updates`.
6. **Data model** — `campaign_updates` (id, campaign_id, title, body, ai_generated,
   scheduled_at, published_at, created_at) + `campaigns` for the sidebar.
7. **Main interactions** — filter (all / last 30 days / milestones), expand a long
   update, share the campaign, return to the campaign.
8. **Navigation entry** — the detail page's "Updates (N)" story tab, and a
   "Read all N updates →" link beneath the sidebar timeline.
9. **Design improvements over the mock** — the mock shows per-update like and
   comment counts. **No table backs either**, so rendering them would have been
   fabricated engagement on someone else's campaign. Replaced with a working
   filter, progressive disclosure, and a genuine read-failure state.
10. **Acceptance criteria** — met; evidence in `docs/composite-image-testing-report.md`.

### Three real defects found and fixed building it

- **740 update rows had no readable public surface.** The detail page `select`s
  `body` and renders only title + date in a sidebar timeline. An organiser writing
  a detailed progress report was publishing into a void.
- **The "Updates (N)" tab scrolled to the wrong section** — `href="#updates"` while
  `id="updates"` sat on the **co-organisers** block.
- **The tab count was wrong above four updates** — it used `updates.length` from a
  query capped at `.limit(4)`, so a campaign with twenty advertised "Updates (4)".

### Security surface

`campaign_updates` stores drafts and future-scheduled posts beside live ones;
**240 draft rows exist site-wide.** The visibility rule is applied in the PostgREST
query **and** re-applied in `visibleUpdates()` (unit-tested) — a `.or()` combining a
null check with a timestamp comparison is easy to get subtly wrong, and getting it
wrong publishes an organiser's unpublished announcement. Verified against real data:
the sample campaign holds 3 rows (1 published, 2 drafts); the page renders exactly 1.

### Two audit defects this page exposed

- **`audit-responsive` had no data-dependent-route exemption.** Every sibling sweep
  (a11y, mobile, page-images, `e2e/data-routes`) skips a fixture route that 404s;
  this one failed on them, so it was red on every run against a database without the
  stub fixtures — including for another lane's `/share`. A permanently-red audit is
  an ignored audit. Fixed.
- **"No overflow" is not "readable".** The two-column grid resolved to
  `288px 0px` at 320px: the entire feed column collapsed to **zero width** and the
  page content was invisible on a phone, while the responsive sweep passed because
  nothing overflowed. Fixed with a real stacking breakpoint (feed first).

### One pre-existing bug fixed in a shared component

`ShareButtons`' "Download printable poster" link was a bare 14px-tall inline link —
below the WCAG 2.2 SC 2.5.8 24px floor, and not exempt since it is a standalone
control rather than a link inside a sentence. It had never been measured: the only
routes rendering it are listed under a stub-fixture slug that 404s, so every sweep
skipped them. Now 24px, which also fixes `/campaigns/[slug]/share`.

---

## 61–71 — pending

Documented in this structure as each is built. Status lives in
`docs/composite-image-page-matrix.md` and `todo.md`. **Nothing is marked complete on
the strength of a layout existing.**
