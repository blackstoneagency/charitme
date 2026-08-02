# Composite image — page implementation matrix

Status is **measured**, not asserted. "Wired" means a Supabase read or write on
that page's own path, verified by reading the file. A page is not marked Done
because its layout exists.

Legend — Production: ✅ shipped · 🔨 in progress · ⛔ blocked on an owner-only
dependency.

| # | Page | Route | Role | Existing / New | Supabase tables | Storage | Edge fn | Navigation | Responsive | A11y | Tests | Production |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 36 | Global Search | `/search` | anon | existing | `campaigns`, `causes` | — | — | header search | ✅ 320/390 clean | ✅ 0 axe | existing | ✅ |
| 37 | Advanced Search / Filters | `/search` (facets) | anon | existing, elevated | `campaigns`, `causes` | — | — | header search | ✅ | ✅ | 🔨 | 🔨 |
| 38 | Cause Category | `/causes/[slug]` | anon | existing | `causes`, `campaigns` | — | — | Explore Causes | ✅ | ✅ | existing | ✅ |
| 39 | Cause Leaderboard | `/leaderboard` | anon | existing | via `lib/leaderboard` | — | — | Impact | ✅ | ✅ | existing | ✅ |
| 40 | Donation Receipt | `/thank-you`, `/donor/receipt/[id]` | donor | existing | `donations`, `campaigns` | — | — | post-donation, donor portal | ✅ | ✅ | `receipt-template`, `receipt-load` | ✅ |
| 41 | Share Cause | `/campaigns/[slug]/share` | anon | **new** | `campaigns`, `share_events` | — | — | campaign detail | 🔨 | 🔨 | 🔨 | 🔨 |
| 42 | Report / Transparency | `/transparency`, `/reports` | anon | existing, elevated | `getHomeData` aggregates | ⛔ report PDFs | — | Resources | ✅ | ✅ | existing | ⛔ partial |
| 43 | Partnerships | `/partner` | anon | existing, elevated | `sponsors` | — | — | About Us | 🔨 | 🔨 | 🔨 | 🔨 |
| 44 | Volunteer | `/volunteer` | anon | existing | `volunteer_opportunities` | — | — | Get Involved | ✅ | ✅ | existing | ✅ |
| 45 | Volunteer Opportunities | `/volunteer`, `/volunteer/[slug]` | anon | existing | `volunteer_opportunities` | — | — | Get Involved | ✅ | ✅ | existing | ✅ |
| 46 | Internships | `/internships` | anon | existing, elevated | `volunteer_opportunities` (category) | — | — | Get Involved / Careers | 🔨 | 🔨 | 🔨 | 🔨 |
| 47 | Feedback / Suggest | `/feedback` | anon | existing | via `/api/contact` | — | — | Support | ✅ | ✅ | existing | ✅ |

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
