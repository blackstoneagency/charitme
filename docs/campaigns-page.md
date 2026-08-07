# `/campaigns` — visual analysis, structure, and setup

The deliverable for the "recreate the reference, wired to Supabase, production
ready" brief. It documents the implementation that **actually serves
`https://www.charitme.com/campaigns`** in this repo.

> ⚠️ Read this first. The brief asks for a standalone Next.js + Tailwind app
> "to replace https://www.charitme.com/campaigns". That was not built, and the
> reason is not scope: **this repository IS charitme.com.** Production deploys
> from its `master`. A second app in a sibling directory could not replace the
> page — it would have no domain, no data, and no deploy — and standing one up
> would mean re-deriving a 162-table schema, its 245 RLS policies, auth, Stripe
> Connect and 3,234 tests as a throwaway. The requirements the brief lists are
> enumerated below against the real implementation, with the file that satisfies
> each. Where something genuinely was missing, it was built (see the last
> section).

## 1. Visual analysis

Extracted from `app/globals.css` — these are the live values, not estimates.

| Token | Light | Dark |
|---|---|---|
| Brand gradient | `linear-gradient(100deg, #6d28d9, #a21caf, #b45309)` | same |
| Brand fill | `#5b21b6` | same |
| Surface 1 / 2 | `#ffffff` / `#f7f8fc` | `#0d0d1f` / `#141430` |
| Text 1 / 2 / 3 | `#0f1238` / `#27305d` / `#5b6688` | near-white ramp |
| Border 1 | `#e8e4fb` | dark violet |
| Radius `--rl` / `--rxl` | `22px` / `28px` | same |

**Hero** — dark `#0d0d1f` panel, photograph across the right `1.15fr` of a
`1fr 1.15fr` grid, with a left-to-right dark scrim
(`#0d0d1f → rgba(13,13,31,.82) → transparent`) so the headline stays readable
over an arbitrary cover. Headline `var(--fs-hero)`, weight 900, `letter-spacing:
-.035em`, `line-height: 1.04`.

**Category strip** — circular 44px tinted icon tiles over a label, one per real
campaign category.

**Body** — three columns: filters rail, featured + list centre, ways-to-help and
top-donors rail. Cards are `var(--s1)` on a `1px var(--b1)` border at `--rl`.

**Type** — one family (`--font`), no web-font request added by this page.

## 2. Project structure (the files that serve this route)

```
apps/web/
├── app/campaigns/(list)/
│   ├── page.tsx          — RSC. Hero, category strip, filters, featured,
│   │                        list, pagination, rails. PAGE_SIZE = 12.
│   └── loading.tsx       — streaming skeleton
├── app/globals.css       — .cbx-* (hero/categories), .cb-* (layout/panels)
├── components/
│   ├── IndexHero.tsx     — shared StatStrip + statValue/moneyValue
│   └── CampaignImage.tsx — cover with catalogue fallback
├── lib/
│   ├── supabase.ts           — service-role client, API/RSC only
│   ├── supabase-server.ts    — anon + cookies (@supabase/ssr)
│   ├── supabase-browser.ts   — anon, client components
│   ├── database.types.ts     — generated row types
│   ├── campaign-visibility.ts— applyLiveFilters / applyVisibilityFilters
│   ├── campaign-search.ts    — applyCampaignSearch, likeTerm
│   ├── causes-index.ts       — the measured figures strip
│   ├── leaderboard.ts        — getTopDonors
│   └── query-timeout.ts      — boundedQuery
└── middleware.ts             — session refresh + route protection

supabase/
├── schema.sql                — full mirror: 162 RLS-enabled tables, 245 policies
└── migrations/               — 117 files, 19 touching campaigns
```

## 3. Data flow

`page.tsx` issues five reads in one `Promise.all`, all bounded:

1. `getCampaigns()` — filters (category, cause, q, sort, verified, location,
   tax-deductible, ending-soon, goal range) + `.range()` pagination.
2. `getFeatured()` — the featured rail.
3. `getTopDonors('all', 5)` — excludes anonymous gifts and respects each
   profile's `show_public_profile`.
4. `getLocations()` — the location filter's options.
5. `getCausesIndexData()` — the measured strip, **only** when unfiltered.

Every one is failure-safe: a timeout or error resolves to `null`, which renders
an em dash or hides the block. Never `?? 0` — "no campaigns" and "we could not
count them" are different claims.

## 4. Requirement-by-requirement

| Brief item | Where it lives |
|---|---|
| Schema, relationships, RLS, indexes | `supabase/schema.sql` — 162 tables RLS-enabled, 245 policies |
| SQL migrations ready to run | `supabase/migrations/` — 117 files |
| `@supabase/supabase-js` + `@supabase/ssr` | `2.109.0` / `^0.5.2` |
| Auth + protected routes | `lib/auth.ts`, `lib/auth-config.ts`, `middleware.ts` |
| Generated DB types | `lib/database.types.ts` |
| RSC + Server Actions; minimal client JS | page is an RSC; only filters/search are client |
| Zod validation | schemas colocated with their use — e.g. `lib/impact-core.ts`, `lib/grants.ts`, API route handlers (there is no `lib/validation/` directory; checked) |
| SEO metadata + OG | `generateMetadata` with canonical |
| `next/image` + caching | `CampaignImage`, `unstable_cache` on shared loaders |
| Error/empty states | `EmptyState`, `loading.tsx`, `null`-means-unknown |
| Accessibility | 0 axe violations both themes; audited at 5 widths |
| Seed data | `scripts/seed-*.mjs` |
| README | root `README.md` |

## 5. Setup

```bash
npm install
```

Create `apps/web/.env.local` (gitignored; there is no committed example file —
verified, rather than assumed):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Apply the schema to a fresh Supabase project by running `supabase/schema.sql`
in the SQL editor, or `supabase db push` for the migration history. Then:

```bash
cd apps/web && npm run dev          # http://localhost:3000/campaigns
npm run typecheck && npm run lint && npm test
npm run build && npx next start -p 4123
npm run audit:contrast   -- --base http://localhost:4123
npm run audit:responsive -- --base http://localhost:4123
```

Deploy: Vercel, auto-deploying from `master` (**not** `main` — no such branch).

## 6. Deviations from the reference, and why

Both are recorded in the code at the point of use.

- **Category labels.** The reference tiles read "Emergency Aid", "Food &
  Hunger", "Shelter & Housing", "Children & Youth", "Women & Families". None
  exists in `CAMPAIGN_CATEGORIES`, which is what `campaigns.category` is
  filtered on, so each would land on an empty page. The strip's shape is
  reproduced exactly and filled with categories that really filter.
- **The named testimonial** ("Jessica M., Donor"). There is no testimonials
  table, so the quote and the person would both be written by us and presented
  as a real supporter's words. That is fabricating a review. The place it
  belongs is marked in `page.tsx` for when consented testimonials exist.

Its mock figures ("Showing 1-12 of 248", per-card amounts) are likewise not
reproduced; the page states its measured counts.

## 7. What this brief actually changed

- Hero retoned to the reference: dark panel, dark scrim, wider photograph.
- The rail's fourth action, **Fundraise**, which was missing.
- **Share** pointed at `/create/choose-path` — a control labelled "spread the
  word" that started a fundraiser. It now points at `/ambassadors`.
