# Sports & Youth — standalone recreation

A self-contained Next.js 14 + TypeScript + Tailwind + Supabase recreation of
`https://www.charitme.com/causes/sports-youth`.

Separate from the main app on purpose: the live page already exists there and is
covered by ~3,000 tests. This is the extractable version — deployable on its own,
nothing shared.

## Visual analysis

| | |
|---|---|
| Canvas | `#05060f`, hero band `#0a0618` |
| Surfaces | card `#121530`, hover `#181c3c`, chip plate `#1e2348` |
| Borders | `#252948`, strong `#303668` |
| Text | primary `#e2e8f8`, secondary `#b8c2de`, muted `#8090b5` |
| Accents | brand `#b9a5ff`, heart `#ff4d8d` |
| Help badges | violet `#7c3aed`, pink `#db2777`, orange `#ea580c`, green `#15803d`, blue `#1d4ed8` |
| CTA gradient | `linear-gradient(100deg,#6d28d9,#a21caf,#b45309)` |
| Type | system sans; hero `clamp(30px,4.4vw,52px)/850`, h2 `clamp(24px,3vw,38px)/800`, stat `26px/850`, body `13.5–15.5px` |
| Radii | cards `14px`, panels `20px`, chips/buttons full |

Sections, top to bottom: hero with breadcrumb → impact band → filter tabs →
campaign grid → "See more campaigns" → How Your Support Helps (5 photo cards
with circular icon badges) → Stories from the Field (3 cards, play control when
a video exists) → closing band.

## Structure

```
standalone/sports-youth/
├── app/
│   ├── globals.css        Tailwind layers + focus rings + CTA components
│   ├── layout.tsx         metadata, Open Graph, skip link
│   ├── page.tsx           the page — Server Component, concurrent reads
│   ├── loading.tsx        skeleton sized like the content (avoids layout shift)
│   └── error.tsx          route error boundary
├── components/Sections.tsx  Hero · ImpactBand · Tabs · CampaignGrid · Helps · Stories · CtaBand
├── lib/
│   ├── supabase-server.ts   @supabase/ssr, cookie-based, RLS applies
│   ├── supabase-browser.ts  client components
│   ├── database.types.ts    row types matching schema.sql
│   └── queries.ts           reads + money/percent helpers
├── supabase/
│   ├── schema.sql         profiles · campaigns · cause_stories · cause_impact_stats, RLS, indexes
│   └── seed.sql           3 campaigns, 3 stories, 4 impact figures (unpublished)
├── tailwind.config.ts     exact colours, type ramp, radii, gradients
├── next.config.js · postcss.config.js · tsconfig.json · package.json
└── .env.local.example
```

## Setup

```bash
npm install
cp .env.local.example .env.local     # fill in from Supabase → Settings → API
npm run dev                          # http://localhost:3000
```

**Supabase:** create a project, then in the SQL editor run `supabase/schema.sql`,
then `supabase/seed.sql`.

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, bypasses RLS
```

## Two things that need your input

**1. The impact figures.** 125K+ / 68K+ / 1,250+ / 250+ come from the mockup, not
from any database — nothing records "youth impacted". They are seeded
**unpublished**, so the band shows live measured counts until you publish them
and record where they came from:

```sql
update public.cause_impact_stats
   set published = true, source_note = 'FY2026 programme report, p.12'
 where cause_slug = 'sports-youth';
```

**2. The play buttons.** They render only when a story has a `video_url`, so the
control never appears over something that will not play:

```sql
update public.cause_stories set video_url = 'https://…'
 where title = 'From Underdog to Team Captain';
```

## Security

RLS is on for every table. Anonymous readers see active + public + non-deleted
campaigns and published stories only; writes to editorial tables require
`profiles.role in ('admin','super_admin')`. The service-role key is server-only
and must never be given a `NEXT_PUBLIC_` prefix.

## Deploy (Vercel)

Import the repo with **Root Directory** `standalone/sports-youth`, add the three
environment variables, deploy. `revalidate = 60` caches the page for a minute.
