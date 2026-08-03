# Composite image — page implementation matrix

Status is **measured**, not asserted. "Wired" means a Supabase read or write on
that page's own path, verified by reading the file. A page is not marked Done
because its layout exists.

Legend — Production: ✅ shipped · 🔨 in progress · ⛔ blocked on an owner-only
dependency.

| # | Page | Route | Role | Existing / New | Supabase tables | Storage | Edge fn | Navigation | Responsive | A11y | Tests | Production |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 36 | Global Search | `/search` | anon | existing | `campaigns`, `causes` | — | — | header search | ✅ 320/390 clean | ✅ 0 axe | existing | ✅ |
| 37 | Advanced Search / Filters | `/search` | anon | **existing, already complete** | `campaigns`, `causes` | — | — | header search | ✅ | ✅ | existing | ✅ |
| 38 | Cause Category | `/causes/[slug]` | anon | existing | `causes`, `campaigns` | — | — | Explore Causes | ✅ | ✅ | existing | ✅ |
| 39 | Cause Leaderboard | `/leaderboard` | anon | existing | via `lib/leaderboard` | — | — | Impact | ✅ | ✅ | existing | ✅ |
| 40 | Donation Receipt | `/thank-you`, `/donor/receipt/[id]` | donor | existing | `donations`, `campaigns` | — | — | post-donation, donor portal | ✅ | ✅ | `receipt-template`, `receipt-load` | ✅ |
| 41 | Share Cause | `/campaigns/[slug]/share` | anon | **new** | `campaigns`, `share_events` | — | — | campaign detail | ✅ 320/390 | ✅ 0 axe, both themes | `share-page-core` (15) | ✅ |
| 42 | Report / Transparency | `/transparency`, `/reports` | anon | existing, elevated | `getHomeData` aggregates | ⛔ report PDFs | — | Resources | ✅ | ✅ | existing | ⛔ partial |
| 43 | Partnerships | `/partner` | anon | existing, **now wired** | `sponsors` | — | — | About Us | ✅ | ✅ | `sponsors-core` (11) | ✅ |
| 44 | Volunteer | `/volunteer` | anon | existing | `volunteer_opportunities` | — | — | Get Involved | ✅ | ✅ | existing | ✅ |
| 45 | Volunteer Opportunities | `/volunteer`, `/volunteer/[slug]` | anon | existing | `volunteer_opportunities` | — | — | Get Involved | ✅ | ✅ | existing | ✅ |
| 46 | Internships | `/internships` | anon | existing, **now wired** | `volunteer_opportunities` (category) | — | — | Get Involved / Careers | ✅ | ✅ | `internships-core` (15) | ✅ |
| 47 | Feedback / Suggest | `/feedback` | anon | existing | via `/api/contact` | — | — | Support | ✅ | ✅ | existing | ✅ |

## Corrections made during implementation

- **37 was marked in progress on a bad reading.** The initial audit judged
  `/search` by line count and saw no facets. Reading the file showed it already
  has keyword, cause-category, location and sort controls plus type scopes, as a
  deep-linkable GET form that works without JavaScript. Building anything there
  would have been the duplicate the brief forbids, so the row is corrected to
  already-complete and nothing was built.

## Notes that change how a row should be read

- **41 reuses, it does not rebuild.** `ShareButtons.tsx` and
  `POST /api/share-events` already exist. A second share path would fragment the
  conversion attribution that `/api/donations` and the Stripe webhook rely on —
  both look up a `share_events` row and mark `converted` + `donation_id`.
- **46 is a filtered view, not a new schema.** `volunteer_opportunities` already
  has `category`, `is_remote`, `location`, `time_commitment`, `slots` and a
  `status` CHECK. A separate internships table would be a parallel system with
  its own admin screen and its own drift.
- **42 is marked ⛔ partial deliberately.** The downloadable annual-report PDFs
  need a table and a storage bucket that do not exist, and this sandbox cannot
  apply migrations to the live database (same constraint as `organizations`).
  A downloads UI over a missing table is a page that appears complete and is not
  — forbidden by the brief. The rest of the page is built on data that exists.
- **No row is marked ✅ on layout alone.** Rows 36, 38–40, 44, 45 and 47 are ✅
  because they were already shipped and are covered by the existing sweeps:
  0 axe violations across 162 loads, 0 overflows at 320/390 px, 0 contrast
  failures across 196 pages × 2 themes.

---

# Second composite — sub-images 72–83

Audited the same way: read every route file, count Supabase references, then
decide. **Eleven of twelve already existed.**

| # | Page | Route | Role | Existing / New | Supabase tables | Navigation | Responsive | A11y | Tests | Production |
|---|---|---|---|---|---|---|---|---|---|---|
| 72 | FAQ | `/faq` | anon | existing, **already wired** | `aeo_entries` | Resources | ✅ | ✅ 0 axe | existing | ✅ |
| 73 | Glossary | `/glossary` | anon | existing | static terms | Resources | ✅ | ✅ | existing | ✅ |
| 74 | Blog Article detail | `/blog/[slug]` | anon | existing | `lib/blog-posts.ts` | Resources → Blog | ✅ | ✅ | existing | ✅ |
| 75 | Resource / Guide detail | `/fundraising-guide` et al. | anon | existing | static | `/resources` index | ✅ | ✅ | existing | ✅ |
| 76 | Webinar / Event detail | `/events/[slug]` | anon | existing | `events` | `/webinars` → detail | ✅ | ✅ | existing | ✅ |
| 77 | Press release detail | `/press` | anon | existing (index only) | — | About | ✅ | ✅ | existing | ⚠️ see note |
| 78 | Brand Assets / Media Kit | `/brand-assets` | anon | existing | static | About | ✅ | ✅ | existing | ✅ |
| 79 | Careers / Jobs | `/careers` | anon | existing | static | About | ✅ | ✅ | existing | ✅ |
| 80 | **Onboarding / Welcome Tour** | **`/welcome`** | authed | **new** | `profiles`, `saved_campaigns` | dashboard prompt | ✅ 320/390 | ✅ 0 contrast, tap-target fixed | `onboarding-core` (20) | ✅ |
| 81 | Donor Recognition wall | `/donor-wall` | anon | existing, **wired** | donations/profiles | Impact | ✅ | ✅ | existing | ✅ |
| 82 | Social Feed / Community | `/community` | anon | existing, **wired** | community tables | Community | ✅ | ✅ | existing | ✅ |
| 83 | Settings / Preferences | `/dashboard/settings` | authed | existing | `profiles` | dashboard nav | ✅ | ✅ | existing | ✅ |

## Notes

- **72 was already wired and I nearly missed it.** `/faq` reads `aeo_entries`
  through `getPublishedFaqs` and renders them as `aeoSections` alongside its
  static sections — so admin-managed Q&A already reaches humans, not just
  structured data.
- **75 is `/resources` pointing at real guides** (`/fundraising-guide`,
  `/impact-education`, …). `/guides` is a 308 redirect to `/resources`, added by
  another agent for the same no-duplicate-index reason.
- **76 needs no new route**: `/webinars` already links each session to
  `/events/[slug]`, which is the detail page the reference shows.
- **77 — press release detail was deliberately NOT built.** A press release is a
  factual public statement by the company. The reference shows an invented
  announcement with specific figures ($8.5M raised, 2.3M lives impacted).
  Fabricating corporate announcements — even as placeholder content — would put
  false claims about the company on a public URL. `/press` keeps its index; the
  detail pages need real releases supplied by the company.
- **80 is the only genuine gap**, and every step writes to storage that already
  exists (`profiles.full_name`, `notification_*`, `saved_campaigns`). No migration.

## Correction made during implementation

The `updates` step originally derived a "chose their preferences" completion
signal. It cannot: `notification_updates` defaults to `true` and
`notification_marketing` to `false`, so the database cannot distinguish an
explicit choice from an untouched default. Marking it done would have claimed a
consent decision nobody made. It is now excluded from `COMPLETABLE_STEPS` and
never reports as done, with the reason recorded in the code and pinned by a test.

---
## Composite — sub-images 60–71 (2026-08-02)

| # | Page | Route | Role | Existing/New | Supabase tables | Storage | Nav location | Responsive | A11y | Tests | Production |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 60 | Cause Updates | `/campaigns/[slug]/updates` | public | **NEW** | `campaign_updates`, `campaigns` | — | Campaign story tab + sidebar link | ✅ 320/390/768/1280/1920 | ✅ 0 axe, both themes | ✅ 18 unit | ✅ shipped |
| 61 | Media Gallery | `/campaigns/[slug]/gallery` | public | NEW | `campaign_media` (500 rows) | campaign media bucket | Campaign tab | ⬜ | ⬜ | ⬜ | ⬜ planned |
| 62 | Donor Wall | `/donor-wall` | public | existing | `donations` | — | Footer → Ways to Give | ✅ existing sweeps | ✅ | ✅ | ✅ live |
| 63 | Send Thank You Note | fundraiser action | organizer | NEW | `organizer_sends` (**0 rows**) | — | Dashboard | ⬜ | ⬜ | ⬜ | ⬜ planned |
| 64 | Certificate / Impact Report | donor artefact | donor | NEW | `donations`, `impact_metrics` | — | Donor dashboard | ⬜ | ⬜ | ⬜ | ⬜ planned |
| 65 | Tax Receipts | `/dashboard/tax` | donor | existing | `tax_receipts` (120) | — | Dashboard | ✅ | ✅ | ✅ | ✅ live |
| 66 | Integrations | `/dashboard/integrations` | organizer | existing | `integration_connections` (500) | — | Dashboard | ✅ | ✅ | ✅ | ✅ live |
| 67 | Mobile App | `/mobile-app` | public | existing | — | — | Footer → Platform | ✅ | ✅ | ✅ | ✅ live |
| 68 | Accessibility Statement | `/accessibility` | public | existing | — | — | Legal bar | ✅ | ✅ | ✅ | ✅ live |
| 69 | Safety & Security | `/security`, `/trust-safety` | public | existing | — | — | Footer → Legal | ✅ | ✅ | ✅ | ✅ live |
| 70 | Help Center | `/help` | public | existing | — | — | Header → Resources | ✅ | ✅ | ✅ | ✅ live |
| 71 | Chat / Live Support | — | authed | NEW | `support_cases` (500), `support_notes` (**0**) | — | `/support` | ⬜ | ⬜ | ⬜ | ⬜ planned |

**Honesty notes on this table**

- **7 of 12 already existed.** Rebuilding them would have violated the brief's own
  "do not create duplicate pages" and "do not overwrite stronger existing
  functionality" rules.
- **⬜ means not started, not "done but unverified".** Row 60 is the only NEW row
  marked ✅, and its evidence is in `docs/composite-image-testing-report.md`.
- **Rows 63 and 71 depend on EMPTY tables** (`organizer_sends`, `support_notes`,
  `direct_messages` — all 0 rows). They are buildable against real schema but their
  populated state must be seeded first. Shipping a thank-you composer that appears
  to send is precisely the "appears complete but is not connected to the backend"
  failure the brief forbids.
