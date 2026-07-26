# CharitMe — Execution Tracker

> **Agent 0 owns this file.** It is the living source of truth for the
> production-readiness program. Section A is the actionable engineering backlog.
> Section B (further down) is the competitive product vision it serves.

## 🤝 BOT LANE SPLIT (Claude ⇄ Codex — do not step on each other)
- **Codex** owns the **dark/light theme sweep** (globals.css theme tokens,
  `[data-theme]` overrides, per-page light/dark, `theme-tokens.test.ts` guard).
  → Claude stays out of theme/globals.css color work.
- **Claude** owns **performance (images/loading), payments/Stripe, image
  uniqueness, feature-wiring, and non-theme accessibility (labels/roles/alt)**.
  → Codex can rely on these not touching theme colors.

## 📌 SESSION HANDOFF — Claude, 2026-07-26 (read this first)

**16 PRs merged to master this session** (#90, #92, #94, #96, #98–#109). Verified state
at handoff: **1378 tests, typecheck 0, lint 0 errors, build green**, a11y **4/4 across
WCAG 2.0/2.1/2.2 A+AA** and all three public sweeps **8/8 against a real production
build**, responsive **222 renders / 0 findings**.

### ✅ A test now enforces the single route list — and immediately found a SIXTH copy

Five copies drifted identically; nothing stopped a sixth. `__tests__/route-list-single-source.test.ts`
fails if any file under `e2e/` or `scripts/` hardcodes ≥10 public-route literals
without reading `e2e/public-routes.json`.

**Its first run found `scripts/audit-scroll-keyboard.mjs` — a sixth list, 21 routes,
which I did not know existed.** It did *not* carry the bad routes, so it was not
producing a false pass, but it would have drifted the moment a route was renamed.

Fixed by **anchoring rather than replacing**: that list is a deliberate SUBSET
(overflow-prone wrappers only), so flattening it to all 37 would change what the
script tests. It now validates every entry against the shared file and exits 1 on a
stray. Mutation-tested — adding `/achievements` yields
`✗ These routes are not in e2e/public-routes.json`. The guard accordingly accepts any
file that reads the shared list, since such a file cannot drift silently.

The guard also pins the original bug directly: no route may appear in both `public`
and `authGated`, and `/achievements` + `/privacy-center` must stay auth-gated.

_Non-vacuity is asserted explicitly (`files.length > 5`, and three named files must be
found) — the same failure mode this test exists to prevent elsewhere._

_Unrelated note: `audit-scroll-keyboard.mjs` needs
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` in this sandbox, like the other
sweeps. It is not broken — it already supports the override. With it: **0
keyboard-unreachable scrollable regions.**_

### The one theme worth internalising
Almost every real bug this session was **a check that passed while measuring the wrong
thing.** Not missing tests — *present* tests and audits reporting green on something
other than what they claimed:

1. A contrast baseline exempting 2 routes for failures that no longer existed.
2. `/achievements` + `/privacy-center` listed as public in **all five** route lists
   while both 307 to `/login` — so five sweeps audited the login page and passed.
3. `audit-responsive.mjs` green through 222 renders while the nav rendered **on top of**
   the header buttons at every width 1101–1800px, sitewide. It measured page-vs-viewport;
   nothing asked whether the page's own controls overlapped.
4. A verification trigger I wrote that **did not fire at all** under the service role,
   because `not (is_admin() or owner_id = auth.uid())` is NULL — not TRUE — when
   `auth.uid()` is NULL.
5. **Seven** pages rendering `$0` as fact when a read failed, including a public claim
   about a named person and a donor's own lifetime giving.
6. `schema.sql` — the mirror that exists to prevent drift — **15 tables behind**.

**Corollary, learned the hard way three times: a scoped grep is not evidence.** My own
audit tooling produced two confident wrong answers (`catch\s*\(` misses `catch {`;
`error\s*:` misses `{ data, error }`), after I had already caught the same mistake
twice in others' work. **Run the fix, re-probe, then read the survivors by hand.**

### Rules now encoded in code, not convention
- A list may be empty; **a statistic may not be invented.** `shouldShowPlatformMetrics()`
  treats an all-zero reading as "no data" — `home.ok` alone is insufficient, because
  `getHomeData` coalesces failed reads to `[]` and returns zeros without throwing.
- **A try/catch that returns zeros is not a guard, it is the bug with extra steps.**
- Only `verified` volunteer hours reach an employer; `totalHours()` returns
  verified/pending/rejected **separately** so no caller can conflate them.
- Any security predicate over a nullable column needs `coalesce` **and** a NULL-case test.
- Sweeps assert the landed path equals the requested one — a redirect now fails loudly
  instead of silently auditing something else.

### What is genuinely blocked on you (no bot can close these)
- **GitHub Actions billing** — every run dies in 2–5s with `runner_id: 0`, on master too.
  Traced to billing in `a0ae222`, not code. **Nothing below is CI-verified.**
- **Vercel** — `api-deployments-free-per-day` cap hit repeatedly.
- **Supabase / Stripe / Resend credentials** — these block the ≥100 seed records, any
  real paid flow, and a signed-in a11y sweep of `/dashboard`, `/admin`, `/create`.
  That auth-gated surface is a **confirmed unmeasured** gap, not a vague one.
- **`qrcode` dependency** for CHAR-1102's QR image. Adding a runtime dependency to a
  payments platform is your call; the check-in flow works by typed code without it.

### Best next slices for another agent (non-gated)
1. ~~`scripts/audit-contrast.mjs` still has its own hardcoded route list~~ **✅ DONE
   (Claude, 2026-07-26).** Migrated to `e2e/public-routes.json` + landed-path check.
   All five route lists are now one. Its old comment claimed it was "kept in sync …
   so the three sweeps cannot drift apart" — via a hand-maintained copy, which is
   exactly how they drifted. Re-run on the CORRECT 37 pages: **0 AA failures across
   37 × 2 themes**. Guard proven non-vacuous — `--only /achievements,/privacy-center`
   now yields `✗ REDIRECTED to /login; not measured` (4 failures) instead of quietly
   measuring the login page's colours and passing.
2. Marketing OS backlog: multi-tenancy (§7), approval engine (§30), roles (§9),
   GA4/Search Console read-only connectors (§32).
3. Re-run `su postgres -s /bin/bash -c ./scripts/regen_schema.sh` after **every**
   migration — `initdb` refuses to run as root, which is why the mirror drifted.

## 🎯 PRODUCTION-READINESS GOAL — live status (updated this session)

| Goal item | Status | Evidence / blocker |
|-----------|--------|--------------------|
| Images unique, 0 duplicates | ✅ done — **now verified at BINARY level** | covers 50→**500 distinct** URLs (migration applied live). **URL-uniqueness was NOT sufficient:** a dHash audit of the actual image binaries (IMG-06) found different Picsum ids resolving to identical photos — 1 exact pair + 20 near-dupes. 9 campaigns reassigned to hash-verified-distinct images; **re-audit: 0 exact, 0 near-duplicate across all 500.** `scripts/audit-image-dupes.mjs` gates this in CI. **Re-verified this session: `photo-catalog.ts` fallback pool has 0 within-category duplicates** (every category's list is all-distinct); only intentional cross-category community/sports fallbacks overlap. New Unsplash IDs not added — they can't be HTTP-200-verified from the sandbox, and unverified IDs would risk broken images | | **PRODUCTION-VERIFIED 2026-07-23:** fetched `/campaigns` from `www.charitme.com` and extracted every cover image — **60 images, 60 distinct, 0 duplicates**. (Covers are `picsum.photos` placeholder stock, which is expected for seeded demo campaigns and is CSP-allowed; the uniqueness requirement is met either way.)
| ≥100 seed records/feature | ✅ done | 73 non-empty tables, every feature ≥100 | | **INDEPENDENTLY VERIFIED IN PRODUCTION 2026-07-23** (public read-only APIs, no DB credentials needed — this criterion was previously marked done on the seed suite's own report, never checked from outside): **`matching_programs` = 120 distinct ids** (`/api/matching/programs?limit=500`) and **`volunteer_opportunities` = 120** (`/api/volunteers/opportunities`, paginated `limit=100&offset=0,100` → 100 + 20). Both **≥100 confirmed against the live database**. `sponsorship_opportunities` could only be read at ≥60 because its GET handler hard-defaults to `limit 60` and doesn't forward a `limit` param, so its true count is not observable this way (not evidence of a shortfall). **Method for the remaining tables:** any public list API that accepts `limit`+`offset` can be paginated the same way; tables with no public endpoint still need the owner's `99_verify_counts.sql`.
| Security (RLS) | ✅ verified | **143/143** public tables RLS-on; **fixed live Stripe webhook + disabled rogue endpoint** | | **Secret-exposure audit (2026-07-23) — scope-defining result:** scanned **all 487 commits** of git history for `sk_live_*`/`sk_test_*`/`whsec_*`/`AKIA*`/PEM private keys → **zero hits**. Only `.env.example` is tracked (placeholders + an explicit "never put real secrets here" header); `.gitignore` covers `.env`, `.env.local`, `.env.*.local`. Also verified **no server secret reaches the browser bundle**: no `'use client'` module reads `process.env.<SECRET>`, and no secret is aliased onto a `NEXT_PUBLIC_*` var. (Two grep hits were false positives — admin setup UI rendering the var *name* as instructions, and an operator-facing error string.) **Conclusion: the key exposure was never in git, so no history rewrite/purge is needed** — rotation scope is limited to wherever the keys were actually shared (chat/logs/dashboard). New regression test `__tests__/no-client-secrets.test.ts` (3 tests) locks the client-bundle invariant; verified non-vacuous by planting a real leak and watching it fail. | **🔴 robots.txt was NOT protecting private routes (found + fixed 2026-07-23).** `app/robots.ts` defines 20 `Disallow` rules (/dashboard, /admin, /api, /login, /donor, /profile, /create, …), but a stale **`public/robots.txt`** (committed 2026-07-19, 4 lines: `Allow: /` only) **shadowed the App Router metadata route** — files in `public/` win. So the served robots.txt had *zero* Disallow rules and crawlers were told every private/auth-gated route was fair game. Deleted the static file; served robots.txt now carries all 20 rules (verified over HTTP). No `public/sitemap.xml` or manifest shadowing anything else. Sitemap itself validated: 1258 URLs, 40 static ones sampled → 0 broken, no private routes listed.
| Payment webhooks | ✅ fixed | prod webhook 2→**20 events**; recurring/subs/refunds now delivered |
| Everything wired to Supabase | 🟢 mostly | core flows + new analytics table verified live | | **PRODUCTION-VERIFIED 2026-07-23** (read-only GETs against `www.charitme.com`, real DB — the sandbox's lack of a database turned out **not** to be a hard ceiling for read checks): `/api/health` → `{status:ok}`, and every public list page renders real Supabase rows — /campaigns 60, /leaderboard 20, /grants 48, /volunteer 48, /events 60, **/matching 121**, /sponsor 61, /success-stories 9 distinct record links. These are page-limited views so they don't by themselves prove ≥100 rows per table, but they do prove **the features are genuinely wired to Supabase and serving real data in production**, not just in code.
| Tests pass / Build succeeds | ✅ | **921/921**, `next build` green, typecheck clean, lint 0 errors (2026-07-23). New this session: tax (12), referrals (7), netToFundraiser/0%-fee invariant (3), **safeNextPath open-redirect guard (8)** — every `@shared/fees` money fn + the post-login redirect sanitizer now tested |
| Tax reporting (donors + campaigns) | ✅ done | **donor annual giving statements** (JSON/CSV/printable, deductibility + EIN, IRS disclosure), **fundraiser year-end summaries**, and **automatic official tax receipts** for verified-nonprofit gifts — all Supabase-wired, 12 unit tests (`lib/tax.ts`). PR #50 (merged) + PR #51 |
| Accessibility | ✅ strong | **prod Lighthouse — 7 key pages all 100**: home, how-it-works, campaigns, faq, for-donors, for-nonprofits, pricing. SEO 100, BP 96. **axe-core WCAG 2.0/2.1 A/AA → 0 violations across 15 public routes** after fixing /features dark-card contrast (new `--violet-ink` token), /for-individuals emerald buttons, /about-us timeline-year, and a role-less aria-label on `/` (PR #49) | **2nd pass -> 0 violations on 5 more routes** (/supported-countries, /help, /transparency, /trust-safety, /fast-payouts) (PR #52) - **20 public routes now axe-clean** | **Keyboard/focus audit (2026-07-23) — found 2 real WCAG gaps axe could NOT detect** (which is why the earlier axe passes read 0 violations): (1) **WCAG 2.4.1 Bypass Blocks — no skip link existed anywhere in the app**, so keyboard/AT users tabbed the whole header (~15 stops) on every page. Added a visually-hidden `.skip-link` -> `#main-content` in the public shell; verified on 6 pages (first Tab reaches it, it becomes visible, Enter moves focus to main). (2) **WCAG 2.4.7 Focus Visible — ~25 `outline: none/0` rules** stripped the focus ring from inputs/selects/textareas sitewide. Added a global `:focus-visible` ring (with a dark-mode variant); the /transparency calculator's inline-styled buttons didn't pick it up, so they got an explicit `.mc-choice:focus-visible` box-shadow ring. **Measured: pages with missing focus rings 9 -> 0; skip link present on 6/6 pages; axe re-run 0 violations (no regression).** Also: **broken-link crawl — 464 distinct internal links across 31 public pages, 0 broken.** | **axe `best-practice` ruleset + SEO metadata sweep (2026-07-23).** Earlier axe runs used only the WCAG tags, so axe's *best-practice* rules (heading-order, landmarks, region, page-has-heading-one) had never run — re-ran them across 24 public routes: **clean**. Separately audited SEO metadata on **33 routes** (title/description/canonical/h1 presence, length limits, cross-page duplication) and fixed 2 real defects: **`/ai-campaign` had no `<h1>` at all** (its only heading was an `<h2>`; promoted it — styling is class-based so the change is purely semantic), and **4 meta descriptions exceeded the ~165ch SERP limit** (/fees 173, /for-individuals 167, /transparency 201, /fast-payouts 172) so they truncated in search results — rewritten to 149–160ch. _Note: promoting the h1 introduced an h1->h3 skip (the shared footer headings are h3), caught by re-running axe; fixed by promoting "Popular requests" to h2._ **Final: axe wcag+best-practice 0 violations, SEO clean (unique titles/descriptions/canonicals, exactly 1 h1 per route).** | **Reduced motion (2026-07-23):** stylesheet had ~16 animations / ~120 transitions but only 2 `prefers-reduced-motion` rules, so users who ask their OS to reduce motion (vestibular disorders, migraine) still got nearly all of it. Added a global reduce block. **Measured on the homepage: elements with real animation 15→0, with real transition 92→0** when the preference is set. | **FULL two-theme sweep 2026-07-23 — this is what a *complete* pass looks like, and it found bugs the earlier subset sweeps missed.** Ran axe (wcag2a/aa + wcag21a/aa + **best-practice**) over **40 public routes × BOTH themes = 80 renders**. Every earlier sweep had tested a *subset of routes in the default theme only*. Result: **clean 62 → 75 of 80** after fixing: **`.sc-country-card` hardcoded `#fff` under dark-mode token text = 1.22:1 across ~138 nodes on `/supported-countries` in the DEFAULT theme** (the same bug class as `.sc-info-card` in PR #52, on a class I'd missed); `/login` nesting a second `<main>` inside AppShell's (duplicate-landmark, which also surfaced on every auth-gated route that redirects there); `.blog-meta`, `/grants` urgent-deadline and `/volunteer` capacity chips using **brand fill tokens as small text** (`--red`/`--green` instead of the existing AA-safe `--red-text`/`--green-text`); `.aif-prompt-hint`; `/for-donors` `text-slate-400`; **`Btn variant="primary"` — white on `--green` is 3.17:1, an AA failure on the shared CTA sitewide** → new `--green-btn` (#0b7a3e, ~5:1, fixed across themes); `/offline` had no `<h1>` at all. ~~**Residual (5/80, all judged not worth the fix):** brand-coloured accents on `/pricing`, `/ai-fundraising`, `/ai-campaign` in *light* mode only, and `/offline` `heading-order`.~~ **Superseded 2026-07-26 — the WCAG A/AA residuals are gone, not waived.** The brand-accent contrast failures were fixed by the `--green-btn` token work; a settling re-sweep of the two baselined pages returned 0, and `e2e/accessibility.spec.ts` now runs with **no baseline and no exemptions** — 36 routes × light/dark × chromium/mobile, all green. The only surviving item is `/offline` `heading-order`, which is **best-practice-only, not WCAG A/AA**, so it is outside the enforced ruleset by design rather than by exclusion.
| Dark/light mode every page | ✅ done (app) | **#43/#46/#47**: every dashboard view + campaign panel + simple public pages converted hardcoded light palettes → design tokens; **regression guard** (`__tests__/theme-tokens.test.ts`) blocks reintroduction — **now covers dashboard + donor (incl. tax statements) + profile** (PR #51), all verified dark-safe (no bare `#fff`/dark-text literals). Branded marketing pages keep intentional brand palettes; admin console is intentional light-only internal tooling |
| Frictionless UX | 🟢 improving | draft autosave/recovery + funnel analytics shipped; builder roadmap continues. **PR #51:** Escape-to-close on user-facing modals + keyboard-operable rows/toggles; **loading skeletons** for donor portal + volunteer/matching/sponsor/events lists (shared `ListPageSkeleton`) + a **dashboard-wide `loading.tsx` inside `CharitMeShell`** covering all 30+ dashboard routes with the sidebar preserved (no shell-in-layout refactor needed — the client shell renders static nav with no data fetch) **and a matching `admin/loading.tsx`** (~30 admin routes). Public campaigns/detail/donors/leaderboard already had skeletons. **Loading states now span the entire logged-in surface + public lists.** **Resilience:** added `global-error.tsx` (root-layout failure boundary, self-contained branded fallback) alongside the segment `error.tsx`. | **Interaction smoke test (prod build):** /transparency calculator, /help search+category filter, /pricing fee presets all respond with 0 console/page errors.
| Mobile | 🟢 | mobile Lighthouse on public pages good; **browser audit (320/390px × 19 public routes) → 0 horizontal overflow** (PR #49). **Admin sweep (PR #51):** capped every fixed-width admin drawer/modal (Users/Content/Payouts detail slide-overs 460–560px + Content edit/confirm modals) with `maxWidth: 100vw`/`calc(100vw-32px)` — were overflowing phones; integrations modal already `.kf-modal-responsive`. Decorative absolute blobs are clipped. **Dashboard verified clean:** all fixed-width modals use `.kf-modal-responsive` (cap `calc(100vw-32px)`), both `<table>` views have overflow-x scroll wrappers, no uncapped fixed widths. Mobile now covered across all 3 layers (public/admin/dashboard) |
| Performance | 🟢 improving | **Query audit (PR #51):** no N+1 in any `page.tsx` (batched `.in()` lookups); public/admin list views paginated (`.range`/`.limit`); remaining full-table reads are bounded `.in(ids)` name-maps or aggregation queries that need all rows to sum (profile/admin totals) — fine at seed scale, flagged to move to DB-side `sum()` RPCs before very large scale (admin-only, low traffic). **Query-waterfall fixes (PR #51):** donor portal 4 serial round-trips → 2 (parallelized donations‖recurring, campaigns‖launch-settings); public donor profile deduped `getProfile` (was 2× per request) via React `cache()` + parallelized donations‖recurring-count; recurring dashboard parallelized campaigns‖launch-settings; **campaign detail (hottest public page) deduped `getCampaign`** (was 2× per request: metadata + page) via React `cache()` — its 10 campaign-dependent reads were already batched. **Double-fetch dedup sweep complete** across all dynamic detail pages: campaigns/[slug], donors/[id], matching/[id], sponsor/[id] (each getter now `cache()`-wrapped, one query/request instead of two). **`getUser()` memoized** (`lib/auth.ts` React `cache()`) — the session JWT-validation call ran 2–3× per authenticated request (layout + page + shell); now once. Broadest single win: touches every logged-in page render. prod home **63→88** (LCP 4.1→3.1s, TBT 640→100ms) by fixing the 292KB→6.7KB oversized logo. **Discovery grid (PR #51):** 60-card `/campaigns` covers converted CSS `background-image` → lazy `<img loading=lazy decoding=async>` so offscreen covers defer (was fetching up to 60 upfront). Campaign covers elsewhere already lazy via `CampaignImage` default. Bundle audit: shared JS ~103kB, no outliers. Remaining: unused CSS/JS (lower value) | **CLS fix (PR #52):** AnnouncementBanner injected post-hydration above <main> causing whole-page downshift; now SSR-ed via cached helper (lib/announcements-data.ts, unstable_cache+60s ISR) with useSyncExternalStore dismissals, root layout stays static -> **home DESKTOP 99->100 / CLS 0.029->0; MOBILE CLS 0.124->0**. **Image-weight fixes (Claude):** sitewide logo 292KB->6.7KB, hero PNG->WebP 211KB->12KB, and ALL campaign covers right-sized WebP via `optimizedCoverUrl` (45.7KB->11.1KB per cover, -76%) across campaigns/success-stories/donors/leaderboard/similar-rail. **Prod Lighthouse mobile: home 92, campaigns 93** (were 63/85); server response 0.26-0.53s/page. | **CWV sweep across 30 public routes (2026-07-23, Playwright PerformanceObserver — no new dep):** LCP/FCP/TTFB/CLS/long-tasks/DOM captured for every public route; all LCP < 900ms, no long-task outliers. Found + fixed **2 real defects the earlier audits missed**: (1) **`/sponsor` CLS 0.958** — `SponsorMarketplace` refetched the *identical* unfiltered list on mount, swapping the SSR'd grid for a centred spinner and back (wasted round-trip + huge shift on every visit); added the same skip-on-mount guard `VolunteerClient` already uses -> **CLS 0.958 -> 0.183**. (2) **mobile overflow masked by empty sandbox data** — `repeat(auto-fill, minmax(320px,1fr))` on **`/campaigns` (main discovery page, scrollWidth 344 @320px)** and `/impact` (324); wrapped in `min(100%, Npx)` like PR #49 -> both OK. Also hardened `/sponsor` + `/success-stories` grids (same bug, currently masked because their lists render empty without a DB). **Residual:** all 4 skeleton-backed list pages share an identical 0.183 shift from the `ListPageSkeleton` -> content swap; its true magnitude depends on real row counts, so sizing the skeleton against the sandbox's empty state would be wrong for production — **left for a staging measurement**. **Interaction latency (INP) measured 2026-07-23 — Event Timing API over 8 interactive public pages, 26 real clicks (fee presets, billing toggle, money-calculator tiers/methods, help category pills, FAQ accordions, story filters):** worst INP **64ms**, event-handler work 2–3ms, **0 interactions over 200ms** — comfortably inside Google's "good" INP band (<=200ms). So "quick and responsive when buttons are clicked" is now *measured*, not assumed. | **Runtime-config verification sweep (2026-07-23) — checked what is actually SERVED, not what the code says.** **Security headers: verified sound over HTTP** — CSP with per-request nonce + `strict-dynamic`, HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and the embed carve-out works correctly (`frame-ancestors *` on `/campaigns/*/embed`, `'self'` everywhere else, X-Frame-Options dropped only for embeds). No defects. **Service worker: audited sound** (network-first navigations so no stale HTML, `/api/` never intercepted, versioned cache cleanup) **but found a real staleness bug** — it runtime-caches *non-content-hashed* public assets cache-first indefinitely, and `CACHE_VERSION` was never bumped after the logo was re-encoded 292KB→6.7KB (`175ec23`), so every returning visitor was still being served the **old 292KB logo**, silently negating that merged perf win. Bumped to `v2`.
| Payment methods end-to-end | 🟡 owner/test-keys | live account charges-enabled, 15+ methods active, price ids resolved; a real paid flow needs Stripe **test** keys or owner go-ahead (ADR-0003) |
| Every page audited / every feature works | 🟡 ongoing | unbounded; audited builder + discovery + payments deeply. **~30 public routes now browser-audited (axe WCAG A/AA + 320/390px overflow) → all clean**. **Dynamic `[slug]` routes now covered too (2026-07-23):** the 8 SSG ones (`/features/[slug]`, `/blog/[slug]`) browser-audited → 0 violations / 0 overflow after fixing a dark-mode CTA contrast bug (light `--t1` ink forced onto the emerald button, 2.06:1 → 7.9:1); the Supabase-backed ones can't render in-sandbox (no DB) so they're covered statically — **theme regression guard extended to `campaigns`/`donors`/`matching`/`sponsor`/`volunteer`/`events`/`grants`/`impact`** (verified non-vacuous). **Every public surface is now audited by browser or guard.** Remaining unaudited: auth-gated dashboard/admin/create (owned by parallel bots) |

**Sandbox hard-limits (2026-07-23, exhaustively confirmed).** The two open goal
items — **≥100 live seed records** and **real paid-flow across all payment
methods** — cannot be executed from this CI/agent sandbox by ANY means, verified:
(a) `SUPABASE_SERVICE_ROLE_KEY` / `STRIPE_SECRET_KEY` / Supabase URL+anon key are
all **unset** here (only a placeholder `.env.local`); (b) **no Docker daemon**
(`/var/run/docker.sock` absent) so `supabase start` / a local Postgres container
is impossible; (c) no standalone Postgres server. So seeds can't be run/verified
and no real charge can be placed from here — these are **owner steps by design**
(ADR-0003), made turnkey: one-command psql seed runner (`supabase/seeds/README.md`)
+ `docs/DEPLOY_STRIPE.md`. Everything else in this program is done/green in-sandbox.

**Owner actions still blocking full production-readiness** (step-by-step in
**`docs/DEPLOY_STRIPE.md`**): (1) set Stripe env in **Vercel** (`STRIPE_SECRET_KEY`,
publishable, `STRIPE_WEBHOOK_SECRET`, 4 price ids, tip%) — **✅ DONE & verified
live** via `/api/health` (stripeKey live, publishable/webhook secret set, supabase
connected); (2) ✅ **eli54u.com webhook DELETED** (Stripe API, `deleted:true`; only
the legit charitme endpoint w/ 20 events remains); (3) provide **OpenAI** +
**Unsplash** keys; (4) decide **publish-before-payout** (biggest builder drop-off lever).
**Resolved:** `STRIPE_CONNECT_WEBHOOK_SECRET` is **NOT needed** — verified in the
webhook handler (tries `STRIPE_WEBHOOK_SECRET` first, filters unset secrets); the
single endpoint receives all Connect events signed with the main secret. Leave unset.

> **Payment Workflow Hardening pass (2026-07-21)** — see **Section D** at the end
> of this file and the companion **`payment-audit.md`** for the exhaustive
> per-workflow audit + fixes.

## 🔎 Claude session index — 2026-07-26 (create flow, settings, schema, docs, PRIVACY, SECURITY, TRUST&SAFETY)

### 🧭 THE PROMISE AUDIT — 16 controls checked, 13 defects, 3 clean

The single most productive method this session: **take a control that promises the
user something, then verify every path that must honour it.** Every defect below is
the same failure — *the write path worked; a read or enforcement path never got the
memo.* Full detail for each is further down this section.

**Family 1 — a user's choice that one read path ignored (7):**
delete campaign (content stayed public at the direct URL) · Profile→Private (named
on leaderboard + donor wall) · Profile→Private (named on the **homepage** ticker) ·
donate anonymously (identity in the organizer's export) · donate anonymously (named
in supporters list) · donate anonymously (name+avatar in messages route) · save as
draft (unpublished campaign fully readable).

**Family 2 — a number whose label doesn't match what it counts (4):**
goal suggestions inflated 2.5× · category list drifted to 11 of 18 · trust&safety
dashboard showed `.length` of a 50-capped list as the backlog **total** · donor
"Total Given" summed only the most recent 100 gifts.

**Family 3 — an admin control that writes a flag nothing enforces (3, all fail-OPEN):**
**user suspension does nothing** · **payout freeze cannot work** (destination
charges — the platform never holds funds) · team roles promise capabilities no
route checks. Plus `pinned`, written and never read.

**Clean, and all three are money paths** — recurring cancel/pause (Stripe-first
ordering so a DB failure never costs the donor), refunds (partial refunds open a
reconciliation exception rather than guess a split), unsubscribe suppression.
**That is the actionable signal: the money code has a review standard the rest of
the app doesn't, and the defects cluster exactly where it doesn't reach.**

### ⚠️ Biggest open items (all need a decision or access I don't have)
1. **User suspension has no effect** — needs an enforcement point (product/legal call).
2. **Payout freeze cannot work** — architectural; 3 options recorded.
3. **Team/user roles enforce nothing** — needs a permission model decision.
4. **61 drifted DB columns / 21 tables** — `scripts/gen_drifted_columns_migration.sql`
   turns this into one paste against the live DB.
5. **Unbounded donation aggregates** (tax statement, exports) — fix is `count:'exact'`
   + truncation notice; **do not** just add a `.limit()`, that could *introduce* truncation.


### 🚨 CI ON MASTER HAS BEEN RED FOR 30+ CONSECUTIVE RUNS

**Nobody's changes are being validated right now** — not mine, not the other
agents'. This spans many authors and includes **docs-only commits**, which cannot
break a build, so it is environmental rather than caused by any one change.

**What I verified locally (all pass), reproducing CI's exact conditions:**
`npm ci` (clean, strict lockfile) → typecheck → lint → **1278 tests** → image
audit → production build **run with CI's own placeholder Supabase env**
(`https://placeholder.supabase.co`). Every step exits 0. I could not reproduce the
failure.

**What I could not do:** read the CI logs. Both failed jobs' log blobs return
**HTTP 404** from this session, so the failing *step* is unknown.

**Strong hypothesis for the `e2e (playwright)` job:** it builds and runs against
**placeholder Supabase credentials**, so every spec touching a DB-backed page
(`/campaigns` and friends) has no data and will fail or time out. This is exactly
the concern recorded earlier when I declined to wire e2e into CI myself — that it
"needs a decision on whether the runner gets Supabase credentials." It was wired
in without that decision. The `public-routes` spec already timed out on
`/campaigns` locally for the same reason.

**✏️ MY LEAD WAS WRONG — superseded by a better diagnosis (now in CLAUDE.md).**
I hypothesised the `e2e` job was failing because it runs against placeholder
Supabase credentials, and offered a local hang as support. **Retracting that.**
Another agent established the real cause: **every run dies in 2–5 seconds**, before
executing *any* step. A genuine run (`npm ci` + build + 1281 tests + Playwright)
takes minutes, so nothing in the workflow — e2e included — is even reached.
**It is an account/runner problem, not a code problem**, most likely exhausted
GitHub Actions minutes or billing (the same account returns
`api-deployments-free-per-day` from Vercel on every push).
**Owner fix: Settings → Billing → Actions.**

Every symptom I gathered independently corroborates that diagnosis rather than
mine: the rerun failed almost immediately, logs 404, docs-only commits fail
identically, and all five steps pass locally including under CI's own placeholder
env. My 8-minute local hang was sandbox DNS resolving `placeholder.supabase.co`
slowly — the exact caveat I flagged when recording it, and the reason it was
written as a lead rather than a conclusion.

**Lesson worth keeping:** a plausible mechanism that explains the symptoms is not
the same as the cause. "Fails in 2–5 seconds" was the decisive datum, and it was
available from the run timings the whole time — I reasoned from *what could break
e2e* instead of from *how long the job actually ran*.

**Next step is 30 seconds for a human and impossible for me:** open the latest run
in the GitHub UI and read which step is red. If it is the e2e job, either give the
runner real (read-only) Supabase credentials, or scope the e2e job to the specs
that don't need a database (`smoke`, `security-headers` — both verified green
locally).

**My own failure here, stated plainly:** I confirmed CI green early in the session
(`aca2238`, `ea366df`, `0595dae` all `success`) and then stopped re-checking,
reporting "verified" on the strength of local gates alone for many commits
afterwards. Local green is necessary but **not** sufficient — it does not see the
runner's environment. Re-check CI after pushing, not once per session.

### ⚠️ START HERE — the 3 things that still need a decision from the owner

Everything else below is fixed and shipped. These three are **not blocked on
effort or investigation** — each needs one judgement call, and guessing wrong
would cause real harm (locking people out, or publishing new claims about donor
money). Implementation notes for each are in the detail section.

| # | Needs deciding | Why I did not just do it |
|---|---|---|
| 1 | **"Suspend User" enforces nothing** — suspended users can still log in, donate, create campaigns | Must decide *which* surface is blocked (login? donating? creating?) and what happens to a suspended user's live campaigns and active recurring donations. Note: gating via `getUserRoles()` **cannot work** — `parseRoles()` whitelists `'suspended'` away |
| 2 | **`/trust-safety` promises a "7-day payout hold"** the architecture forbids — every donation is a Stripe *destination charge*, so CharitMe never holds the funds | Either implement via Stripe Connect (manual payout schedule / `payouts_enabled`), or correct the public copy. Both are legitimate; publishing a safety promise the code cannot keep is not |
| 3 | **Roles don't differentiate** — `donor`/`organizer`/`beneficiary`/`nonprofit` gate nothing; only `admin`/`super_admin` do | Someone must define what an organizer may do that a donor may not. Inventing permissions on live authorization locks real users out of their own campaigns |

### ✓ Controls audited and found CORRECT — do not re-investigate

Recording these so the next agent doesn't spend a session re-deriving them:

| Control | Why it's correct |
|---|---|
| **Email preferences** | Genuinely honoured end-to-end. `notification_email` gates transactional mail (`stripe/webhook` returns early on `=== false`, 2 sites); `notification_updates` gates campaign-update mail (`campaigns/[id]/updates` skips opted-out donors). `notification_marketing` is written as a real opt-in (defaults FALSE) with no sender yet — a toggle ahead of its feature, not a leak |
| **Team member removal** | Hard `.delete()` behind an ownership check, and access reads query `team_members` live per request — revocation is immediate, nothing cached |
| **Campaign reporting** | Rate-limited, validated, inserts `status:'open'`, **and checks the insert error** — the route even carries a comment reasoning about this exact failure mode. The button only shows "sent" on `res.ok` |
| **Refunds** | Defer to the webhook's `decrement_campaign_stats` rather than decrementing locally, avoiding a double-count |
| **Recurring cancellation** | Cancels at **Stripe first**, then marks the row — deliberately avoiding the ordering where the UI says "cancelled" while charges continue |

**⚠️ Methodology warning, from three near-misses this session.** Every false lead
came from the same mistake: **judging from a fragment instead of the whole
result.**
1. `grep` showed `.from('campaigns').select(...)` with no filters → looked like the
   sitemap leaked private campaigns. The filters were in the *enclosing*
   `applyLiveFilters(...)` call.
2. A truncated `grep … | head -6` hid `campaigns/[id]/updates/route.ts` → looked
   like `notification_updates` had no consumer and the toggle was dead. It is
   honoured on line 116.
3. `getSimilarCampaigns` looked unfiltered for the same reason.
**A grep hit is a hypothesis. Open the file and read the enclosing expression
before believing it — and never conclude "no consumer" from a `head`-truncated
list.**

### 🔒 Promise-audit — controls that did not keep their promise

The highest-yield technique of the session: **take a control that promises the
user something, then follow the data to every place that promise must hold.**
Nine of eleven controls checked had a gap, all the same shape — *the write path
worked; one read path never got the memo.*

| Control | What leaked / failed | Status |
|---|---|---|
| Delete campaign | Content stayed public at the direct URL | ✅ fixed |
| Profile → Private | Named on leaderboard + donor wall | ✅ fixed |
| Profile → Private | Named on the **homepage** ticker | ✅ fixed |
| Donate anonymously | Identity in the organizer's full export | ✅ fixed |
| Donate anonymously | Named in the supporters list | ✅ fixed |
| Donate anonymously | Name + avatar in the messages route | ✅ fixed |
| Save as draft | Unpublished campaign fully readable | ✅ fixed |
| **Enable 2FA** | **Protected nothing** — never challenged at login | ✅ **fixed** |
| Suspend user | Enforces nothing | ⚠️ decision #1 |
| Payout hold | Architecturally impossible as written | ⚠️ decision #2 |
| Email opt-out | — | ✓ was already correct |
| Refunds / recurring cancel | — | ✓ were already correct |

**Detail for every row lives under §0.1b item 10** (it grew there because that
item was the entry point); this index exists so the work is findable by topic
rather than buried under a locale-switcher heading.

### Earlier fixes this session

| # | Fix | Why it mattered |
|---|-----|-----------------|
| `2fb05a1` | Follow-up picker offered **11 of 18** categories | Sports/Competition/Event/Family/Travel/Volunteer/Wishes unselectable — a cheer or team campaign had to file as "Other" |
| `73a46c6` | `'pet'` matched com**pet**ition → every competition filed as **Animal** | Plain `includes()` fired mid-word; `'cat'` also hit vacation/dedicated. Cheer, band, guitar matched nothing at all |
| `4304251` | Default title read **"Support my the team"** | Broken English on 11 of 18 categories, in the first field an organizer sees |
| `2b81ad7` | Small asks inflated **2.5×** ($40 → $100) | Hardcoded floor 100× the real publish minimum; **an existing test asserted the bug** |
| `c2b4395` | **Privacy control that never saved** | Profile Visibility rendered in Security, persisted only by Preferences' Save → set to Private, navigate away, silently still public |
| `c2b4395` | `notification_updates` column wired to **nothing** | Real column, zero references, opposite a dead toggle — two halves of a wire |
| `5a842eb` | Deletion request was a `mailto:` | Real Supabase flow existed at `/privacy-center` with status tracking + audit trail |
| `ee733ea` | CLAUDE.md documented a **5% platform fee**; code charges **0%** | Trap: `platformFee()` still exported, so an agent could "restore" fee-charging on live donations |
| `381bf45` | **18 of 27 env vars undocumented** | A deploy following the doc loses payout webhooks, subscription price IDs, and all outbound email — with no startup error |
| `67bd81b` | 7 `profiles` columns existed live but in **no migration** | Fresh provision → broken Settings tab. **Corrected my own earlier claim** that this needed DB credentials |
| `1efe17a` | **Commits were signed all along** | Corrected my own repeated wrong diagnosis; `%G?`=`N` means "cannot verify" (no `ssh-keygen`), not "unsigned" |

**Totals:** 10 dead controls removed, 5 real controls added/repaired, 8 sections
audited, 12 routes runtime-smoke-tested. Tests **1137 / 98 files**, build green.

**Negative results recorded on purpose** (so nobody re-chases them):
- `/` and `/campaigns` are *not* slow — the ~7.3s is sandbox↔Supabase latency,
  `campaignColumns()` is memoized, and the two queries have a genuine data
  dependency (the second consumes `campaigns.map(c => c.id)`).
- **The money path is clean end-to-end.** Fee math probed across 66
  amount/cover/tip combinations plus the custom-override branch → **0 invariant
  violations** (a flagged case turned out to be a negative tip correctly clamped to
  0). Donation input validation in `app/api/donations/route.ts` is bounded by the
  **shared** `MIN_DONATION_CENTS`/`MAX_DONATION_CENTS` rather than hardcoded copies
  — i.e. it does *not* have the drift bug `campaign-intake` had — with integer
  cents, tip capped 0–100%, `.email()` on donor email, and every string
  length-capped.
- **The donate form (`DonateButton.tsx`) is clean** — checked with the same
  "control missing from the payload" method that found 10 dead controls in
  Settings, since this is the money path. Every piece of form state reaches the
  POST body. `rewardId` is sent only for one-time gifts, and the reward UI is
  guarded by the *same* `!isMonthly` condition, so the two cannot disagree.
  Rewards also auto-deselect in **three** places if the donor lowers the amount
  below a tier's minimum. Switching once→monthly leaves `selectedRewardId` set in
  state, but both the UI and the payload are guarded, so it has no visible effect
  and preserves the choice if they switch back — intentional, not a leak.
- `lib/email-validation.ts` handles the cases that usually break: plus-addressing,
  apostrophes, subdomains, long TLDs, uppercase. Only IDN (`münchen.de`) fails,
  which is defensible for an admin-only outreach tool.
- `lib/builder-validation.ts` and `lib/campaign-readiness.ts` are correct — the
  latter's "mirrors the publish API" claim actually holds (both require
  title/story/goal), and the title input caps at 80 with a paste-safe `.slice()`,
  stricter than the API's 100.

**✅ SECURITY/COST — 3 unauthenticated OpenAI endpoints had per-instance-only
throttling.** `lib/rate-limit.ts` documents its own limitation: *"this is
per-process. On serverless/multi-instance deployments (Vercel, etc.) each instance
keeps its own counter, so the effective global limit is `limit × instanceCount`."*
It points at `checkRateLimitDurable` (Postgres-backed) for real limits, and
`/api/ai/campaign` uses it under the comment *"Durable, cross-instance limit for
this expensive OpenAI-backed endpoint."*

**15 of the 16 OpenAI-backed routes did not.** Of those, three are reachable with
**no account at all** — `goal-recommend`, `donor-conversion`, `donation-impact` —
so an unauthenticated caller could spread spend across instances and run up the
OpenAI bill. Switched those three to `checkRateLimitDurable`, keeping their
existing limits (15/30/30 per minute per IP). The remaining twelve require auth,
so an attacker needs an account first.

**✅ NOW COMPLETE — all 15 OpenAI-backed routes use the durable limiter (was 1).**
I initially left the twelve authenticated ones, reasoning the extra Postgres
round-trip was a tradeoff for the owner. **That reasoning was weak and I revisited
it:** the RPC costs ~10–50ms against an OpenAI call that takes *seconds*, so it is
noise; and signup is free, so requiring auth barely raises the bar for anyone
determined to burn spend. Converted all eleven remaining OpenAI routes
(`grant-match` needs no change — it makes no OpenAI call), preserving each
route's existing key and limits exactly. **Verified: zero OpenAI-backed routes
remain on the per-instance limiter.**

**✅ Extended the same check beyond AI — found `/api/contact`.** Swept every
non-AI route still on the in-memory limiter for ones that cost real money per
request. `/api/contact` is **unauthenticated**, and every accepted request sends a
**Resend email** (plus a DB insert), throttled at 5/min per IP *per instance* — so
5 × instanceCount on Vercel. Arguably worse than the AI case: email abuse damages
the **sending domain's reputation**, not just the bill. Converted to
`checkRateLimitDurable`, same limits.
_Checked and left alone:_ the other non-AI in-memory-limited routes
(`marketing/capture`, `campaign-reports`, `share-events`, leaderboards, donations,
messages) write DB rows or read data but trigger no per-request external spend, so
best-effort throttling is a defensible fit there.

_Audited clean in the same pass:_ **all 65 `/api/admin/*` routes are guarded**
(the `super/*` ones via `guardSuperAdmin`/`isSuperAdmin`), and every public
service-role write endpoint is rate-limited. `middleware.ts` protects
`/create`, `/dashboard`, `/profile`, `/admin`; its matcher excludes `/api` by
design and the routes authenticate themselves.
_Two false alarms killed by checking:_ a grep for admin guards missed
`guardSuperAdmin` and made 7 routes look unprotected, and a **case-sensitive**
grep for `rateLimit` missed `checkRateLimit`, making two endpoints look
unthrottled. Both were fine.

**🔴 FIXED — donors saw an understated lifetime giving total on their own record.**
Found by sweeping for the same shape as the trust & safety bug: a `.length` (or a
`reduce`) over an array that a `.limit()` already truncated.
`app/donor/page.tsx` fetched donations with `.limit(100)` for the list, then
computed the **money tiles from that same capped array**:
- **"Total Given"** and **"Platform Tips"** reduced over the 100 most recent rows,
  so a donor with more than 100 gifts saw a **materially wrong lifetime total** —
  their own giving history, quietly understated.
- **"Donations"** showed `donations.length`, i.e. `100`, even though the query
  **already requested `count: 'exact'`** — the true count was sitting right there
  unused.

Money tiles now come from a dedicated narrow query (`amount_cents, tip_cents` for
all completed donations); the rendered list stays capped at 100. The count tile
uses `donationRes.count`.
**The explicit `.limit(10_000)` on the new query is deliberate:** PostgREST caps
unbounded selects, so omitting a limit would have silently reintroduced the very
same bug at a different threshold. A test pins that.
Regression test verified non-vacuous.

**⚠️ PATTERN, not yet a proven defect — unbounded `donations` queries feeding totals.**
After fixing the donor dashboard, I swept for the shape. A crude scan finds
**31 files** with a `.from('donations')` chain carrying no `.limit()`/`.range()` —
but **most of those are fine** (single-row lookups, `head: true` counts, webhook
updates), and I am explicitly *not* claiming 31 defects. The detection is regex-based
and noisy; naming a number like that without reading each one is the same
grep-driven overclaim already caught twice in this session.

**The subset where the consequence is high, each read and confirmed to aggregate
into a user-visible total:**
- `lib/tax-server.ts` → the printable **tax statement**
- `app/api/fundraiser/tax-summary` → fundraiser **year-end tax summary**
- `app/api/exports/{donations,donors,full}` → downloadable records
- `app/dashboard/donor/page.tsx` → organizer's donor CRM (`totalCents`,
  `avgDonationCents`)

**Why this is flagged rather than fixed:** whether these truncate depends on the
server's PostgREST `db-max-rows`, which this sandbox cannot read. And the obvious
"fix" is actively unsafe — **adding `.limit(10_000)` where none exists would
*introduce* a cap** if the server currently returns everything, turning a
hypothetical bug into a real one.

**The safe fix, for whoever has DB access:** add `{ count: 'exact' }` (no behaviour
change), compare the count against the returned row length, and surface a
truncation notice when they differ. That detects the condition at runtime instead
of guessing at it, and never imposes a new cap. This differs from the donor-page
fix, where the cap was **explicit and visible** (`.limit(100)`) so the bug could be
proven and fixed outright.

**⚠️ FLAGGED, NOT CLAIMED — the same unbounded shape in two tax-relevant paths.**
`lib/tax-server.ts` (`loadDonorTaxInputs`) and `app/api/exports/donations` both
query donations with **no explicit limit and no pagination**. Whether they truncate
depends on the server's PostgREST `db-max-rows`, which **I cannot read from this
sandbox** — so I am *not* asserting these are broken. Recording because the
consequence is high if it does apply (a truncated **tax statement** or export is a
document someone files), and the fix is cheap: set an explicit limit and surface a
truncation indicator, exactly as done above.

**🔴 FIXED — the trust & safety dashboard misreported its own backlog.**
`/admin/trust-safety` showed summary tiles reading **"Unresolved Risk Flags"** and
**"Open Reports"**, whose values were `flags.length` / `reports.length`. Those
arrays are capped by `.limit(50)`, so **`.length` is a page size, not a count**.
With 500 open reports the dashboard displayed a confident **"50"** — the queue
looked healthiest exactly when it was worst. `/trust-safety` publicly promises
staff review *"within 24 hours"*, and this is the screen that promise depends on.

Tiles now use PostgREST `{ count: 'exact' }` totals; the rendered lists stay capped
at 50. Each section also shows *"showing 50 of 213"* when truncated, and the
reports one adds **"— oldest are not listed"**, because the lists are ordered
newest-first: the hidden rows are the ones that have waited longest and are
closest to breaching the SLA.

_Not changed:_ the newest-first ordering itself. Flipping a moderation queue to
oldest-first is arguably correct for an SLA but changes how staff triage, so it's
the owner's call — the truncation notice at least makes the situation visible.

**Confirmed sound while here:** the write path is good. `POST /api/campaign-reports`
is rate-limited, validated, inserts with `status: 'open'`, and **checks the insert
result** — with a comment explaining that swallowing the error would lose a fraud
report given the 24-hour promise. Reports genuinely reach the queue; only the
dashboard's arithmetic was wrong.

**🔒 FIXED — the unsubscribe rate limit was bypassable by changing HTTP verb.**
`POST /api/marketing/unsubscribe` carried a durable limit with an explicit comment:
*"this endpoint is unauthenticated and anonymous callers can suppress an arbitrary
email, so a per-instance counter does not bound abuse."* The **GET handler beside
it had no limit at all** — and it suppresses an arbitrary address with exactly the
same capability. Limiting one of two identical unauthenticated capabilities bounds
nothing. GET now uses the same durable limit, returning an HTML 429 (it renders in
a browser, unlike the JSON one POST returns).
Guarded by `__tests__/unsubscribe-guards.test.ts`, which asserts **every** exported
handler in that file rate-limits — so a future third verb can't reintroduce the
hole — and that the durable limiter is used rather than the per-instance one.
Verified non-vacuous.

**⚠️ NOT fixed — state-changing GET means scanners can silently unsubscribe users.**
The link in every email is `GET /api/marketing/unsubscribe?email=...`, which mutates
state on fetch. Corporate mail security (Outlook Safe Links, spam filters,
link-prefetchers) routinely **fetches URLs in email without the recipient clicking**,
so real users get unsubscribed silently — they simply stop receiving mail, and
nobody can tell why. This is exactly why RFC 8058 one-click unsubscribe is a
**POST** with a `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header.
**Left for the owner because it trades a real UX property.** The code comment says
*"One-click unsubscribe links from emails"*, so one-click looks deliberate, and the
two standard remedies both change it:
1. **RFC 8058 properly** — send `List-Unsubscribe` + `List-Unsubscribe-Post`
   headers and let the mail client POST. Best-practice, invisible to users, and
   still genuinely one click in Gmail/Outlook.
2. **Confirmation page** — GET renders a "Confirm unsubscribe" button that POSTs.
   Immune to prefetch, costs one extra click.
_Related, minor:_ `lib/email.ts` appends the Unsubscribe link to **every** email it
sends, including receipts and password resets. Harmless (clicking it only
suppresses marketing) but it implies you can unsubscribe from transactional mail.

**Confirmed working, for the record:** all three marketing send paths — `outreach`,
`campaigns`, `automations` — check the suppression list before sending, and
`unsubscribeEmail()` writes the suppression row, flips `marketing_contacts.status`,
and records consent history. The unsubscribe promise itself is kept.

**✅ AUDITED CLEAN — recurring donations, the highest-stakes control in the app.**
Checked because a cancel that doesn't reach Stripe means donors keep being
**charged** — the worst possible version of the promise-audit bug class. It is
correct, and notably well built:
- **`/api/donations/recurring/cancel`** — 401 unauthenticated; verifies
  `row.donor_id !== user.id` → **403** (so nobody can cancel a stranger's
  donation by guessing a subscription id); then calls
  `stripe.subscriptions.update(..., { cancel_at_period_end: true })` **before**
  writing the local row. That ordering is deliberate and commented — if the DB
  write fails, the donor is *still* cancelled at Stripe, so the failure mode
  never costs them money.
- **`/api/donations/recurring/pause`** — same auth + ownership + Stripe-first
  shape, for both pause (`pause_collection`) and resume.
- **External changes sync back.** The webhook handles **18** event types,
  including `customer.subscription.deleted`, `customer.subscription.updated` and
  `invoice.payment_failed` — so a cancellation from the Stripe dashboard, an
  expired card, or a failed payment all reach the app. Local status cannot drift
  permanently out of sync.

_No fix needed._ Recording it so the money path isn't re-audited: the promise-audit
found 7 leaks elsewhere, but **this** control keeps its promise.

**🟠 FIXED (copy) — "Weekly performance summary" promised an email that is never sent.**
Followed the session's own observation that defects cluster where a write path
exists and the read path was never connected. `profiles.campaign_recommendations`
saves correctly through the settings API — and **nothing consumes it**. It appears
only in the schema, the settings route, and the settings page.

**The email does not exist.** There are exactly two cron jobs (`ingest-filings`,
`reconcile-ledger`), neither of which sends a digest, and **no email anywhere in the
codebase carries a weekly/summary/digest/performance subject** — verified before
claiming it. So the old copy *"Weekly email with campaign stats"* meant a user who
opted **in** waited indefinitely for mail that would never arrive. Inverse of the
usual harm: not spam, but a feature advertised and undelivered.

Copy now reads *"Not sending yet — your preference is saved and will apply when this
email launches."* **Kept rather than removed**, deliberately: the column is wired
end-to-end, so deleting the control would leave it reachable from nothing — exactly
the wired-but-unreachable trap already fixed for `notification_updates`, and a
future agent would likely "fix" it by adding the toggle straight back.

_Also noted:_ the column is named `campaign_recommendations` but the control is
labelled *Weekly performance summary*. Those are different features; whichever is
intended, the other name is misleading.

**📋 SWEEP — every silent `void supabaseAdmin` write, triaged by consequence.**
Prompted by the reward-claim finding (a *write* whose failure was unobservable, a
new variant of the audit's usual "missing read path"). Found **10** bare
fire-and-forget DB writes. **Deliberately did not "fix" all 10** — for analytics
(`source_utm`, `share_events`) silent loss is an acceptable trade, and blanket
changes would be noise. Triaged by what an actual failure costs:

| write | consequence if dropped | action |
|---|---|---|
| `donations.currency` (×2) | column **defaults to `'usd'`** → a €50 gift silently reads as **$50** | ✅ logged |
| `campaign_status_log` insert | **audit trail** for a campaign *deletion* — no record of who deleted what | ✅ logged |
| `claim_campaign_reward` / `reward_id` | limited perk oversold (above) | ✅ logged |
| `profiles.notification_marketing = true` | opt-in lost → *less* email; fails safe | ⏭️ left |
| `source_utm`, `share_events` (×2) | attribution/analytics gap only | ⏭️ left |

The currency one is the notable find: because the column **defaults** rather than
staying null, a lost write doesn't leave a gap you'd notice — it produces a
**confidently wrong number**, which is the same failure mode as the capped-`.length`
totals earlier in this audit.
All three fixes keep their non-blocking behaviour; only observability changed.

**🟠 FIXED — a dropped reward claim could oversell a limited perk, invisibly.**
The reward flow is otherwise wired correctly: `POST /api/donations` validates the
`rewardId` and checks `item_limit`/`claimed_count`; on completion the webhook sets
`donations.reward_id` and calls the `claim_campaign_reward` RPC.

Both webhook writes were bare **`void`** — unawaited, unchecked, marked
*"(non-fatal)"*. The intent is right (a reward-tracking failure must never fail the
webhook and lose the **donation**), but `void` makes a failure **vanish entirely**,
and the consequence is concrete:
- `claim_campaign_reward` dropped → `claimed_count` under-counts, and since new
  claims are gated on `claimed_count >= item_limit`, a **limited reward can be
  oversold** — donors promised a perk that no longer exists.
- `reward_id` unset → the organizer doesn't know what to fulfil.

Both now keep their non-blocking behaviour but **log on failure**, so the condition
is discoverable. This matches the codebase's own convention elsewhere: the refund
path is likewise "best-effort, never blocks", yet it opens a **reconciliation
exception** rather than failing silently. *Non-fatal* and *invisible* are not the
same thing, and only the former was intended here.

**✅ AUDITED CLEAN (with one judgement call) — "Thank donors".**
Well built where it counts:
- **Respects anonymity** — both the send path and the "thankable donations" listing
  filter `.eq('anonymous', false)`, so anonymous donors are never named or mailed.
- **Fails loudly, not silently** — with no `RESEND_API_KEY` it returns **503** with
  `{ error: 'Email service not configured…', sent: 0 }` rather than reporting a
  success that never happened. That is the opposite of the silent-success pattern
  behind most defects in this audit.
- Tracks `sent` and a `failed[]` list instead of assuming delivery.

**⚖️ One inconsistency, recorded for a decision rather than fixed:** the profile
lookup selects only `id, full_name, email`, so the send does **not** consult the
donor's *"Receive email notifications"* preference (`notification_email`). Meanwhile
`POST /api/campaigns/[id]/updates` **does** honour `notification_updates`. So the
codebase respects an email opt-out in one place and not the other, with nothing
documenting the difference.
Both readings are defensible — a thank-you for a gift you just made is arguably
relational rather than marketing, and the donor chose to give non-anonymously — so
I have **not** silently added a filter that could suppress mail organizers expect to
send. Worth a deliberate call: either honour `notification_email` here too, or
document the carve-out so the inconsistency reads as intent.

**✅ AUDITED CLEAN — campaign update emails, in-app notifications, beneficiary invites.**
Three more controls checked against the promise-audit method; all keep their promise.
- **`POST /api/campaigns/[id]/updates`** — gathers donors **and** savers, and
  **honours the per-user opt-out** (`if (profile.notification_updates === false)
  continue`). This is the consumer that disproved one of my own claims — see the
  correction below.
- **In-app notifications** — genuinely wired both ways: writers (`lib/notify.ts`,
  webhook → `donation_received`, `refund_processed`, `amount_mismatch`), reader
  routes (`/api/notifications`, `/count`, `/[id]`), and **four** UI consumers
  including `NotificationBell` and the dashboard page.
- **Beneficiary invites** — email sent on invite; accept route requires auth,
  validates the token, and rejects already-accepted (**409**) and expired (**410**).
  Single-use, expiring, authenticated — the right shape.

**✅ AUDITED CLEAN — refund handling, including the partial-refund edge case.**
Checked whether a refund brings `campaigns.raised_amount` back down; otherwise
public totals would overstate reality (the "number that doesn't match its label"
family, on money). It is handled, and handled thoughtfully:
- **Full refund** → donation set to `refunded`, `decrement_campaign_stats` RPC
  called, ledger payable reversed idempotently by charge id.
- **Partial refund** → deliberately does *not* guess. The status stays `completed`
  and the code opens a **reconciliation exception (`kind: 'amount_mismatch'`,
  carrying `campaignId`)** for finance to reverse by hand, with a comment
  explaining that the split across principal vs. fees is ambiguous from the charge
  alone. Choosing a human process over a guessed ledger entry is the right call.
- Ledger reversal is explicitly best-effort and **never blocks refund processing**.

_One honest observation, not a defect:_ after a **partial** refund the campaign's
`raised_amount` retains the full original amount until someone acts on the
exception, so a public total can sit high in the interim. That is the accepted cost
of not guessing the split, and the exception carries `campaignId` so the
information needed is already routed. Worth knowing, not worth "fixing" blind.

**📋 SYSTEMATIC SWEEP — all 6 admin-settable campaign flags checked for enforcement.**
Prompted by three consecutive findings of the same shape (team roles, suspension,
payout freeze: *an admin control that writes a flag nothing enforces*), I stopped
checking one at a time and swept the whole family. Result — **4 of 6 genuinely work**:

| flag | non-admin consumers | verdict |
|---|---|---|
| `verified` | 81 files | ✅ enforced |
| `featured` | 13 | ✅ consumed by listings |
| `trust_status` | 13 | ✅ consumed |
| `nonprofit_verified` | 5 | ✅ consumed |
| `payout_frozen` | 2 (both advisory) | ❌ cannot work — see above |
| **`pinned`** | **0** | ❌ **dead control** |

**`pinned` is written and never read.** `PATCH /api/admin/campaigns/[id]` persists it
alongside `payout_frozen`/`featured`/`nonprofit_verified`, but **nothing consumes
it**: it is not selected in `lib/home-data.ts`, not selected in the campaigns
listing, and no query orders by it. An admin pins a campaign and nothing anywhere
changes. Low stakes next to the fraud controls — curation, not money — but the same
shape, and cheap to either wire into listing order or remove.
_Verified carefully:_ a naive grep for `pinned` returns 2 non-admin hits that are
**both false positives** — comments about a pinned *Stripe API version* in
`webhook/route.ts` and `lib/stripe.ts`, nothing to do with the campaign flag.

**Why this sweep is worth more than the individual findings:** it bounds the
problem. The pattern is real but **not endemic** — the majority of admin flags are
properly wired, and the two that aren't are now both identified with evidence,
rather than leaving an open worry that every admin control might be theatre.

**🔴🔴 "FREEZE PAYOUTS" CANNOT WORK — it is architecturally impossible, not a bug.**
`/admin/trust-safety` lists campaigns with `payout_frozen = true` as though funds
were held. They are not, and cannot be.

**Why:** `app/api/payouts/route.ts` documents the model — CharitMe uses **Stripe
Connect destination charges**. Every donation transfers the principal **straight to
the recipient's connected account at charge time**. *"CharitMe never holds the
funds… there is NO platform-initiated 'move money' step."* Stripe then pays that
balance to their bank on the connected account's own schedule. So by the time any
freeze could apply, **the money is already in the organizer's account** and is
being disbursed by Stripe, not by CharitMe.

**What `payout_frozen` actually does today:**
- ✅ written by the admin UI, stored, and listed on `/admin/trust-safety`
- ✅ read by `app/api/ai/payout-concierge` — but that is **advisory text**, not a gate
- ❌ **does not block donations** — `app/api/donations/route.ts` never selects or
  checks it, so a frozen campaign keeps taking money
- ❌ **cannot block payouts** — there is no platform payout step to block

Net: staff freeze a campaign under fraud review, see it in the frozen list, and
donations continue landing directly in that organizer's Stripe account. Same shape
as the suspension gap and equally **fail-open**, but with money attached.

**Deliberately not "fixed" by me.** With destination charges the only lever the
platform still holds is **refusing new donations**, and "freeze payouts" and "block
donations" are genuinely different intents — an admin may want to hold disbursement
while an investigation runs without cutting off donors. Silently converting one
into the other is a product decision, and on a fraud control it is not mine to
guess. Three real options:
1. **Block donations to frozen campaigns** — one condition beside the existing
   `status !== 'active'` check in the donations route. Effective immediately, stops
   new money, but changes what the control means.
2. **Pause the connected account's payouts via Stripe** — closest to the label's
   promise; needs a Stripe API call against the connected account.
3. **Move to separate charges + transfers** so the platform holds funds first —
   what would make a true freeze possible, but this is money-transmission territory
   (see the Giving Funds note) and a major architectural change.
**Until one is chosen, the admin UI should not present this as a working control.**

**🔴🔴 SUSPENDING A USER DOES NOTHING. Admin sees "Suspended"; the account is untouched.**
The most consequential enforcement gap found, and unlike the team-role gap this one
**fails OPEN** — it grants more access than intended, not less. Suspension is a
trust & safety tool, so the realistic case is: staff suspend a fraudulent
fundraiser, the console shows **Suspended**, and that person keeps collecting
donations.

**The chain, each link verified:**
1. **There is no `profiles.status` column.** The live snapshot has 26 columns and
   `status` is not among them. So suspension can only live in the `roles` jsonb —
   and `PATCH /api/admin/users/[id]` indeed derives status from
   `existingRoles.includes('suspended')`.
2. **The shared `parseRoles()` deletes it.** `lib/roles.ts` whitelists to
   `ASSIGNABLE_ROLES` = donor/organizer/beneficiary/nonprofit/admin/super_admin.
   `'suspended'` is not in that list, so `['organizer','suspended']` → `['organizer']`.
   Every consumer of the shared helper — `getUserRoles`, `isAdmin`, `isSuperAdmin`
   — is structurally incapable of seeing it.
3. **Nothing checks it anyway.** `lib/auth.ts` and `middleware.ts` contain **zero**
   occurrences of "suspend" or "status". `requireUser()` only asserts a user exists.
4. **The admin console still displays it correctly**, because
   `app/admin/users/page.tsx` uses its **own local `parseRoles`** with no whitelist.

**This retro-explains the earlier `parseRoles` divergence finding.** That looked
like tidiness — two copies, mildly inconsistent. It is actually the mechanism that
makes suspension *look* like it works: the lenient local copy renders the badge,
while the strict shared copy hides the flag from every enforcement path. The two
findings are one bug.

**Not fixed here.** The minimal enforcement point is genuinely a product/legal call
— a suspended user may still need access to their own records and payout history,
so "block everything" can be wrong. What is unambiguous is that they must not
create campaigns or receive new donations.
**Concrete path when someone decides:** add `profiles.status` (or add `'suspended'`
to the whitelist plus a dedicated `isSuspended()` that reads raw roles), then gate
the campaign-create and donation-intake routes on it. Note that fixing *only* the
`parseRoles` divergence without adding enforcement would make things **worse** —
the badge would disappear from the admin console while the account stayed active.

**🔴 TEAM ROLES ARE A FALSE PROMISE — the UI states capabilities no code enforces.**
`app/dashboard/team/_components/TeamActions.tsx:169-171` offers, in user-facing copy:
- *"Admin — can edit and manage campaign"*
- *"Viewer — read-only access"*

Measured against the code:
- **9** campaign API routes enforce an ownership check (`eq('user_id', user.id)`).
- **1** of those 9 honours team membership at all —
  `/api/campaigns/[id]/analytics`.
- **0** check the member's *role*. Analytics tests only that a `team_members` row
  **exists**.

So an invited **"Admin" cannot edit or manage the campaign** — rewards, milestones,
updates, FAQs and the rest are all owner-only — and a **"Viewer" has exactly the
same access as an "Admin"**: both can read analytics, neither can do anything else.
`team_members` is otherwise read only by the team-members API itself (i.e. to
render the team list) and by `ai/viral-loop`.

**Direction of failure matters: it fails SAFE.** Everyone gets *less* access than
promised, never more, so this is a broken feature and dishonest copy — **not** a
privilege-escalation hole.

**Not fixed here, deliberately.** Same reasoning as the user-role gap below:
enforcing `admin`/`member`/`viewer` means deciding which of the 9 routes each role
may call, and guessing that on live authorization risks either locking owners out
or handing collaborators more than intended. Two honest options, owner's call:
1. **Implement it** — add a shared `assertCampaignAccess(campaignId, user, minRole)`
   helper and apply it across the 9 routes.
2. **Stop promising it** — if team members are only ever meant to see analytics,
   change the copy to say so and drop the role selector.
**✅ Option 2 now applied** — the copy is honest as of this commit. On reflection
the two options were *not* equally blocked: implementing enforcement requires
guessing intent, but making copy match observed behaviour requires no guessing,
and users were actively being misled (invite an "Admin", they can't edit). Same
precedent as the Language selector: keep the control, state plainly what it does.
Role **values** are unchanged, so stored data and any future enforcement are
unaffected. Option 1 remains open and is the real fix.

Guarded by `__tests__/team-role-copy-honesty.test.ts`, which is deliberately
**conditional and self-retiring**: it only demands honest copy *while* no campaign
route checks a member's role. Ship enforcement and the guard stops applying, so
the richer copy can legitimately return. Verified non-vacuous against the exact
string that shipped.

**🔴 GOAL CRITERION "each user role is clearly mapped out and different" — NOT MET.**
Audited `lib/roles.ts` + every consumer. Six roles exist
(`donor, organizer, beneficiary, nonprofit, admin, super_admin`) but only two of
them **do** anything:
- `admin` / `super_admin` genuinely gate access, via `isAdmin()` / `isSuperAdmin()`.
- **`donor`, `organizer`, `beneficiary`, `nonprofit` gate nothing at all.** Every
  reference to them is display-only — computing a label in the admin user list
  (`primaryRole()`), or filtering that list. Grepped all of `app`/`lib`/
  `components`: there is **no** route, API handler, or component that branches on
  them for access. A `donor` and an `organizer` can do exactly the same things;
  real authorization comes from being signed in plus row ownership.
  Also worth knowing: **even `nonprofit` is decorative.** Tax-deductibility is
  gated by **`campaigns.nonprofit_verified`** — a per-campaign column — not by the
  role. So the one role that looks like it must carry real capability does not.

  **✅ PARTIALLY ADDRESSED — `lib/role-capabilities.ts` + 7 tests.** I first wrote
  this off as "needs an owner decision" and stopped. That was half right: *gating*
  is the owner's call, but *mapping* was not, and the criterion asks for roles to
  be clearly mapped and distinct. So there is now one authoritative definition of
  what each role means — label, description, capabilities, whether it is default,
  whether it is privileged.

  The important part is that each capability records **`enforcedBy`** (what
  actually checks it) and **`enforced`** (whether anything really denies access
  today). That keeps the honest finding legible instead of papering over it:
  `enforcedRoles()` returns exactly `['admin','super_admin']`, and
  `advisoryRoles()` returns the other four. A test **pins** that, so when someone
  implements real gating they must flip the flag here too and the map cannot drift
  from reality. Another test fails if two roles ever have identical capability
  sets — i.e. it enforces the "different from each other" half of the criterion.

  **Deliberately descriptive, not executable.** Nothing in it grants or denies
  anything at runtime. Turning these into live checks means *restricting* users who
  today have none of those restrictions — the fastest way to lock an organizer out
  of their own campaign — and which restrictions are wanted is a product decision.
  What is no longer missing is the specification to implement against.

**⚠️ Two divergent `parseRoles()` implementations.** Same drift pattern as the
category list. `app/admin/users/page.tsx:52` defines its **own local** `parseRoles`
returning `string[]`, instead of importing the shared one from `lib/roles.ts`. They
disagree on real inputs:

| stored `profiles.roles` | `lib/roles.ts` | `admin/users/page.tsx` |
|---|---|---|
| `["suspended"]` | `['donor']` (whitelist strips it) | `['suspended']` |
| `'["admin"]'` (JSON **string**) | `['donor']` (not an array) | `['admin']` |

The second row matters: a profile whose `roles` landed as a JSON string would
**render as "Admin" in the admin console while `isAdmin()` denies them**. It fails
*safe* — the mismatch denies access rather than granting it — so this is a
correctness/UI-honesty issue, not a privilege-escalation hole.
**✅ NOW DEDUPED** (see below). _Original note, kept for the reasoning:_
the local copy is deliberately lenient, and
`deriveStatus()` depends on that leniency to read `'suspended'`/`'inactive'` out of
the roles array (the shared whitelist would strip both). Collapsing them naively
would silently break status badges. The clean fix is to stop encoding status in
`roles` at all — `profiles.status` already exists and `deriveStatus()` already
checks it — but that touches a file three other agents have recently committed to.

**✅ RESOLVED — role parsing deduped, and a 4th drifted role list found.**
The blocker was that `deriveStatus()` needs the *lenient* read to find legacy
`'suspended'`/`'inactive'` markers in the roles array. Splitting the two concerns
solves it cleanly:
- **roles** now go through the shared, whitelisted `parseRoles` from `lib/roles`,
  so admin badges and filters agree with `isAdmin()`.
- **status** reads the raw strings via a renamed `rawRoleStrings()`, whose doc
  comment states plainly that it is *not* role parsing and should disappear once
  status lives only in `profiles.status` (which `deriveStatus` already prefers).

Chasing the behaviour risk turned up a **fourth** hand-maintained role list:
`ROLE_OPTIONS` in `AdminUsersClient.tsx`, already drifted in both directions — it
offered a **`'user'`** option that is not a real role (so that filter could never
match once roles are whitelisted) and **omitted `super_admin`**, leaving no way to
filter super admins at all. Now derived from `ROLE_ORDER`/`ROLE_DEFINITIONS`, which
gives the new capability map its first real consumer and fixes both directions of
the drift.
_Role-list copies found this session: 4. All now derive from one source._

**✅ NEW GUARD — `__tests__/no-server-only-in-client.test.ts` (4th structural guard).**
Catches a class **no other gate can see**: a `'use client'` module reaching a
`server-only` module *through its import graph*. This is not hypothetical — it
happened in this session. Deriving the admin role filter from
`role-capabilities.ts` → `roles.ts` → `supabase.ts` failed `next build` with
*"You're importing a component that needs server-only"* while **typecheck, lint
and 1159 unit tests all passed**. The chain was 3 hops, so reading the client
file's own imports would not have revealed it either. The guard walks the graph
and prints the full chain in milliseconds instead of failing a 5-minute build.

**Its first draft was wrong and reported 9 false positives** — it counted
`import type { X } from './server-module'`, which TypeScript erases at compile
time so it never reaches webpack. The build was green the whole time it "found"
those. Now value-imports only. A second assertion was also wrong: it matched the
bare word `supabaseAdmin`, which appears in a *comment* in `roles-shared.ts`
explaining the split, so it flagged prose. Both fixed, and non-vacuity is proven
by planting the real regression and watching it report
`AdminUsersClient.tsx → role-capabilities.ts → roles.ts → supabase.ts`.

_That is now **twice** a guard's first draft would have gated CI on correct code
(the constants guard flagged 7 files). Verifying a guard against known-good code
matters as much as verifying it against the bug._

**✅ VERIFIED CLEAN — recurring-donation cancellation** (highest-stakes remaining
control: if "cancel" doesn't cancel, donors keep being charged).
- Calls `stripe.subscriptions.update(id, { cancel_at_period_end: true })` — real
  cancellation, and the donor keeps the period they already paid for.
- **Ordering is fail-safe:** Stripe is updated **first**, so a Stripe failure
  aborts before the row is marked cancelled. The residual case (Stripe succeeds,
  DB write fails) leaves Stripe cancelled while the UI still shows active — the
  safe direction, and retryable.
- Ownership enforced (`row.donor_id !== user.id → 403`); double-cancel rejected.

**⚠️ Fixed a doc/code mismatch found there:** the header comment claimed *"Only
the donor who created it **(or an admin)** may cancel"* — **no admin check exists
anywhere in the file.** Support staff cannot cancel on a donor's behalf, so
anyone trusting that comment could tell a donor their subscription was handled
when it was not. Corrected the comment (and documented the fail-safe ordering)
rather than inventing admin authorization — granting staff the ability to cancel
other people's subscriptions is a permissions decision, not a doc fix.
_Same class as the CLAUDE.md "5% platform fee" that no code charged._

**🔴 FIXED — anonymous donors were announced BY NAME to the organizer.**
Found by applying the lesson from the half-fix above: after correcting one copy of
a mapping, grep for the rest. Sweeping every `full_name` read outside admin
surfaced `sendOrganizerDonationNotification` in the Stripe webhook:

```js
const donorDisplayName = donor?.full_name || 'An anonymous donor';
```

It fell back to the anonymous label **only when the profile had no name** — the
function was never passed the per-gift `anonymous` flag at all. So a donor who
ticked *"donate anonymously"* but had a name on file was announced **by name** in
both the organizer's **alert email** and their **in-app notification** — to the
one person anonymity exists to hide them from. The flag was available at the call
site the whole time (`meta.anonymous === '1'`, already used at 3 other lines).

Now takes `isAnonymous`, forwards it from the call site, and applies **both**
gates — the per-gift choice and account-wide Profile Visibility — matching the
donor wall, leaderboard and exports. 3 more regression tests (12 in the file).

_Surfaces checked and already correct in the same sweep:_ donor receipts and tax
receipts send `full_name` to the **donor's own** address; both CSV exports redact;
the donor's tax statement shows their own name.

**✏️ CORRECTION — my donor-wall fix was HALF a fix; the initial page render still
leaked.** The earlier commit fixed `/api/campaigns/[id]/donations` and I reported
the donor wall as done. **It wasn't.** There are **two copies** of that mapping:
- `/api/campaigns/[id]/donations` — serves **pagination** (fixed then)
- `toWallDonation` in `app/campaigns/[slug]/page.tsx` — builds the **initial
  server-rendered wall** (still leaking)

So a private donor's real name shipped in the page HTML **on first load**, and
only later paginated batches were redacted. The duplication is exactly what let
the leak survive its own fix — the same root cause as the four drifted role/
category lists.

**Also found and fixed: the donor *message* wall.** `getDonorMessages` did not
even **select** `show_public_profile`, so a private donor who posted a message was
named. Settings governs "giving activity on the leaderboard **and donor walls**",
and a wall message is exactly that. Query and mapping both gated now.

_4 more regression tests (9 in the file), each asserting the page copy — not just
the API — applies both gates._

_Lesson recorded: when a fix touches a mapping, grep for other copies of it before
declaring it done. I verified the API route and stopped there._

**🔴 SECURITY — enabling Two-Factor Authentication protects nothing. (Fix attempted below.)**
The single most serious promise-audit finding. Settings offers *"Two-Factor
Authentication — Add an extra layer of security to your account"* with a working
**enrolment** flow (`app/dashboard/settings/mfa/page.tsx` does `enroll` →
`challenge` → `verify` → `unenroll`, all correct).

**Nothing ever requires the second factor.** Supabase issues a password sign-in at
assurance level **aal1**; reaching **aal2** requires the app to challenge the
factor *and* to refuse aal1 sessions. Grepping the entire codebase for `aal`,
`AssuranceLevel` and `mfa` returns **nothing outside the enrolment page itself** —
not `middleware.ts`, not `lib/auth.ts`, not the login flow, not
`/api/auth/callback`.

**Consequence:** a user who enables 2FA, believing they have hardened their
account, is never challenged. An attacker holding only the password signs in
exactly as before. The control is decorative, and worse than absent, because it
tells the user they are protected.

**✅ FIXED — both halves shipped.**
- **`app/login/mfa/page.tsx`** — the challenge page. Enters the 6-digit code,
  runs `mfa.challenge` → `mfa.verify`, then does a **full page load** (not a
  client transition) so the middleware re-evaluates with the elevated token.
- **`middleware.ts`** — refuses an aal1 session when
  `getAuthenticatorAssuranceLevel()` reports `nextLevel === 'aal2'`.

**Three properties keep it from locking anyone out** — the failure mode of a
second-factor gate is worse than the bug it fixes — and all three are pinned by
tests:
1. **Users without 2FA are untouched.** Supabase reports `nextLevel === 'aal2'`
   *only* for accounts with a verified factor, so the branch cannot fire otherwise.
2. **No redirect loop.** `/login/mfa` is exempt explicitly, *and* it sits outside
   every `PROTECTED` prefix, so the gate cannot even run there. A test asserts
   `/login` never joins `PROTECTED`.
3. **Fails OPEN.** A throw from the assurance-level lookup sets a header and
   allows the request; a Supabase outage must not bar signed-in users. A test
   asserts the `catch` contains no redirect.
Plus: the page redirects away if no verified factor exists (never strands a user
on a page they cannot complete), and always offers sign-out as an escape.
_Non-vacuity verified:_ flipping the check to `nextLevel === 'aal1'` fails the
suite.

**🔴 TRUST & SAFETY — the public "7-day payout hold" claim contradicts the money architecture. NOT FIXED (owner's call).**
`/trust-safety` tells donors, verbatim:
> *"Payout holds — New accounts have a 7-day payout hold on their first campaign.
> Campaigns under review have payouts frozen until resolved."*

**CharitMe cannot do either of those things as described.** `lib/payout-destination.ts`
documents the core design: *"Every donation is created as a Stripe **destination
charge**, so the money transfers to the recipient's own Stripe account **at charge
time** and never sits in CharitMe's platform balance."* If the platform never
custodies the funds, it has nothing to hold for 7 days and nothing to freeze.

Supporting evidence: **`first_payout_hold_until` exists as a column and is read by
NOTHING** — the only occurrence in the entire codebase is the `create table` DDL in
`app/api/admin/apply-schema/route.ts`. No writer, no reader. Someone started this
and stopped.

**Being fair to the current state:** donors are not necessarily unprotected. Stripe
applies its own payout timing to connected accounts (new accounts typically wait
days before funds leave their Stripe balance), and CharitMe *can* block **new
donations** — that is resolution step 3 in `payout-destination.ts`, where a campaign
with no verified account cannot receive money at all. What does **not** exist is a
CharitMe-controlled hold or freeze over money already charged.

**Two legitimate fixes; pick one:**
1. **Implement it** via Stripe Connect controls on the recipient account (a manual
   payout schedule, or toggling `payouts_enabled` during review) and wire
   `first_payout_hold_until`. This is real work but genuinely possible.
2. **Correct the copy** to describe what actually protects donors — donations
   blocked until payout setup is verified, Stripe's own payout timing, and refund/
   chargeback rights — instead of a custody-based hold the architecture rules out.

Leaving a specific, checkable safety promise on the page that the code cannot keep
is the worst of the three options, which is why this is flagged rather than left.

**🔴 TRUST & SAFETY — "Suspend User" does not suspend anyone. NOT FIXED (needs a product call).**
The most consequential promise-audit finding, and the only one I have not fixed —
because fixing it wrong locks real people out of their accounts.

**What happens today:** an admin clicks *Suspend User* → `POST /api/admin/users/[id]`
→ `rolesFor()` adds `'suspended'` to `profiles.roles`. That is the entire effect.
The user can still **log in, donate, create campaigns, post updates** — everything.
Suspension is a label in the admin console.

Three independent confirmations:
1. **No enforcement exists.** `lib/auth.ts` (`getUser`/`requireUser`) checks only
   admin/super-admin. `middleware.ts` never reads `profiles` at all. No API route
   checks suspension. Grepped `app`, `lib`, `middleware.ts`.
2. **The canonical reader deliberately discards the marker.** `parseRoles()` in
   `lib/roles.ts` whitelists to `ASSIGNABLE_ROLES` =
   `donor, organizer, beneficiary, nonprofit, admin, super_admin` — **`'suspended'`
   is not in that list**. So `getUserRoles()` strips it, and any future
   `getUserRoles(id).includes('suspended')` check is **permanently false**. This is
   the concrete harm from the two-divergent-`parseRoles` drift recorded above.
3. **Status is written into the wrong place.** Suspension is encoded as a *role*
   even though `profiles.status` exists and `deriveStatus()` already reads it.

**Why I stopped here rather than shipping enforcement:** blocking the wrong surface
is worse than the bug. Someone has to decide whether a suspended user is blocked at
**login** (cannot see their account or appeal), at **donation**, at **campaign
creation**, or all three — and what happens to their live campaigns and any active
recurring donations mid-suspension. Those are policy questions with real
money and real users attached.

**When decided, the implementation is small:** stop encoding status in `roles`
(use `profiles.status`, already present and already read by `deriveStatus`), then
gate the chosen surfaces in `requireUser()`. Do **not** gate via `getUserRoles()` —
per (2) it cannot see the marker.

**🔴 FIXED — 3 more surfaces named donors who had asked to be hidden (leaks 5–7).**
Completes the anonymous/private-donor sweep. Each honoured the **per-donation
`anonymous` flag but not the account-wide Profile Visibility setting** — the same
half-wired shape as the leaderboard and donor wall:
- **`lib/home-data.ts` — the HOMEPAGE recent-donations ticker.** Highest-traffic
  surface on the site. A donor set to Private who simply didn't tick "anonymous"
  was named to every visitor.
- **`/api/campaigns/[id]/supporters`** — took `full_name` unconditionally, so
  **anonymous gifts were attributed by name** in the organizer's supporter list.
  (Emails were already masked via `maskEmail`; only the name leaked.)
- **`/api/campaigns/[id]/messages`** — the pagination route behind the donation
  wall; name *and* avatar now honour both gates.

**A guard test caught the homepage one, not me.** `donor-identity-gates.test.ts`
asserts every file joining a donor profile for display also consults
`show_public_profile`; it failed on `lib/home-data.ts` while I was mid-way through
the other two. It correctly ignores `profiles:user_id(...)` joins — those are
campaign **organizers**, who are legitimately public.

_Process note:_ this work was sitting **uncommitted and failing** across a context
boundary — typecheck was red (`show_public_profile` missing from `DonorProfile`)
and the guard was failing. Verifying before committing is what caught both;
committing on the assumption that in-flight work was finished would have shipped a
broken build **and** left the homepage leak in place.

**🔴 FIXED — unpublished drafts were readable at their public URL.**
`POST /api/campaigns` documents `status: 'draft'` as *"saves without
publishing"* — and publishing is precisely what makes a campaign public. But the
detail page **never gated on status**: it used it only to disable donations
(`isActive`). So a draft rendered **in full** — story, media, goal — to anyone
holding or guessing the slug, and slugs derive from the title.

Listings and the sitemap already exclude drafts (both wrap `applyLiveFilters`),
so the detail page was the one reachable surface. Now gated on ownership, exactly
like the existing `visibility === 'private'` branch, so the organizer can still
preview their own draft.

**Deliberately narrow: only `'draft'`.** `completed` and `archived` campaigns must
stay readable — people link to finished fundraisers — so a blanket
`status !== 'active'` block would have broken them. A test pins that too.

_Near-miss worth recording:_ I first thought `app/sitemap.ts` leaked private and
deleted campaigns, because `grep` showed `.from('campaigns').select(...)` with no
filters. **Wrong** — both queries are wrapped in `applyLiveFilters(...)`, which
applies `status='active'`, `visibility='public'` and `deleted_at IS NULL`. The
filters live in the *enclosing call*, not the fragment grep printed. The sitemap
is correct; reading the whole expression is what prevented a false report.

**🔴 FIXED — the full data export leaked anonymous donors' identity.**
Third application of the promise-audit, this time to *"Donate anonymously"* — the
control donors most rely on. Checked all three export endpoints; **two were
already right and one was the outlier**:
- `/api/exports/donations` ✅ writes `'Anonymous'` and deliberately omits email
  ("to avoid PII in default export").
- `/api/exports/donors` ✅ groups anonymous gifts under one keyless row with an
  empty email.
- `/api/exports/full` ❌ **dumped the raw donation rows**, so the organizer
  received `donor_id` and `offline_donor_name` for gifts marked anonymous —
  identifiable **by name** for offline donations, and by a **stable profile id**
  otherwise, which correlates with any non-anonymous gift the same person made.

That endpoint returns the authenticated organizer's own campaigns, so this handed
the identity straight to the one person anonymity is meant to hide it from. Now
nulls both fields for anonymous rows; amounts, status and dates are untouched so
the export stays complete for accounting.
_The two siblings already redacting is what proves this was an oversight rather
than a deliberate choice._ 2 more regression tests (5 total in the file), verified
non-vacuous by restoring the raw pass-through.

**✅ VERIFIED CLEAN — email consent.** Applied the same "does every surface honour
the promise?" question to the notification toggles, since sending to someone who
opted out is a legal exposure, not just a bug:
- **Transactional email correctly gates on the opt-out.** The Stripe webhook
  checks `notification_email === false` before both donor receipts and organizer
  notifications and returns early.
- **`notification_marketing` is collected but nothing consumes it** — no bulk
  marketing send exists anywhere. The `/api/marketing/*` routes never call
  `sendEmail`, and `lib/email.ts` never references the column. **So the opt-out
  cannot be violated by a system that does not send.** It is set to `true` only on
  explicit opt-in (it defaults FALSE, so that is a real opt-in, not a pre-tick).
  ⚠️ **Whoever builds marketing email must wire this check** — the preference is
  already stored and honoured nowhere, so it will not enforce itself.
_One scoping error worth noting:_ I first concluded `lib/marketing-consent.ts` had
**no importers** — wrong, my grep excluded `components/` and `.tsx`. It is used by
`PrivacyPreferences.tsx` and `MarketingTracker.tsx`, and holds a localStorage key
for **tracking** opt-out (not email). Checked before reporting.

**🔴 FIXED — "Private" donors were still named on the leaderboard and donor walls.**
Direct follow-on from making the Profile Visibility toggle actually save: having
fixed the control, I checked whether anything *honours* it. `/donors/[id]` does
(404s correctly). **The two surfaces Settings explicitly names did not.** Its own
copy reads *"Who can see your giving activity on the leaderboard and donor
walls"* — so the setting's description was false.

- **`lib/leaderboard.ts`** returned the donor's real `full_name` and `avatar_url`
  **regardless**, passing `showPublicProfile` through as a flag. The UI used that
  flag only to **drop the hyperlink** — the name still rendered, and still shipped
  inside the server-rendered HTML, so it was in view-source even if CSS had
  hidden it.
- **`/api/campaigns/[id]/donations`** (the donor wall) keyed naming off
  `anonymous` **alone**, so a private donor's name and avatar were returned too.

Both now anonymize **at the source**, so identity never reaches the client. The
donation still counts and still displays — exactly like an anonymous gift — since
the donor opted out of attribution, not out of the leaderboard. `donorId` is also
nulled for private donors, because a link there would have 404'd as well as
identified them.

_3 regression tests, proven non-vacuous_ (reverting the leaderboard gate fails
them). They assert the source shape rather than executing the queries, since both
functions need a live DB.

**✅ Soft-delete class CLOSED — campaigns was the only leak.** After fixing it I
checked whether the bug had siblings, rather than assuming. **22 tables carry
`deleted_at`**; three are publicly browsable (`campaigns`, `grants`,
`volunteer_opportunities`). Every other public path already filters correctly:
- `grants` — list (`/api/grants`), detail (`/api/grants/[id]`) **and** the apply
  endpoint all `.is('deleted_at', null)`.
- `volunteer_opportunities` — all **three** queries in `lib/volunteers-server.ts`
  (list, by-slug, categories) filter it.
- admin routes for both filter it too.
So `getCampaign` was the single outlier, and the class is now closed rather than
one instance patched. The other 19 tables are payment/audit internals with no
public read path.

**🔴 FIXED — deleting a campaign did not hide it from the public URL.**
`DELETE /api/campaigns/[id]` **soft-deletes**: it sets `deleted_at` rather than
removing the row ("for compliance audit trail"). Every listing filters that
column — but `getCampaign` in `app/campaigns/[slug]/get-campaign.ts` queried on
**slug alone**, so a deleted campaign stayed **fully readable at its public URL**:
story, donor names and messages, amount raised.

Deleting *appeared* to work, because the campaign vanished from `/campaigns` and
search. Anyone holding the link — or arriving from a search-engine result — could
still open it. Same shape as the other "control that lies" bugs this session: the
button reports success and does only part of what it says.

Fixed at the source (`.is('deleted_at', null)`), which covers all three callers at
once — `layout.tsx`'s existence gate, `generateMetadata`, and the page — since
`getCampaign` is `cache()`-shared between them. Confirmed nothing else imports it.

_Found by reading the file, not scanning_ — and a misread on the way: I first
thought a `visibility = 'public'` filter contradicted the owner-can-view-private
branch, but that filter belongs to `getSimilarCampaigns` (the recommendations
rail), where it is correct. Checking which function owned the line is what led to
`getCampaign` having no filters at all.
_Tests:_ the existing mock chain broke (`.is` is not a function), which
independently confirmed the query shape changed; updated it and added a test
asserting `['deleted_at', null]` is applied. 4 pass.

**⚠️ The 36 unwired tables could NOT be reliably split into "superseded" vs
"never built" — that triage needs a human.** Tried twice:
1. **Name overlap** — too noisy to use. It paired `auction_items` with
   `impact_plan_items` purely because both contain "items", and
   `volunteer_profiles` with `volunteer_opportunities`, which are different
   concepts. It claimed 19 "superseded"; most are coincidence.
2. **Column-set similarity** (stronger evidence) — mostly *negative*:

   | pair | shared cols | jaccard |
   |---|---|---|
   | `reward_tiers` / `campaign_rewards` | 8/11 | **0.62** |
   | `donor_segment_members` / `marketing_segment_members` | 2/3 | 0.50 (tiny tables, noisy) |
   | `member_subscriptions` / `subscriptions` | 6/8 | 0.43 |
   | `donation_receipts` / `tax_receipts` | 9/20 | 0.38 |
   | `processor_accounts` / `connected_accounts` | 5/15 | 0.25 |
   | `platform_fees` / `campaign_platform_fees` | 3/6 | 0.14 |

**Only `reward_tiers` is confirmed superseded**, and that came from *reading the
code* (the app queries `campaign_rewards`), not from either heuristic. The rest
stay unclassified rather than guessed at.

_Pattern worth naming — this is the **third** scan this session that produced
candidates rather than findings_ (the others: "unsent form state", and the
105-claim catalog check). **Structural heuristics are good at narrowing where to
look and bad at concluding.** Every genuine finding this session — the category
drift, the dead controls, Auctions, the two unbuilt modules — was confirmed by
opening the file. Budget scans as search, not as evidence.

**✅ 5th GUARD — `__tests__/feature-status-honesty.test.ts`.**
Stops the module-status problem from returning. A module fails if it claims
`Live`/`Production Ready` while **none** of its declared `databaseTables` is
reachable from code. Deliberately weak — partial gaps pass, since a feature can
legitimately be built without every table it was designed around; only a module
with *nothing* wired fails.

Reuses the corrected wiring detection: `.from()` **plus** tables written inside
RPC function bodies (the fix that stopped `rate_limit_hits` being a false
positive). Non-vacuity proven three ways — core tables (`campaigns`, `donations`,
`profiles`) must register as wired, `auction_bids` must not, and flipping
`memberships` back to *Production Ready* fails with
`none of 5 declared tables reachable: creator_profiles, membership_tiers,
member_subscriptions, exclusive_posts, direct_messages`.

**🔴 FIXED — two ENTIRE modules advertised "Production Ready" with 0% built.**
Following the unwired-table finding into the catalog's own `databaseTables`
declarations:

| module | declared tables unwired | route | badge was |
|---|---|---|---|
| **Memberships and Community** | **5 / 5** | none | Production Ready |
| **Creator Commerce and Tips** | **6 / 6** | none | Production Ready |
| projects-perks | 2 / 5 | yes | (left alone) |
| nonprofit-suite | 2 / 7 | yes | (left alone) |
| ai-trust-growth | 1 / 6 | yes | (left alone) |

The two at 100% were the actionable ones, and the journey was worse than Auctions
because each carries an **action CTA**: `/features` → "Memberships and Community"
badged *Production Ready* → `/features/memberships` → button **"Create membership
tiers"** → lands on **`/create/choose-path`**, the ordinary campaign wizard, where
no membership functionality exists. Same for **"Build a creator page"**.

Worse, **`/features/[slug]` never rendered status at all** — the detail page is
where the CTA lives, so it gave the visitor no signal whatsoever.

Fix: added **`'Planned'`** to the status union (it was `'Live' | 'Production
Ready'`, with *no way to express "not built"* — the structural cause), marked
those two modules, styled the badge on `/features`, and surfaced a **"Planned —
not yet available"** marker beside the CTA on the detail page.

_Deliberately conservative:_ only the two modules with **100%** unwired tables
**and** no route were changed. The other three have partial gaps that may be
legitimately implemented without those specific tables — flipping them would be
positioning, not fact-checking.

**🔴 SYSTEMIC — 36 of 143 tables (25%) have NO application code path.**
Auctions was not a one-off. Cross-referencing the live-DB table snapshot against
every `.from('…')` in `app`/`lib`/`components`, **plus** resolving the 6 `rpc()`
functions called from code and the tables their bodies touch:

`admin_notes, admin_settings, analytics_snapshots, api_keys, auction_bids,
auction_items, campaign_analytics_events, campaign_payment_exports,
campaign_payment_settings, coach_sessions, commission_requests, creator_profiles,
creator_tips, digital_products, direct_messages, donation_forms,
donation_receipts, donor_segment_members, donor_segments, donor_tips,
embedded_buttons, event_tickets, exclusive_posts, giving_days, grant_documents,
livestreams, marketing_referrals, member_subscriptions, membership_tiers,
peer_fundraisers, platform_fees, processor_accounts, product_orders, reward_tiers,
trust_scores, volunteer_profiles`

**Directly answers "everything wired to Supabase": 75% is, 25% is not.** Several
of these back features the `/features` page advertises as **Production Ready** —
donation forms, CRM donor segments, peer-to-peer, memberships, digital products,
livestreams — the same false-claim shape as Auctions, at scale.

**Method was corrected twice before trusting it**, because the naive version lies:
- A `.from()`-only scan said **37**. `rate_limit_hits` was a false positive — it is
  written by the `check_rate_limit` **RPC**, so it *is* wired. Resolving RPC
  function bodies against `schema.sql` fixed the count to **36**.
- Spot-verified five more by hand (`donation_forms`, `peer_fundraisers`,
  `donor_segments`, `membership_tiers`, `livestreams`) → **0** code references each.

**Bonus finding: `reward_tiers` is a duplicate.** Rewards genuinely work, but the
app reads **`campaign_rewards`**; `reward_tiers` is dead legacy schema.

_Caveat, deliberately not overstated:_ a few entries (`admin_settings`,
`platform_fees`, `analytics_snapshots`) may be written by SQL/cron rather than app
code, so "no app code path" is not automatically "unused". The features-backing
ones above are the actionable set.

**🔴 FIXED — `/features` advertised Auctions as shipped; it does not exist.**
`auction_items` and `auction_bids` exist in the schema, but there is **no route,
API, component or bidding UI anywhere** in the app (verified by grepping for
auction/bid/lot across `app`, `lib`, `components` — the only hits were the
marketing page and the catalog itself), and **no commit is building one**. Yet
`/features` renders it inside a module badged **"Production Ready"**, so visitors
read it as available.

**First fix was wrong.** I deleted the entry — and `feature-catalog.test.ts`
failed, which revealed intent I did not have: `REQUIRED_COMPETITOR_FEATURES` is a
**competitive parity checklist** (what rivals offer and CharitMe intends to
match), and the test pins every entry. Deleting it destroyed tracking. The test
encoded a purpose the code alone did not explain.
Correct fix: added an optional **`planned?: boolean`** to `PlatformFeature`,
marked Auctions with it, and rendered a `· planned` marker on the page. The parity
checklist stays complete, and nothing unbuilt is presented as shipped.

_Also unbacked:_ `membership_tiers` exists in the schema and is referenced **only**
by `feature-catalog.ts` — no route, no UI. Not flagged `planned` here because it
is not in the competitor list; worth an owner pass over the remaining modules.

**❌ Related negative result:** a keyword scan of all **105** catalog claims
reported 16 with "no implementation". **Unreliable — discard it.** Short first
words broke the key (`"Tax Receipts"` → `tax` is under 4 chars → fell back to
searching the literal `"tax-receipts"`), so `lib/tax.ts` and the AI trust-score /
fraud-monitor routes were all flagged despite plainly existing. Auctions was
confirmed by hand, not by that scan.

**✅ VERIFIED CLEAN — money path end-to-end (cents/dollars).** The classic 100×
bug class, checked in both directions across the app:
- **Input→storage:** `goalCents = Math.round(parseFloat(form.goal) * 100)` and
  `amountCents = Math.round(parseFloat(amount) * 100)` — both use `Math.round`
  (so no float artifacts) with `|| 0` guards. No path sends dollars where cents
  are expected.
- **Storage→display:** grepped every `.tsx` for `raised_amount` / `goal_amount` /
  `amount_cents` interpolated into JSX without a formatter → **zero hits**. Even
  the aggregate that looked suspicious (`totalRaised` summing raw cents in
  `ai-growth-plan`) is rendered through `fmtCents()`.
Combined with the earlier fee-math probe (66 combinations, 0 invariant
violations), the money path is verified at input, aggregation and display.

**⚠️ Seed counts CANNOT be verified statically — use `99_verify_counts.sql`.**
Tried to check the "≥100 seed records" criterion by counting rows in the seed SQL
without a database. **The method is unreliable and produced a false finding**,
which is worth recording so nobody repeats it:
- A tuple-counting heuristic reported `seo_settings` at **75**, i.e. short of 100.
- Verifying precisely: that table is populated by an `insert … select … from
  generate_series` (not `insert … values`), so neither regex measures it. The
  file header states **105 records per table, applied to the live DB 2026-07-20**.
  No shortfall.
Seed SQL resists static counting generally — `select`-based inserts,
`generate_series`, and `ON CONFLICT` (which makes re-runs idempotent for some
tables and appending for others). The suite already ships the right tool:
**`supabase/seeds/99_verify_counts.sql`**, which answers this in one query against
the live DB. That, not a scan, is what closes this criterion.
_Suite covers 33 tables in `seeds/` plus `super_admin_console_seed.sql`,
`seed.sql` and `seed_250.sql`._

**✅ VERIFIED CLEAN — CSV export escaping and search-query handling.**
Both are security-relevant and both were probed with adversarial input rather than
read:
- **`lib/csv.ts`** — formula/CSV injection. `=1+1`, `+1+1`, `-1+1`, `@SUM(A1)`,
  `=cmd|' /C calc'!A0`, leading TAB and CR all receive the neutralizing leading
  apostrophe; commas/quotes/newlines are quoted with `"` doubled; combined cases
  (`=HYPERLINK("http://evil","x")`) get **both** treatments; plain values, `""`
  and `"0"` pass through untouched. Textbook-correct.
- **`lib/campaign-search.ts`** — PostgREST `.or()` filter injection. `a,b` has its
  comma stripped, `x)or(1=1` loses its parens, `()` yields no terms, `%wildcard%`
  has the `%` stripped so wildcards can't be injected, and `status.eq.draft`
  survives only as *literal text* inside `ilike.%…%` rather than as a filter.
  Unicode (`café niño`, curly quotes) is preserved.
Neither needs work; recorded so the next audit doesn't repeat them.

**❌ NEGATIVE RESULT — "unsent form state" cannot be found by scanning. Don't retry it.**
Tried to automate the highest-value unguarded bug class (the Settings one: form
state that never reaches its save payload, causing silent data loss). A scan of
every `'use client'` file comparing `useState` names against `JSON.stringify`
bodies reported **71 suspect files**. Essentially all are false positives, for
three reasons worth knowing before anyone builds this again:
1. **Renamed fields** — `DonateButton` sends `donorEmail: guestEmail.trim()` and
   `paymentMethod: preferredMethod`, so the state name never appears in the body.
2. **Computed keys** — `ProfileForm.updatePreference` sends
   `JSON.stringify({ [key]: value })`. No state name is present at all.
3. **Nested payloads** — a non-greedy `\{(.*?)\}` stops at the first `}`, so
   anything after a nested object reads as "unsent".
Spot-checked the top candidates by hand: `DonateButton`, `ProfileForm` (which has
a proper optimistic-update-with-revert) — **all clean**. Unlike dead controls and
list drift, this class needs real type/dataflow analysis, not regex. It stays a
manual-review item.

_Bonus corroboration from the check:_ `/api/profile` has always handled all three
`notification_*` columns including `notification_updates` — the column
`/api/settings` was missing until it was wired this session. The settings route
was the outlier, not the column.

**✅ CLOSED — the e2e suite now runs in CI and is CONFIRMED green there.**
Wired `smoke` + `security-headers` into `ci.yml`, then verified in real CI rather
than assuming: run `d51208e` completed **success**, and its duration jumped to
**451s** against 292/308/344s for the three preceding successful runs. That
+110–160s is exactly the Playwright browser install plus the 6 specs (~1.3 min
locally), so the step demonstrably executed rather than being skipped.
_Original finding, kept for context:_ **⚠️ The e2e suite exists, works, and runs in NO CI workflow.** `e2e/` holds 4
Playwright specs — `smoke`, `public-routes`, `public-quality`, `security-headers`
— plus an `npm run e2e` script. **Neither `ci.yml` nor `image-links.yml` mentions
Playwright or e2e**, so none of it has ever run automatically. `security-headers`
in particular checks CSP and header behaviour that nothing else covers.

**Verified they actually work** (they had never been run in this environment):
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
— the config already exposes that override for exactly this sandbox mismatch,
since the repo pins `@playwright/test ^1.60.0` against a `chromium-1194` build.
Result: **smoke 2/2 green**, **security-headers 4/4 green**.

**A first full run showed 3 failures — all environmental, none a product bug.**
Worth writing down because two of them look alarming:
- `public-routes` — 30s timeout navigating to `/campaigns`. Same sandbox↔Supabase
  latency documented above, not slow code.
- `security-headers` — *"Refused to execute script … MIME type ('text/html')"*,
  which reads like a CSP breach. It is not. A **`next-server` process from the
  previous day was still listening on :3000**, and `playwright.config.ts` sets
  **`reuseExistingServer: true`**, so Playwright reused it rather than starting
  one on the current build. It served pre-restructure HTML referencing
  `chunks/app/campaigns/page-<hash>.js`, a path that stopped existing when
  another agent moved `/campaigns` into a `(list)` route group. **A clean
  `rm -rf .next` + rebuild did NOT fix it** — only killing the stale process did,
  after which the spec passed 4/4.
  _Lesson for anyone running e2e here: check for a stale `next-server` first
  (`ps aux | grep next-server`), because `reuseExistingServer` will silently
  serve you an old build and the failure looks like a security regression._
- CI would not hit either issue: a fresh runner has no stale server, though the
  Supabase-latency timeout would need a real DB or a longer timeout.

**Not added to CI by me** — that needs a decision on whether the runner gets
Supabase credentials (several specs hit DB-backed pages), plus a browser-install
step. Cheap to add once that's settled; the specs themselves are sound.

**⚠️ CI on `master` mostly reports `cancelled`, and that is NOT failure.**
`.github/workflows/ci.yml` sets `concurrency: cancel-in-progress: true` keyed on
`github.ref`. Every agent pushes to `master`, so each push **cancels the previous
commit's in-flight run**. Measured over the last 30 runs: **17 success, 12
cancelled, 1 in progress** — and the most recent *success* was `2b81ad7`, with
everything after it cancelled by the next push.

Two consequences worth knowing before anyone panics or "fixes" this:
- **`cancelled` ≠ broken.** Those commits were never validated *individually*; they
  were superseded. It is self-correcting — whenever pushing pauses, the final run
  completes and validates the tip, and the tip contains all the prior commits.
- **But no individual commit is independently verified** while pushes are rapid.
  With several agents on one branch, a defect could ride along for several commits
  before the first completed run attributes it. Local gates are therefore the real
  safety net right now — run typecheck + lint + `npm test` + build **before**
  pushing rather than relying on CI to catch it.

CI itself is correctly configured (push **and** PR to master; typecheck → lint →
test → image audit → build; no `continue-on-error`), so the two new guard tests
genuinely do gate — verified, not assumed.

**Method that found most of these:** run the function against realistic input rather
than reading it, and check every claim against the thing it references. Both
corrections above came from re-testing a conclusion I had already asserted.

## Status legend
`Not Started` · `In Progress` · `Blocked` · `Code Complete` · `Testing` · `Verified` · `Production Ready`

A task reaches **Verified** only with real evidence (test name, route, Supabase
record, screenshot, commit). Per **ADR-0003**, tasks touching live data / Stripe /
payouts / RLS cannot exceed `Code Complete` from the current sandbox — they are
tagged `needs-staging` until a staging Supabase + Stripe test project is available.

## Audit baseline (2026-07-19; refreshed 2026-07-21)
Platform is **already mature and healthy**: ~130 pages, 200+ API routes, 132 live
tables (post-reconciliation), **746 passing tests**, type-clean build, green CI. This
is a **gap-closure + hardening + elevation** program, not a rebuild (ADR-0001).

## Gap analysis — STATUS REFRESH (2026-07-21)
> ⚠️ The original 2026-07-19 gap table below listed these domains as Absent/Thin.
> Every one has since been **built and reconciled into the live DB (132 tables)**,
> and most were **verified end-to-end this session**. Do NOT rebuild them — verify
> and polish only.

## Launch-Readiness Seed Audit (2026-07-21)

Goal: **every feature/service offering seeded with ≥100 rows** so the live site
demonstrates real volume in every list, dashboard, and admin console. The seed
suite lives in `supabase/seeds/` (run `00`→`06`, then `99` to verify). Each file
loads **120 rows/table**, guarded by `to_regclass()` + `on conflict do nothing`,
so it is safe on any database and re-runnable.

| Seed file | Feature domain | Tables | Rows/ea |
|-----------|----------------|--------|---------|
| `00_test_users.sql` | Accounts | `auth.users`→`profiles` | 120 |
| `01_campaigns_core.sql` | Campaigns + donations | campaigns, updates, faqs, milestones, rewards, donations, saved, notifications | 120 |
| `02_marketplaces.sql` | Grants · sponsorships · matching · volunteers · nonprofits | 12 tables | 120 |
| `03_events.sql` | Events & peer fundraising | events, tickets, registrations, check-ins, peer_fundraisers | 120 |
| `04_impact_gamification.sql` | Impact & gamification | impact_*, challenges, participants, badges | 120 |
| `05_engagement_financial.sql` | Engagement & financial history | donor_messages, recurring, refunds, payouts, verification, risk_flags, tax_receipts, business_leads | 120 |
| **`06_extended_features.sql`** *(new)* | **Creator monetization · digital products · auctions · livestreams · giving days · donor CRM** | creator_profiles, membership_tiers, member_subscriptions, exclusive_posts, creator_tips, digital_products, product_orders, auction_items, auction_bids, livestreams, giving_days, donor_crm_contacts, donor_segments, campaign_media, transparency_ledger_items | 120 |
| `99_verify_counts.sql` | *(read-only)* coverage report | 57 tables checked | — |

**Coverage: 57 feature tables** across the 15 domains now have a ≥100-row seed
path. `06` was validated end-to-end against a throwaway Postgres 16 instance
(schema loaded from the `competitor_parity_features` migration + `campaign_media`
/`transparency_ledger_items` DDL): all 15 tables reached ≥120 rows, the file ran
twice cleanly (conflict guards held), and `99` reported `OK` for every one.

> **`needs-staging` (ADR-0003).** These seeds cannot be executed against live or
> staging Supabase from the sandbox — that is the **owner's step**. Run `00`→`06`
> in the Supabase SQL editor (service role), then `99`, and confirm every row
> shows `OK`. Per-user tables only reach 100 once ≥100 profiles exist (`00`).
> Do **not** run the demo seeds against the production project without the
> demo-data guard/labeling (see “Production seed guard” below) — they insert
> fabricated rows.

## Gap analysis — genuinely absent/thin domains
Cross-referencing the required table inventory against tables actually referenced in code:

| Domain | State now (2026-07-21) | Evidence |
|--------|------------------------|----------|
| **Grants** | ✅ Built + verified | round-trip write/read/soft-delete + RLS verified live (`docs/AUDIT_PROGRESS.md`) |
| **Volunteers** | ✅ Built | CHAR-0003/0004; tables + RLS + routes live |
| **Events** | ✅ Built + verified | RSVP capacity/duplicate/RLS round-trip verified live this session |
| **Corporate giving** | ✅ Built | matching gifts (`matching_programs`/`matching_claims`, `/api/matching/*`) + **CSR dashboard** `/dashboard/corporate` (this session, on master's matching infra — the stale branch's parallel `/api/corporate/*` design was intentionally NOT ported). `corporate_accounts`/`_members` multi-admin grouping remains a P3 nicety (single `sponsor_id` owner works today) |
| **Sponsorship workflow** | ✅ Built | `sponsorship_opportunities/requests` + `/api/sponsorships/*` |
| **Formal impact tracking** | ✅ Built | `impact_plans/updates/metrics` + `/api/impact/*`; `lib/impact.ts` (currency bug fixed PAY-010) |
| **Subscriptions / recurring** | ✅ Built + verified | recurring-donation state machine + idempotency verified live; CharitMe Plus entitlements Code Complete (billing write-path Stripe-gated) |
| **Gamification (persisted)** | ✅ Built + live | `gamification-persist.ts` `syncAndGetBadges`/challenges wired to `/achievements`; **120 `user_badges` rows live** |

Well-covered already (do not rewrite): auth, campaigns, donations, payments &
payment-observability, payouts, recurring, refunds, trust/risk, marketing engine,
AI platform, admin, lead-gen — **plus all eight domains above**.

## Genuinely remaining (2026-07-21)
- **Stripe Connect live-enablement (owner)** — the one true launch blocker; unblocks
  the whole gated verification set. See `docs/PAYMENT_READINESS.md`.
- **Live-gated verification** (needs Connect + staging): end-to-end money flow,
  refund/dispute lifecycles, recurring-renewal observability, per-persona RLS matrix.
- **Far-future / out-of-scope** (from §2 comparison, not priorities): NFC tap-to-give,
  crypto, stock/DAF/estate giving, native livestream, native mobile apps, white-label.
- **Payment hardening pass: COMPLETE** — 11 defects fixed + schema-contract CI guard
  + financial-RLS verified (Section D + `payment-audit.md`).

---

# Section A — Execution Backlog

> Seeded with the highest-value real gaps + hardening. Each new domain lands as a
> vertical slice: migration (RLS-first) → typed lib → API (authz) → mobile-first UI
> → tests → docs. IDs are stable; statuses advance with evidence.

- [ ] CHAR-1403 — **Testing** — end-to-end QA of the Featured Campaign option
  - Area: Featured Campaigns / Payments
  - Feature: Paid featured-campaign placement in the homepage rotator (shipped #27)
  - Description: Manually verify the full flow now that code is merged: (1) Super Admin → Settings → Payment shows "Featured Campaign Price (USD)", editing it persists and the new price is what the creator is charged; (2) a campaign owner sees the "Feature this campaign — $X" button on their dashboard campaign page and is taken to Stripe Checkout for the configured amount; (3) on successful test-mode payment the Stripe webhook (`checkout.session.completed`, `metadata.type=feature_campaign`) flips `campaigns.featured = true`; (4) the homepage hero rotator then cycles through ONLY featured campaigns, with the countdown bar, and falls back to top campaigns when none are featured; (5) an already-featured campaign shows the "Featured" badge instead of the button and the API rejects a second purchase (400); (6) ownership gating: a non-owner POST to `/api/campaigns/:id/feature` returns 403.
  - Priority: P1
  - Dependencies: needs-staging (Stripe test-mode keys + live webhook endpoint) — cannot exceed Code Complete from sandbox per ADR-0003
  - Database: reads/writes `campaigns.featured`, reads `platform_settings.config.payment.featuredCampaignPriceCents`
  - API: `POST /api/campaigns/[id]/feature`, `GET /api/campaigns/rotator`, `stripe/webhook`
  - UI: `/dashboard/campaigns/[id]` (Feature button), `/admin/settings` (price), homepage `HeroRotator`
  - Tests: `__tests__/featured.test.ts` 8/8 pass (price resolution + rotator selection). **Pending manual/staging:** Stripe checkout → webhook → featured flip; rotator featured-only cycling; 403 ownership; 400 double-purchase.
  - Completion Evidence: (to fill in during QA — Stripe test session id, webhook event id, `campaigns.featured` DB record, homepage rotator screenshot)
  - Commit: 586fc3a (feature merged via #27)

- [x] **Migration reconciliation — competitor-parity dependency drift fixed (2026-07-23)**
  - Added legacy-column reconciliation before competitor-parity indexes and a
    forward migration that restores the five dependent tables with RLS/policies
    when the earlier transaction rolled back. Static RLS coverage and schema
    contract tests pass. Live application remains owner/staging-gated.

- [x] CHAR-0001 — **Verified in production** (schema + RLS applied to live Supabase 2026-07-19)
  - Area: Grants
  - Feature: Grants data model + RLS
  - Description: Migration for `grants`, `grant_matches`, `grant_applications`, `grant_documents`, `grant_deadlines` with FKs, indexes, timestamps, soft-delete, and RLS (public read of open grants; org-scoped applications).
  - Agent: 1 (+5)
  - Priority: P1
  - Dependencies: none
  - Database: new tables + RLS
  - API: none (this task)
  - UI: none (this task)
  - Security: RLS tenant isolation for applications (applicant-scoped policies written)
  - Tests: RLS verified in prod — all 5 tables `rowsecurity=true`; anon read of `grant_applications` returns 0 rows (owner isolation holds); anon read of `grants` returns 200 (public policy). Per-persona organizer-vs-organizer test still pending real sessions.
  - Completion Evidence: migration applied via Supabase Management API (HTTP 201); pg_class shows grants/grant_deadlines/grant_matches/grant_applications/grant_documents with RLS + policies (3/2/1/1/1); anon isolation confirmed.
  - Commit: c55f246

- [~] CHAR-0002 — **Read path Verified in production**; authed write paths Code Complete (need a real user session to certify)
  - Area: Grants
  - Feature: Grant discovery + AI matching + application workflow
  - Description: `/grants` discovery (debounced search/filter), application drafts with submission/withdraw + guarded status transitions; `/api/ai/grant-match` deterministic ranker (AI-fallback pattern).
  - Agent: 5 (+6 for AI)
  - Priority: P1
  - Dependencies: CHAR-0001
  - Database: reads CHAR-0001 tables
  - API: `/api/grants` (GET/POST), `/api/grants/[id]`, `/api/grants/[id]/apply`, `/api/grants/applications` (GET), `/api/grants/applications/[id]` (GET/PATCH/DELETE), `/api/ai/grant-match`
  - UI: `/grants`, `/grants/[slug]`, `/dashboard/grants` (mobile-first)
  - Security: server-side authz per handler (auth via supabase-server; admin gate on POST); status-transition guards
  - Tests: 13 unit tests (scorer + zod schemas) **passing**; production read/validation verified (see below); authed apply/submit/withdraw lifecycle still needs a real logged-in session to certify
  - Completion Evidence: `__tests__/grants.test.ts` 13/13 pass; **PROD** `GET https://www.charitme.com/api/grants` → 200 `{grants:[],total:0}`; `?limit=999` → 400 zod error; `?q=health` → 200; `next build` compiled all 8 grants routes
  - Commit: c55f246
  - Follow-ups: sidebar nav entry (shared `CharitMeApp` nav — Agent 8); grant_documents upload UI; grant seed data; AI provider enrichment layer on top of deterministic ranker

- [x] CHAR-0003 — **Verified in production** (schema + RLS applied to live Supabase 2026-07-19)
  - Area: Volunteers
  - Feature: Volunteer data model + RLS
  - Description: `volunteer_opportunities`, `volunteer_profiles`, `volunteer_applications` (skills as `text[]` with GIN indexes; shifts/hours folded into applications for v1) with RLS.
  - Agent: 1 (+5)
  - Priority: P1
  - Database: new tables + RLS applied via Management API
  - Security: public read of open opportunities; opt-in public volunteer profiles; applicant-scoped applications; anon read of `volunteer_applications` returns 0 rows (isolation verified)
  - Tests: RLS verified (all 3 tables `rowsecurity=true`, policies 3/2/1); per-persona harness pending
  - Completion Evidence: migration `20260719010000_volunteers.sql` applied (HTTP 201); pg_class RLS check passed
  - Commit: d82e89b
  - Follow-ups: separate `volunteer_shifts`/`volunteer_hours` tables; opportunity-owner review access to applications; volunteer_profiles editor UI

- [~] CHAR-0004 — **Code Complete** (read path deploys to prod; authed writes need a real session to certify)
  - Area: Volunteers
  - Feature: Volunteer marketplace + matching + hours tracking
  - Description: Opportunity discovery/search/filter (remote), idempotent apply, application tracking + withdraw, deterministic skill-match scorer (AI-fallback).
  - Agent: 5 (+6)
  - Priority: P2
  - Dependencies: CHAR-0003
  - API: `/api/volunteers/opportunities` (GET/POST), `/api/volunteers/opportunities/[id]/apply`, `/api/volunteers/applications` (GET), `/api/volunteers/applications/[id]` (PATCH withdraw)
  - UI: `/volunteer`, `/volunteer/[slug]`, `/dashboard/volunteer` (mobile-first) + sidebar nav
  - Tests: 11 unit tests (scorer + schemas + slots) passing; `next build` compiled all routes
  - Completion Evidence: 363 tests pass; typecheck clean; build green
  - Commit: d82e89b
  - Follow-ups: admin opportunities management UI (mirror admin grants); hours logging + verification UI; AI matching enrichment

- [x] CHAR-0005 — **Built + verified** (RSVP round-trip + RLS, this session)
  - Area: Events
  - Feature: Events data model + RLS
  - Description: `events`, `event_registrations`, `event_tickets`, `event_checkins` with capacity/waitlist constraints + RLS.
  - Agent: 1
  - Priority: P2
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0006 — **Built** (`fundraising_events`/`event_registrations`/`event_checkins`, `/api/events/*`)
  - Area: Events
  - Feature: Event pages, registration, ticketing, QR check-in
  - Description: Event pages, free/ticketed registration reusing Stripe checkout, attendee management, QR check-in, event-linked campaigns.
  - Agent: 2 (+3 for ticketing)
  - Priority: P2
  - Dependencies: CHAR-0005, payments infra
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0007 — **Built** (`impact_plans/updates/metrics`, `/api/impact/*`, `lib/impact.ts`)
  - Area: Impact tracking
  - Feature: Formal impact plans/updates/evidence/metrics
  - Description: `impact_plans`, `impact_updates`, `impact_evidence`, `impact_metrics` layered onto existing `transparency_ledger_items`; public impact dashboard + donor impact feed; AI impact summaries.
  - Agent: 2 (+6)
  - Priority: P1
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0008 — **CSR dashboard built + verified** (this session) — `/dashboard/corporate`
  lets a matching-program sponsor review employee claims (approve/decline/mark-paid via
  existing `PATCH /api/matching/claims/:id`) with committed/paid/pending rollups.
  Built on master's `matching_programs`/`matching_claims`/`matching-core` (the stale
  branch's conflicting `/api/corporate/*` design was deliberately not ported).
  Evidence: `summarizeProgramClaims` unit-tested (4, 750 total); `next build` compiles
  the route; live round-trip confirmed the summary math + approve write (test data
  removed, 0 residue). Nav entry added. Follow-up (P3): `corporate_accounts`/`_members`
  for multi-admin company grouping (today a single `sponsor_id` owns each program).
  - Area: Corporate giving
  - Feature: Corporate accounts + matching-gift workflow
  - Description: `corporate_accounts`, `corporate_members`, match rules/limits/approval routing; extend `lib/employer-matching.ts`; CSR dashboard.
  - Agent: 5
  - Priority: P2
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0009 — **Built** (`sponsorship_opportunities/requests`, `/api/sponsorships/*`)
  - Area: Sponsors
  - Feature: Sponsorship opportunity → request → agreement workflow
  - Description: `sponsorship_opportunities`, `sponsorship_requests`, `sponsorship_agreements`; proposals, packages, fulfillment tracking, AI sponsor matching.
  - Agent: 5 (+6)
  - Priority: P3
  - Dependencies: existing `sponsors`
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0010 — **Code is DONE; blocked only on 4 production env vars** (2026-07-23 audit)
  - Area: Monetization
  - Feature: Subscriptions + entitlements + billing portal
  - Description: `subscriptions`, `subscription_items`, `entitlements`, `invoices`; Stripe Billing; feature-flag/entitlement gating for premium analytics/CRM/marketing/AI.
  - **Audit finding**: the whole revenue path already exists and is wired — `POST /api/stripe/checkout` (`mode:'subscription'`), `/api/stripe/portal`, `BillingPortalButton`, webhook handling for `customer.subscription.updated|deleted` + `invoice.payment_succeeded|failed`, `subscriptions` table in prod, and `lib/entitlements.ts` resolving tier from it. **It cannot take a single payment** because `PRICE_MAP` reads env vars that are unset in production, so every subscribe attempt returns 400 "Stripe price not configured".
  - **Unblock (owner action — Vercel env, all 4, then redeploy):**
    - `STRIPE_STARTER_MONTHLY_PRICE_ID=price_1TbRHnBrwQtGmNLkGHtm2BrD` ($19/mo)
    - `STRIPE_STARTER_YEARLY_PRICE_ID=price_1TbRI5BrwQtGmNLk6BdLGetC` ($228/yr)
    - `STRIPE_PRO_MONTHLY_PRICE_ID=price_1TbRIKBrwQtGmNLknRFNkTZ5` ($59/mo)
    - `STRIPE_PRO_YEARLY_PRICE_ID=price_1TbRIWBrwQtGmNLkkh0b32KR` ($708/yr)
  - Price IDs read live from Stripe (read-only) and confirmed against the CharitMe Starter/Pro products. Added to local `apps/web/.env.local` already. NOTE: the Stripe account also hosts unrelated products (FamilyOS, Trading Elite, Eli54U) — do not wire those.
  - Remaining after unblock: verify a real subscribe → webhook → entitlement upgrade round-trip in **Stripe test mode** (never with the live keys), then dunning/invoice history UI.
  - Agent: 3 (+9)
  - Priority: P2
  - Dependencies: Stripe (needs-staging)
  - Security: entitlement checks server-side
  - Completion Evidence: —
  - Commit: —

- [x] CHAR-0011 — **Built + live** (`gamification-persist.ts` wired to `/achievements`; 120 `user_badges` rows live)
  - Area: Gamification
  - Feature: Persist badges/challenges/leaderboard state
  - Description: `badges`, `user_badges`, `challenges`, `challenge_participants`; wire `lib/gamification.ts` to DB instead of computed-only.
  - Agent: 4
  - Priority: P3
  - Dependencies: none
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0012 — **Audit done + RLS-contract CI guard shipped**; repeatable read-only live smoke harness added, full persona matrix still needs staging sessions
  - Area: Security / hardening
  - Feature: RLS coverage audit + automated RLS tests
  - **Guard shipped (2026-07-21):** `apps/web/__tests__/schema-rls.test.ts` pins the live RLS posture (`fixtures/schema-rls.json`) and fails CI if any public table loses RLS or any sensitive financial/PII table gains a public `USING(true)` read policy (the LB-006 class). Proven to catch injected regressions. Refresh via `npm run schema:snapshot`.
  - Audit result (refreshed 2026-07-21, live prod, 143 tables): **0 with RLS disabled**; 24 legitimately-public display tables; **0 sensitive tables publicly readable** (financial-table policies verified — see `payment-audit.md`).
  - Follow-up: full per-persona (donor/organizer/nonprofit/corporate/T&S/finance/support/admin) live certification with real anon/authenticated sessions (needs staging auth).
  - **New verification tool (2026-07-23):** `npm run test:rls-live` checks anonymous isolation and, when `CHARITME_RLS_TEST_USERS_JSON` is supplied, authenticated own-vs-other profile isolation using real access tokens. It is read-only and does not use the service-role key; run against staging before promoting evidence.
  - **Anonymous persona CERTIFIED CLEAN (2026-07-23, commit `34db04b`):** live probe of **all 144 public tables** with the browser anon key → **0 unexpected exposure**. Repeatable: `node scripts/rls-anon-audit.mjs --ci` (exit 1 on any new leak *or* any table that errors instead of denying). Complements the schema-contract test above by probing actual row visibility rather than policy shape.
  - **Two production issues found & fixed** (migration `20260727000000_lock_down_admin_config_rls.sql`). These were missed by the earlier sweep because it classified only financial/PII tables as sensitive:
    1. *Information disclosure* — `platform_settings` + `feature_flags` carried `using (true)` public-read policies, exposing fee config, support contacts, `stripeLiveMode`, `maintenanceMode`, `allowNewRegistrations`, and every feature flag including unreleased ones (the unshipped roadmap). No credentials leaked. All 12 app references use `supabaseAdmin`, so the lockdown is a no-op for the app.
    2. *Latent infinite RLS recursion* — `is_admin()` selects from `profiles`, whose SELECT policy is `(auth.uid() = id) OR is_admin()` → recursion → Postgres `54001`. Masked wherever a `using (true)` policy short-circuited the OR; it meant **any** table whose only applicable policy is `is_admin()` errored instead of denying cleanly. Fixed with `SECURITY DEFINER` + pinned `search_path`; predicate unchanged, so no privilege is widened.
  - **Bonus fix:** the recursion repair un-broke the public transparency surface — published `impact_plans`/`impact_updates` (+ items/evidence/metrics) previously errored for anonymous visitors, so donors could not see how funds were used. Now correctly visible and confirmed status-gated.
  - Description: Enumerate every user-accessible table, confirm RLS enabled + policies, add automated per-persona RLS tests (unauth, donor, organizer, nonprofit admin, corporate admin, T&S, finance, support, super admin).
  - Agent: 1 (+7)
  - Priority: P0
  - Dependencies: none
  - Security: core
  - Tests: RLS matrix (needs-staging for live verification)
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0013 — **Env validation + secret-exposure guard DONE**; public mutation rate-limit coverage added; full script-src CSP deferred (needs browser)
  - Area: Security / hardening
  - Feature: Env validation + secret-exposure audit + security headers/CSP
  - Description: Zod-validated env schema at boot; audit that no service-role/Stripe/AI secrets reach client bundles; add CSP + security headers; confirm rate-limiting coverage (`lib/rate-limit.ts`).
  - Agent: 1 (+9)
  - Priority: P0
  - Dependencies: none
  - Completion Evidence: `lib/env.ts` (zod schema, non-throwing `validateEnv`) + `npm run check:env` preflight; `__tests__/env.test.ts` (8) + `__tests__/secret-exposure.test.ts` (4) — the guard caught 4 client files pulling the Stripe server SDK for `formatCents`, fixed by moving it to `@shared/currencies`. Security headers (CSP frame-ancestors, HSTS, X-Frame-Options, Permissions-Policy, nosniff) already present in `middleware.ts`/`next.config.js`. Docs: `docs/security/env-and-secret-exposure.md`. 674 tests pass, type-clean, build 132 pages.
  - Remaining: full `script-src`/`style-src` CSP (needs a browser to verify it doesn't break the inline-style design system).
  - Commit: (this PR)

- [ ] CHAR-0014
  - Area: QA / observability
  - Feature: E2E smoke suite across personas + Playwright wiring
  - Description: Playwright smoke tests for register→create→donate→payout→admin against staging; expand from current e2e footprint.
  - Agent: 9
  - Priority: P1
  - Dependencies: staging env (needs-staging)
  - Completion Evidence: —
  - Commit: —

- [ ] CHAR-0015
  - Area: Mobile / a11y
  - Feature: Full responsive + WCAG 2.2 AA sweep
  - Description: Verify every primary flow at 320–1920px and against axe; fix overflow, tap targets, focus order, labels, contrast, reduced-motion. (Ongoing; dark-mode default + hero-card fixes already landed.)
  - Agent: 8
  - Priority: P1
  - Dependencies: none
  - Completion Evidence: dark-mode default (commit d32bb02); hero card nudge (commit 1f5a6fe)
  - **Keyboard/semantics pass on public-facing components (2026-07-22):** cleared
    jsx-a11y warnings on NotificationBell (click-only <div> items → <button>),
    create GuestLoginModal (backdrop role=presentation, card role=dialog/aria-modal,
    Escape-to-close), create AiFollowUps (autoFocus → focus-follows-question via
    ref/effect), HeroRotator (decorative hover-pause → role=presentation). Verified:
    lint clean on those files, typecheck clean, `next build` compiles. **Remaining:**
    the bulk of the ~180 jsx-a11y warnings live in `/admin/*` internal tools (lower
    user impact); full axe/contrast/tap-target/320–1920px sweep still needs a browser.
  - **✅ SWEEP COMPLETE (2026-07-25, Claude).** All of the above "remaining" work is
    now done and measured, not asserted:
    * **jsx-a11y warnings: ~180 → 0** across `app`, `components`, `lib` (last two
      cleared: a dynamic-text `<label>` in the super-admin Banner client → explicit
      `aria-label`; a stale `eslint-disable` in `opengraph-image`).
    * **Lighthouse accessibility 100 on 19 public pages** (mobile emulation, real
      prod builds): home, how-it-works, campaigns, faq, for-donors, for-nonprofits,
      pricing, success-stories, leaderboard, grants, volunteer, events, sponsor,
      matching, about-us, blog, features, contact, help, trust-safety, fast-payouts,
      supported-countries, for-individuals.
    * **Contrast:** fixed `--violet`-as-text on dark (3.06:1 → AA token), the
      marketing dark-mode tint surfaces, the fee-calc badge/warning, the faq CTA,
      and a sitewide banner-default regression (2.62:1) — with a contrast-ratio
      unit test added so it cannot recur.
    * **Tap targets: 28 undersized → 0** (banner dismiss, footer links, carousel
      dots, breadcrumbs) at 390×844 device emulation.
    * **Responsive: 0 horizontal overflow on all 17 public pages at 390px**, plus a
      genuinely broken `/leaderboard` mobile layout fixed (title column was
      collapsing to 18px and wrapping one character per line).
    * Gates: tsc 0, lint 0 warnings, **1063/1063 tests**, `next build` green.
    **Still open (needs a real browser matrix / owner):** axe-core runs on
    authenticated dashboard + admin flows, and the 320px/1920px extremes — these
    need a logged-in session, which this sandbox cannot drive.
  - **Dark/light theme sweep — dashboard COMPLETE (2026-07-22):** every campaign
    management panel (#43, #46: Updates/Settings/Supporters/FAQs/Ledger/ThankDonors/
    CampaignControls/EditCampaign/TrustScore/Analytics) **plus all non-campaign
    dashboard views** (payouts cards, notifications, new-update, refund, corporate,
    team, integrations, analytics, settings + mfa, ai-coach, ai-growth-plan,
    messages, home, recurring, rewards, milestones, payout-setup, plan-features,
    donor) converted from hardcoded light palettes to design tokens + theme-aware
    rgba tints. Intentional literals kept (integration brand colors, chart accents,
    gradient ends, amber/orange status, white button text). Each batch: tsc + lint
    clean, 863 tests pass. Remaining: public/marketing pages that still hardcode
    (some use Tailwind slate/emerald utilities not wired to `[data-theme]`).
  - Commit: (in progress)

- [ ] CHAR-0016
  - Area: Infra
  - Feature: Staging environment + verification unblock
  - Description: Stand up a staging Supabase project + Stripe test keys so data/payment/payout/RLS/webhook flows can be truly verified (unblocks the `needs-staging` tag across the backlog).
  - Agent: 0 (requires user/owner action for secrets)
  - Priority: P0
  - Dependencies: user provides staging credentials
  - Completion Evidence: —
  - Commit: —

- [~] CHAR-0017 — **Dual-path campaign builder (AI + guided) — audit done, first slice shipped, program continues**
  - Area: Campaign creation
  - Priority: P1
  - Owner goal: from an idea to a publish-ready campaign in minutes, via EITHER a
    "Build with AI" prompt path OR a step-by-step guided path, both converging on
    the same canonical campaign model, review, payout, verification, and publish.

  - **What ALREADY exists (do NOT rebuild — extend/consolidate):**
    - Guided path: `apps/web/app/create/page.tsx` — 1,696-line 9-step wizard
      (Type → Category → Location → Story → Title → Goal → Media → Get Paid → Review),
      `sessionStorage['cm_wizard']` autosave/resume, draft save (campaign
      `status='draft'`), Stripe Connect + Venmo/PayPal/GooglePay/Sinch payout step,
      publish via `POST /api/campaigns`.
    - AI path entry: `apps/web/app/ai-campaign/page.tsx` (prompt box + popular
      requests) → routes to `/create?ai=<prompt>`.
    - AI engine: `apps/web/app/api/ai/campaign/route.ts` — real OpenAI
      (`gpt-4.1-mini`) with deterministic `fallbackAiCampaign()` (`lib/openai.ts`),
      zod-validated, durable rate-limited, logged to `ai_generations`.
    - Drafts are currently just `campaigns` rows with `status='draft'` — there are
      NO dedicated `campaign_drafts` / `campaign_ai_sessions` / `campaign_creation_*`
      tables yet.

  - **DONE this session (shipped on branch `claude/charitme-github-integration-tbaz3i`, commit 9c7b142):**
    - Fixed broken Build-with-AI path: `/create` never read `?ai=<prompt>`, so the
      organizer's typed prompt was silently dropped. Now `/create` consumes `?ai=`,
      seeds the story, jumps to the Story step, and generates the first draft once
      (fallback guarantees non-empty, reviewable content). `runAi()` takes an
      optional notes override.
    - Added `__tests__/ai-campaign-fallback.test.ts` (5 tests) locking the "AI
      always returns complete content + carries the prompt into the story" contract.
    - Verified: typecheck + lint clean, build compiles, 782 tests pass.

  - **REAL gaps — sandbox-buildable, ordered by recommended sequence (pick up here):**
    1. ✅ **DONE (2026-07-21)** — Co-equal entry screen `/create/choose-path`
       presenting **Build with AI** (≈2 min) vs **Step by step** (≈10 min) as equals,
       with autosave/resume reassurance; theme-aware + mobile-first (cards stack
       < 720px). Repointed **40 generic `/create` CTAs across 24 files** (the explicit
       "…With AI" / `/ai-campaign` entries kept direct). Made the chooser a **public**
       middleware exception (viewable before sign-in, like `/ai-campaign`; the
       `/create` wizard stays login-gated). Verified: typecheck/lint clean, `next build`
       prerenders the route, live server returns **200 unauthenticated**, Playwright
       screenshot confirms the rendered design.
    2. ✅ **DONE (2026-07-21)** — AI follow-up question flow. After the AI drafts a
       campaign, the story step now asks only the human facts the AI can't infer,
       ONE at a time — who it's for, beneficiary name, relationship, category, goal,
       deadline — skipping anything the AI or profile already filled; each answer
       writes straight to the wizard form (draft updates live) so the next question
       is re-derived; skippable questions offer "I'm not sure". Pure logic
       `lib/campaign-followups.ts` (`followUpPlan`/`nextFollowUp`, 7 unit tests) +
       `app/create/AiFollowUps.tsx` (themed, mobile-first) wired into the story step.
       Verified: typecheck/lint clean, `next build` compiles, 797 tests pass.
       Follow-up (needs richer form model): use-of-funds line items, explicit
       payout-recipient/consent/anonymity fields (not in the current `FormState`).
    3. 🟡 **Partial (2026-07-22)** — Guided path: one primary question per screen.
       The 9-step wizard is already largely one-question-per-screen; the crowded
       exception was the required **Get Paid** step showing five payout methods
       flat (decision paralysis at the conversion-critical moment). Now leads with
       the one recommended option (Stripe Connect) and tucks the four alternates
       (Venmo/Google Pay/PayPal/Sinch) behind a **"More ways to get paid"**
       disclosure — alternates stay mounted (display toggle) so connected-state
       detection holds, and it auto-opens when any alternate is already linked.
       Verified: typecheck/lint clean, `next build` compiles, 776 tests pass.
       **Still to do (lower value):** collapse the location step's secondary ZIP
       behind an optional reveal; progressive disclosure for the goal step's
       auto-goal box.
    4. ✅ **DONE (2026-07-21)** — Publish-readiness engine. `lib/campaign-readiness.ts`
       (`publishReadiness`, 7 unit tests) scores title/story/goal/category/location/
       media/payout (+ beneficiary when for someone else); `required` items mirror the
       publish API EXACTLY (title/story/goal) so `readyToPublish` never disagrees with
       the server. `ReadinessChecklist.tsx` renders a live %-bar + checklist on the
       review step; each unfinished item is a **Fix →** button that jumps to its exact
       wizard step. Verified: typecheck/lint clean, `next build` compiles, 804 tests pass.
    5. ✅ **DONE (2026-07-22)** — Story quality signals done: `lib/story-analysis.ts`
       (`analyzeStory`, 5 unit tests) computes real length/structure/specificity/
       clear-ask/**unsupported-claim** signals; wired into the story step's "Strengthen
       your story" box, **replacing the previously-hardcoded fake badges** with live,
       actionable ones (tooltips explain each). AI rewrite already exists (the
       "Enhance" button → `runAi`). **✅ Structured sections + tone presets DONE
       (2026-07-22):** `lib/story-scaffold.ts` (`composeStory`/`sectionsFromText`/
       `sectionsFilled`/`TONE_PRESETS`, 7 unit tests) + `StorySectionsEditor.tsx`
       give the story step a "Guide me" mode — four sections (intro/problem/
       solution/ask) that compose into the SAME `description` field (no schema
       change, seeds from existing text so switching modes never clobbers) — plus
       tone presets (Heartfelt/Urgent/Hopeful/Straightforward) that drive an AI
       rewrite via the endpoint's existing `tone` param (`runAi` gained tone +
       forceStory overrides). Verified: typecheck/lint clean, `next build`
       compiles, unit tests pass. **Gap #5 now complete.**
    6. 🟡 **Partial (2026-07-22)** — Fee/net-proceeds breakdown done:
       `lib/goal-proceeds.ts` (`goalProceeds`, 5 unit tests) computes CharitMe's
       0% platform fee + illustrative single-transaction processing estimate,
       reusing `@shared/fees` constants so figures never drift from checkout;
       `GoalProceedsBreakdown.tsx` renders "Where your $X goes → you keep ~$N"
       on the goal step once a valid goal is entered (themed, mobile-first).
       Verified: typecheck/lint clean, `next build` compiles, unit tests pass.
       **Still to do:** line-item use-of-funds builder (needs a richer form
       model / schema — not in current `FormState`; owner/staging-gated).
    7. Admin observability: `/admin/campaign-builder{,/funnels,/ai,/verification,/errors}`.

  - **Owner/staging-gated (CANNOT be certified from sandbox — see CHAR-0016):**
    - New builder/draft/AI-session tables + RLS + triggers must be applied to LIVE
      Supabase via the Management API (no local migration path here).
    - Stripe Connect "payout ready/KYC" confirmation needs live Connect enablement
      (existing launch blocker LB-005).
    - Real AI generation needs `OPENAI_API_KEY` (sandbox runs the deterministic
      fallback only).
    - Full E2E / mobile / axe sweep needs a running authed app + staging data.

  - **Handoff notes for the next agent:**
    - Land/merge the open PR (theme polish + this AI fix) FIRST so builder work does
      not keep stacking on that branch; then branch fresh from latest master.
    - Reuse the `campaigns` model + `/api/campaigns` + `lib/openai.ts`; do NOT
      duplicate. Consolidate `/ai-campaign` and `/create` rather than forking a
      third flow.
    - Keep everything design-token themed (light/dark) and mobile-first; the create
      flow uses `cr2-*` classes in `globals.css`.
  - Commit: 9c7b142 (AI-path fix + tests)

> Backlog continues: each remaining capability in Section B becomes CHAR-#### tasks
> as its slice is scheduled. Completed tasks move to **Section C — Completed** with evidence.

---

## Campaign Image workstream

Context: campaigns are procedurally seeded with **no per-row image**; covers were
assigned per-category, so every campaign in a category shared one identical cover
(and 5 categories shared covers with each other). Full audit in
`CAMPAIGN_IMAGE_AUDIT.md`.

- [x] IMG-01 — **Done.** Distinct cover per category (was 2 collisions across 5
  categories). 3 new HTTP-200-verified covers sourced (Emergency/Travel/Wishes).
  Evidence: `audit:campaign-images` cover-uniqueness check passes.
- [x] IMG-02 — **Done.** Per-campaign cover distribution. App:
  `getCoverForCampaign(category, key)` (FNV-1a over slug) wired into all 6 cover
  consumers + `CampaignImage`. DB: migration
  `20260723000000_campaign_cover_per_campaign.sql` (protects user uploads).
  Evidence: `__tests__/photo-catalog.test.ts` (11) + full build.
- [x] IMG-03 — **Done.** CI audit `npm run audit:campaign-images[:live]` — exits
  non-zero on broken (non-200), shared covers, small pools, bad host/params.
  Evidence: 45/45 IDs HTTP 200 live.
- [x] IMG-04 — **Done.** Docs: `CAMPAIGN_IMAGE_AUDIT.md`,
  `CAMPAIGN_IMAGE_SOURCES.md`, `CAMPAIGN_IMAGE_CHANGELOG.md`.
- [x] IMG-05 — **Done (2026-07-25).** Covers moved off the external hotlink onto
  Supabase Storage — it did not need staging; the `campaign-media` public bucket
  already existed. **This closed a real production risk:** all 500 covers pointed at
  `picsum.photos`, so a rate-limit, id change or outage there would have broken
  every campaign image on the site at once.
  `scripts/localize-campaign-covers.mjs` downloads each cover, re-encodes to WebP
  (1200x900, q82), uploads to `campaign-media/covers/<slug>.webp` with a
  one-year immutable cache header, and repoints `cover_image_url`/`image_urls`.
  Dry-run by default, idempotent (upsert + skips anything already local).
  **Applied: 500/500 localized, 0 failures, 0 still external, 500 distinct.**
  Verified live: `/campaigns` serves 120 Storage covers and **0 picsum refs**.
  Re-ran the IMG-06 dHash audit afterwards — the WebP re-encode had nudged one
  pair to the d=5 boundary, so that campaign was reassigned to a
  verified-distinct image; **final: 0 exact, 0 near-duplicate**.
  Also wired `lib/img-optimize.ts` to route Storage objects through
  `render/image/public` (the object endpoint always returns the full-size
  original) — a 400px card variant is ~42KB vs ~83KB.
- [x] IMG-06 — **Done (2026-07-25).** Perceptual/dHash near-duplicate detection over
  image **binaries** — it did not need staging after all. `scripts/audit-image-dupes.mjs`
  downloads every cover, reduces to a 9x8 greyscale, computes a 64-bit dHash and
  flags any pair within a Hamming threshold (exits 1, so it can gate CI).
  **It immediately caught what URL-level dedup could not:** different Lorem Picsum
  ids that resolve to *visually identical* photos — 1 exact-identical pair
  (`id/128` == `id/456`) plus 20 near-duplicate pairs, i.e. the "0 duplicates" goal
  was **not actually met** despite 500 distinct URLs.
  Fixed with `scripts/fix-image-dupes.mjs`: hashes all covers, keeps the first of
  each conflicting cluster, and reassigns the other 9 campaigns to replacement
  Picsum ids whose hash is **verified distinct from every kept image before it is
  written** (dry-run by default, `--apply` to commit). Applied to production.
  **Re-audit: 500 covers, 0 exact-identical groups, 0 near-duplicate pairs.**
- [~] IMG-07 — **Responsive/theme half DONE (2026-07-25); visual-relevance grading
  still open.** The sandbox does have a browser (Playwright + Chromium), so the
  responsive regression sweep no longer needs staging:
  `scripts/audit-responsive.mjs` loads **every public page at 320px and 1920px in
  BOTH light and dark**, pinning the app's own `charitme-theme-v2` (not just the OS
  `prefers-color-scheme`), and fails on horizontal overflow, any element wider than
  the viewport, or images that fail to decode. Exits 1 so it can gate CI.
  **Result: 17 pages × 2 viewports × 2 themes = 68 renders, 0 findings.**
  **Still open:** per-image *visual relevance / aesthetic quality* grading — that
  needs a vision model to judge whether a photo suits its campaign, which is a
  judgement call rather than a measurable regression.
- [x] IMG-08 — **Done (2026-07-25).** Storage-bucket hardening audit, now that
  IMG-05 put real objects in `campaign-media`.
  **Audited the upload path — already sound:** auth required, MIME allow-list,
  10MB cap, `canManageCampaign` authorisation before writing into a campaign
  folder, and server-generated filenames (the extension is stripped to
  `[a-z0-9]`), so the caller never controls the object key.
  **Found a fragile authorisation in DELETE:** it authorises with
  `path.startsWith('campaigns/<userId>/')` and then passes the caller's string
  straight to `storage.remove()`. **Tested against production with a throwaway
  probe object: NOT exploitable** — Supabase Storage treats keys as opaque, so
  `campaigns/<me>/../../covers/x.webp` is a literal key and the probe survived
  (probe cleaned up, 0 left). But the check is only safe *because of* that
  implementation detail; if key normalisation ever changed it would become
  "delete any object in the bucket" for any signed-in user.
  **Hardened:** new `lib/storage-path.ts#isSafeStoragePath` rejects traversal
  (`.`/`..`), absolute paths, schemes, backslashes, percent-encoding, control
  characters, empty/doubled segments and over-long keys; DELETE now validates
  shape *before* the ownership check. 7 unit tests cover each bypass class.
- [x] **GOAL — Image uniqueness: every image unique, 0 duplicates** (`scripts/image-uniqueness-audit.mjs`)
  - Certified across static assets + live DB. **0 byte-identical static images** (7 files). **DB image columns 100% unique**: `campaigns.cover_image_url` 500/500, `campaign_media.public_url` 500/500, `sponsors.logo_url` 50/50, `profiles.avatar_url` 503/503. No hardcoded stock image reused across pages (all source hits are test fixtures / one admin input placeholder).
  - Repeatable guard: `node scripts/image-uniqueness-audit.mjs --ci` (exit 1 on any byte-identical asset or DB image-column duplication). Static check runs even without DB creds.
  - Open follow-up (not a duplicate — a *gap*): 620 `nonprofit_profiles` have no `logo_url` and 627 `profiles` have no avatar; these render placeholders, not dupes.

- [x] **GOAL — Payment methods audit (all payment methods work properly)** (2026-07-23, read-only Stripe verification, no charges)
  - **Live Stripe account `acct_1TNul7…` fully operational**: `charges_enabled=true`, `payouts_enabled=true`, `details_submitted=true`, country US, default USD.
  - **Code enables 9 methods** (`lib/stripe.ts`) with graceful degradation: `createCheckoutSession` progressively strips methods the account hasn't activated and retries, falling back to card-only so checkout never breaks. One-time: card (Apple Pay/Google Pay wallets), Link, Cash App, ACH (`us_bank_account`), Amazon Pay, PayPal, Klarna, Afterpay, Affirm. Recurring: card, Link, ACH, PayPal.
  - **7/9 active on the live account** and working: card, link, cashapp, us_bank_account (ACH), amazon_pay, klarna, afterpay_clearpay, plus `transfers` (Connect payouts). ⚠️ **`paypal_payments` and `affirm_payments` are NOT active** — configured in code but require activation in the **Stripe Dashboard by the account owner** (I must not change payment/account settings). Until then the retry logic silently drops them (checkout still works, they just don't appear). **Owner action item.**
  - Not code-testable further from here without live charges (live keys — will not charge). Full transactional verification needs Stripe **test-mode** keys.

- [x] **GOAL — Production feature/wiring audit (every feature works + wired to Supabase)** (2026-07-23)
  - **39/39 public pages** return 2xx/3xx in production (/, about, achievements, ai-campaign, ai-fundraising, blog, campaigns, contact, create, donor, events, faq, fast-payouts, features, fees, for-donors/individuals/nonprofits, grants, help, how-it-works, impact, leaderboard, login, matching, offline, pricing, privacy, privacy-center, refunds, security, sponsor, success-stories, supported-countries, terms, transparency, trust-safety, volunteer).
  - **Every feature data endpoint returns real Supabase data**: rotator 7, stories 12, grants 24, volunteers 24, leaderboard 20/20, sponsors 40, matching-programs 60, events 60, sponsorships 60, campaigns live. `/api/trust-score` correctly POST-only (GET→405, verified intentional). Grants + volunteers are now populated (24 each), so those discovery features are testable end-to-end.
  - Repeatable via the probe in this commit's audit; no code changes needed — the platform is genuinely well-wired.

- [x] **GOAL — Master health gates green** (2026-07-23, master `e8458d2`): `tsc --noEmit` clean, **936 tests pass (75 files)**, `next build` compiles. Verified after the seed-guard + tax + SEO/AEO (#53) + CSP (#55) merges.
  - **Codex SEO/AEO/marketing engine confirmed done & on master** (via PR #53): `lib/seo.ts`, `lib/aeo.ts`, `AeoContent`, `MarketingTracker`, admin SEO/AEO UIs all present; prod DB has 17 `marketing_*` tables + 242 `aeo_entries`. The long-running `agent/seo-aeo-marketing-engine` branch is stale/superseded (217 behind, ~88 conflicts) — its work shipped via short-lived `codex/*` PR branches; do NOT bulk-merge it (would revert hardening).

### 2026-07-23 — Branch integration, security certification, and parity backfill

- [x] **CHAR-0018 — Integrate all outstanding branch work** (`46fa5e4 → 4ba081b`)
  - GitHub reported **0 open PRs** (52 closed / 49 merged) — earlier merges had already closed #51/#52. Remaining work lived on unmerged branches, so those were integrated instead.
  - Merged `codex/seed-guard` (**21 commits**): nonce-based CSP, fail-closed tax exports, sanitized API error responses, hardened public-mutation rate limits, restricted health diagnostics, fail-closed on missing auth profiles, schema-drift reconcile, live RLS smoke harness, production security-header tests.
  - **5 merge conflicts resolved in favour of the security-correct side.** Two were material financial fixes: (a) `tax-server.ts` previously destructured query results without checking `error`, so a failed query would still emit a tax statement from partial data — now throws `TAX_DATA_UNAVAILABLE`; (b) receipt numbers were fabricated (`RCP-2026-ABC…`) when absent — now `null`, since inventing a receipt number on a tax document is a compliance problem. Also kept the new nonce-CSP assertions in `security-headers.spec.ts`, since the pre-existing `toBe("frame-ancestors 'self'")` would have failed against the CSP shipping in the same merge.
  - Gates: typecheck ✓, **935 tests** ✓ (from 921), `next build` ✓.
  - **Verified live:** production CSP is now `default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'nonce-…'`; 200 on health, `/`, `/campaigns`, `/pricing`, `/grants`, `/volunteer`, volunteers API.
  - **Not merged:** `agent/seo-aeo-marketing-engine` (102 ahead / 188 behind) — another session's actively-worked branch; needs its owner to rebase before it can be safely integrated.

- [x] **CHAR-0019 — Fix admin-config data exposure + latent RLS recursion** (`34db04b`, migration `20260727000000_lock_down_admin_config_rls.sql`)
  - `platform_settings` + `feature_flags` had `using (true)` public-read policies. Since the anon key ships to every browser, any visitor could read fee configuration, support contacts, `stripeLiveMode`, `maintenanceMode`, `allowNewRegistrations`, and **every feature flag including unreleased ones**. No credentials exposed. All 12 referencing files use `supabaseAdmin`, so lockdown was a no-op for the app.
  - **Latent infinite RLS recursion:** `is_admin()` selects from `profiles`, whose SELECT policy is `(auth.uid() = id) OR is_admin()` → recursion → Postgres `54001`. Masked wherever a `using (true)` policy short-circuited the OR; it meant *any* table whose only applicable policy is `is_admin()` **errored instead of denying cleanly**. Fixed with `SECURITY DEFINER` + pinned `search_path`; predicate unchanged, so no privilege widened.
  - **Bonus:** the recursion fix un-broke the public transparency surface — published `impact_plans`/`impact_updates` (+ items/evidence/metrics) previously errored for anonymous visitors, so donors could not see how funds were used.

- [x] **CHAR-0020 — Anonymous-exposure certification + repeatable guard** (`46fa5e4`)
  - `scripts/rls-anon-audit.mjs --ci` probes **all 144 public tables** with the browser anon key and fails on any table returning rows without a justified allowlist entry, or any table that errors instead of denying. Complements the existing `schema-rls.test.ts` (which checks policy *shape*) by checking actual **row visibility** — that guard missed the two tables above because it only classified financial/PII tables as sensitive.
  - **Result: 144 tables probed, 0 unexpected exposure.** Every allowlist entry is annotated with the status/parent gate verified in `pg_policies`.

- [x] **CHAR-0021 — Backfill `creator_profiles` + `campaign_launch_settings`** (migrations `20260728000000_backfill_parity_tables.sql`, `20260728010000_gate_parity_public_reads.sql`)
  - Both tables were created with public-read policies but **0 rows**, while `campaign_launch_settings` is read by 10+ live routes (donations, recurring, analytics, settings, rewards, qr-poster, AI assistant) — every real campaign was falling back to implicit defaults.
  - **Backfilled 1,000 records from real data, not fabricated seed data:** 500 `campaign_launch_settings` (one per live campaign, schema defaults since `campaigns` carries no currency/country column) and 500 `creator_profiles` (one per profile that actually owns a campaign, using real `full_name` / `avatar_url`). **`bio` deliberately left NULL rather than invented**, because `creator_profiles` is publicly readable on a live fundraising site. Verified: 500 distinct handles (zero collisions), 0 empty display names, and re-running the migration leaves counts at 500/500 (idempotent via unique indexes + `ON CONFLICT DO NOTHING`).
  - **Security fix found while backfilling:** both tables carried blanket `using (true)` reads, inconsistent with `campaigns_public_read` (`status='active' AND visibility='public' AND deleted_at IS NULL`). Of 500 campaigns only 350 are publicly visible, so **150 rows — including 50 drafts — were anonymously readable**, letting anyone enumerate unpublished campaigns and their funding model / launch type / product stage. Now gated to the same predicate as `campaigns_public_read`. **Verified: anon 500 → 350; service role still 500/500** (owner/admin dashboards unaffected via the existing `*_owner_write` ALL policies). Re-audit: 0 unexpected exposure.

- [x] Dark mode as default theme — commits `d32bb02`, `8267f29`; verified: `data-theme=dark` with no stored pref, light toggle preserved, no mobile overflow.
- [x] Hero floating stat-card visibility nudge — commit `1f5a6fe`; verified: cards 78px inside viewport at 1360px, reset to `right:0` on mobile.
- [x] Product TODO/roadmap from competitive audit — commit `54efa25`.

---

# Section B — Competitive Product Vision

Master list of everything CharitMe is building to become a world-class,
AI-first alternative to GoFundMe. Checkboxes track build status:
`[x]` = shipped, `[ ]` = planned.

> The competitive tables in sections 1–3 are the **aspirational roadmap**
> (what "world-class" looks like). The **audited status** below reflects what
> is actually implemented in the codebase today, based on a route/page-level
> audit — not marketing aspiration. Baseline health as of this audit:
> typecheck ✅, lint ✅ (0 errors), **339/339 unit tests ✅**, production
> build ✅ (118 pages).

---

## 0. Audited Implementation Status

Legend: **Built** = real page/route wired to Supabase exists and compiles;
**Partial** = core exists, depends on an unconfigured provider or is thin;
**Missing** = no implementation found.

### Built (verified present in codebase)
- **Auth**: email login/signup, password reset, OAuth callback, MFA page,
  session-cookie middleware, protected-route guard.
- **Campaigns**: create/edit/publish, updates, milestones, FAQs, rewards/tiers,
  ledger, supporters, team members, co-organizers, beneficiary invites,
  thank-donors, share tools, QR poster, embed widget, reports, categories.
- **Donations**: guest + registered checkout (Stripe), recurring (create/
  pause/cancel), receipts, refund requests, offline donations, donor wall.
- **Payments/Payouts (admin)**: Stripe Connect onboarding + status, payouts,
  refunds, disputes, reconciliation, processors, campaign payment flows,
  webhook handler.
- **Donor experience**: donor dashboard, donation history, saved/followed
  campaigns, recommended campaigns, receipts, donor profiles.
- **Discovery**: campaign search/filters, categories, leaderboards
  (campaigns + donors), success stories, sponsor bar.
- **AI suite**: campaign writer, coach, goal-recommend, content/rewrite,
  trust score, fraud monitor, matching finder, impact summary, payout
  concierge, complaint resolver, donor conversion, fee optimizer, viral loop.
- **Marketing**: admin marketing (campaigns, automations, segments, audience,
  copilot, outreach), organizer marketing, tracking links, unsubscribe.
- **Admin**: users, campaigns, donations, payouts, finance, content,
  trust-safety, support, countries, sponsors, settings, audit log, reports,
  system health, new-customers pipeline.
- **Trust & safety**: campaign/user reports, risk scoring (`lib/risk.ts`),
  fraud scan, trust reviews, trust signals.
- **Platform**: notifications, integrations, exports (donations/donors/full),
  PWA (service worker, offline page, install prompt), i18n scaffold,
  multi-currency, SEO (sitemap, robots, opengraph, JSON-LD).

### Partial (needs provider config or hardening)
- **SMS** (Twilio env unset), **AI image/video generation**, **semantic
  search** (keyword only today), **grant/sponsor/volunteer marketplaces**
  (sponsor records + matching exist; full marketplaces do not),
  **corporate giving / matching gifts** (employer-matching lib exists).

### Missing (genuinely not implemented)
- NFC tap-to-donate, crypto donations, stock/DAF/estate giving, native
  livestream donations, native mobile apps, volunteer shift/hours system,
  event ticketing/check-in, white-label custom domains.

---

## 0.1 Session Log — Verified Fixes (with evidence)

Format: `ID · area · what · evidence (commit)`. Only fixes verified by
tests/build/live-HTTP are listed here.

### Session 2026-07-23 (Claude, PR #50 — production hardening sweep)
- **CHAR-F063 · create-journey deep dive (audit + first fix)** — End-to-end review
  of the new-campaign builder (`app/create/page.tsx`, 2041 lines, 9-step wizard).
  _Scope note for other agents: this entry is owned by the production-ready agent;
  the fix below touches ONLY `goNext`/`submitCampaign` validation in
  `app/create/page.tsx`. Everything else is findings, not yet claimed — take any
  item and mark it here so we don't collide._

  **✅ FIXED this session — late validation (highest-impact friction).**
  Publishing enforces a 20-char story and a $1 minimum goal, but both were checked
  **only in `submitCampaign` at step 9 (Review)** — the story is collected at step 4
  and the goal at step 6. An organizer could complete all nine steps, hit Publish,
  and be rejected with no pointer to the offending step. `goNext` validated only
  the title and in-flight uploads. Now: (a) story + goal are validated **at their
  own step** (empty is still allowed — you can finish later; only a *too-short*
  entry is blocked), and (b) any failure that still reaches Publish **jumps the
  user to the step that owns it** instead of dead-ending on Review.

  **Confirmed already-good (do not "fix"):** payout is deliberately optional to
  publish (removes the biggest drop-off; the donation API blocks charges until the
  recipient is payout-ready); draft autosave/recovery to `localStorage` with an
  explicit resume-vs-start-fresh banner; per-step funnel analytics (`trackBuilder`);
  AI goal suggestion + AI story follow-ups; image type/size/count guards with
  partial-skip messaging rather than hard failure.

  **Open findings — ranked, unclaimed:**
  1. ~~**Step count.** 9 steps vs ~4–5 at GoFundMe/Donorbox.~~ **✅ DONE by another
     agent in #62** — wizard is now 7 steps (`type`+`category`+`location` merged
     into `basics`), with per-step time estimates. No further action.
  2. **Guest hard-gate — ✅ CLAIMED + FIXED by the production-ready agent (below).**
     After #62 the gate sat at the `basics`→`story` transition, i.e. **step 1 of 7** —
     blocking guests before *any* narrative investment. Moved to the `goal`→`media`
     transition (**step 4→5**), which is the first step that **technically** requires
     auth (`/api/upload/campaign-image` returns 401 without a session). Guests now
     complete Basics → Story → Title → Goal — the whole narrative, ~7 of ~10 minutes —
     before signing in, and the draft persists across sign-in (localStorage +
     Supabase cross-device via #61) so nothing is lost.
     _Moving the gate any later needs guest uploads to a temp bucket + claim-on-signup
     — a real backlog item, not done here._
  2b. **✅ FIXED — "Continue with Apple" signed you in with Google.** In the builder's
     guest modal the Apple button called `handleOAuth('google')` (the handler was even
     typed `(provider: 'google')`), so a user picking Apple got a Google consent
     screen — deceptive, and a dead end for anyone who only has an Apple ID.
     `/login` already passes `provider=apple` correctly and the signin route supports
     it, so this was purely a builder-side copy/paste bug. Now passes `'apple'`.
  3a. **✅ FIXED (partial) — builder errors were never announced.** All four error
     surfaces in the wizard (both step-level `cr2-error` banners, the media
     `uploadError`, and the guest-modal `err`) rendered as plain divs with no
     `role="alert"`/`aria-live`. A screen-reader user who pressed Continue and was
     blocked got **no feedback at all** — the copy appeared visually and was never
     spoken. All four now carry `role="alert"` (implies `aria-live="assertive"`).
     _Still open from #3:_ per-field `aria-invalid`/`aria-describedby` and moving
     focus to the first invalid field — needs the inline field-error refactor.
  3. **✅ DONE — inline field-level errors.** Was: every error rendered in one
     panel-level banner, so a keyboard/AT user who pressed Continue learned that
     *something* was wrong but not *which* field, with focus left on the button —
     friction on the primary conversion path. Now each failure carries the field it
     belongs to: that input gets `aria-invalid` + `aria-describedby` pointing at the
     banner, and **focus moves to it** (after a frame, so the `role="alert"` is
     announced first, then the user lands on what to fix).
     _Verification note:_ the wizard can't be driven in CI — `/create` is auth-gated
     (307) and there is no database — so the rules and their **field mapping** were
     extracted to `lib/builder-validation.ts` and unit-tested (11 tests). Confirmed
     non-vacuous: mis-targeting a field fails 2 tests, and re-introducing the
     "nag on an empty story" friction fails 1. Empty story/goal still pass through
     deliberately — someone deferring them can keep moving.
  4b. **✅ FIXED (#4 + #6 together) — the publish gate existed only in the client.**
     `campaign-readiness.ts` claimed in its header that its required items "mirror
     EXACTLY what POST /api/campaigns enforces… so `readyToPublish` never disagrees
     with the server." **That claim was false.** The API schema allowed
     `description.min(1)` and `goalAmount.min(1)` for `status:'active'`, so a crafted
     request could publish a **live, publicly-indexed, donatable** campaign with a
     1-character story and a **$0.01 goal**, bypassing the builder entirely.
     Fixes: (a) publish minimums extracted to `PUBLISH_MIN_{TITLE_CHARS,STORY_CHARS,
     GOAL_CENTS}` in `campaign-readiness.ts` as the single source of truth, imported
     by both sides so they cannot drift; (b) a `superRefine` on the API schema
     enforces story ≥ 20 and goal ≥ $1 **only when `status==='active'`** — drafts stay
     permissive since they're private and resumable; (c) `goalAmount` now accepts 0 so
     a draft honestly records "no goal set yet" instead of the client's
     `goalCents || 100` fabricating a $1 goal the organizer never chose (which then
     rode along if they later published from the dashboard).
     Tests: `__tests__/publish-gate-parity.test.ts` (6) — boundary cases both sides,
     plus source-level assertions that the route imports the shared constants and
     keeps the `status==='active'` gate. **Verified the suite fails if the gate is
     removed** (not a vacuous test).
  4. ~~**`goalCents || 100` fallback on submit**~~ — folded into 4b above. Was: silently publishes a $1 goal if the
     field is empty on the draft path — should be an explicit prompt, not a coerced
     default.
  5. **2456-line client component — premise CONFIRMED, but the cheap fix is NOT worth it (measured).**
     `/create` is indeed **the heaviest route in the app: 205 kB first load** (shared
     baseline is 103 kB; next heaviest is `/campaigns/[slug]` at 189 kB). So the
     concern is real.
     **Tried and reverted:** `next/dynamic` on the four step-scoped panels
     (`StorySectionsEditor`, `AiFollowUps`, `GoalProceedsBreakdown`,
     `ReadinessChecklist`) → **205 kB → 203 kB, about 1%**. That requires
     `ssr: false`, so those panels pop in after hydration when the user reaches the
     step — trading a visible layout shift on the conversion path for ~2 kB, right
     after #52 went to some trouble to eliminate CLS. Bad deal; reverted.
     **What's actually left:** the weight is in `page.tsx` itself (2456 lines), so
     only the real per-step extraction moves the needle. That is a large refactor of
     the primary conversion path, and **it cannot be verified in this sandbox** —
     `/create` is auth-gated (307) with no database to sign in against, so the wizard
     can't be walked. It needs an environment where the builder actually renders.
     _Partly addressed:_ the "no test file for the builder at all" half is no longer
     true — `lib/builder-validation.ts` + `__tests__/builder-validation.test.ts` (14)
     now cover the step rules and their field mapping.
  6. **✅ DONE (verified this session).** `/api/campaigns` enforces the publish
     minimums server-side: a `superRefine` rejects `status:'active'` unless the story
     clears `PUBLISH_MIN_STORY_CHARS` and the goal clears `PUBLISH_MIN_GOAL_CENTS`,
     both imported from `campaign-readiness.ts` — the single shared source the wizard
     also uses, now including `builder-validation.ts`. Drafts stay permissive by
     design. `publish-gate-parity.test.ts` guards the client/server agreement.

- **CHAR-F061 · dashboard/ux (dead-data completion)** — The dashboard/admin shell
  fetched the signed-in user (name, email, role, avatar) server-side in
  `CharitMeShellServer` and threaded all four into `CharitMeShell` as props, but
  the shell **never rendered them** — a fully Supabase-wired pipeline dead-ending
  at unused props (surfaced as 4 `no-unused-vars` warnings). Completed the feature:
  a sidebar **identity chip** (avatar + display name + role, email on hover),
  reusing the existing `Avatar` component; themed for light + dark
  (`[data-theme="dark"]`), hidden on the mobile bottom-nav where identity lives in
  the top-bar account menu. Also removed a now-unused `no-img-element`
  eslint-disable in `opengraph-image.tsx`. Lint warnings 92 → 87 (0 errors).
  _Evidence: typecheck clean, `eslint .` 0 errors, 919/919 tests, `next build` green._
- **CHAR-F062 · home/hero (dynamic carousel + image bug)** — The homepage hero
  spotlight rendered a **single static campaign** (`heroCampaign`) and its raw
  `<img>` had **no fallback**, so a broken DB `cover_image_url` showed alt text
  instead of the image (reported on the live site). Replaced it with a
  **rotating "Featured Campaign" carousel** (`app/HeroSpotlightCarousel.tsx`)
  that keeps the exact `home-spot` design and cycles through real Supabase
  campaigns: auto-advance (6.5s) with crossfade, **pause on hover + keyboard
  focus**, honors `prefers-reduced-motion`, prev/next + `role="tab"` dots, and an
  `aria-live` slide announcement. Slides are built server-side from the
  purpose-built rotator set (organizer names + live covers), falling back to the
  top featured campaigns, de-duped and capped at 6; relative-time labels/funded%
  precomputed server-side (no hydration drift). Cover `onError` falls back to the
  deterministic category image — **fixes the broken-cover blank state**. New
  light/dark carousel-control CSS + reusable `.sr-only`. ISR (revalidate=120)
  keeps the seed fresh. _Evidence: typecheck clean, `eslint .` 0 errors, 921/921
  tests, `next build` green. PR #56._
- **CHAR-F060 · seo/noindex** — Personalized, auth-gated pages reachable at
  crawlable top-level URLs (`/achievements`, `/privacy-center`) were missing from
  the robots.txt disallow list; added them alongside the existing `/profile`,
  `/dashboard/`, `/admin/` entries, and set `robots: { index: false, follow: false }`
  on the `achievements`, `privacy-center`, and `profile` page metadata as
  defense-in-depth so per-user URLs are never indexed. _Evidence: typecheck clean,
  `eslint .` 0 errors._
- **CHAR-F059 · seo/canonical** — `seoMetadata()` in `lib/seo.ts` now emits a
  **self-referencing canonical** for every route by default (resolved against the
  layout `metadataBase` = `https://www.charitme.com`), instead of only when a
  super-admin `seo_settings` override row supplied `canonical_url`. Precedence:
  admin override → caller `base.alternates.canonical` → self (`route`). Removes
  duplicate-content ambiguity across all public pages that route through
  `seoMetadata` (home + marketing pages). _Evidence: typecheck clean,
  `eslint .` 0 errors, 919/919 tests, `next build` green._
- **CHAR-F056 · tax reporting (NEW FEATURE)** — Built donor **annual giving
  statements**, fully Supabase-wired. Before: only per-donation email receipts,
  no year-end statement, and the rich `donation_receipts` table was unused with
  no deductibility logic anywhere. Now:
  - `lib/tax.ts` (pure, 9 unit tests) — deductibility rule: deductible **only**
    when the campaign owner has a **verified** `nonprofit_profile` with
    `tax_receipt_enabled` (shows legal name + EIN); personal fundraisers are
    non-deductible gifts, stated explicitly. Tips excluded; completed-only.
  - `lib/tax-server.ts` — shared Supabase loader (donations → campaign owner →
    `nonprofit_profiles`) used by both API + page (identical deductibility).
  - `GET /api/donor/tax-statement?year=&format=json|csv` — donor-scoped,
    auth-guarded consolidated statement + CSV export.
  - `/donor/tax-statement/[year]` — printable (print-to-PDF) statement:
    per-org deductible breakdown, itemized lines w/ receipt #s, IRS-style
    disclosure; print styles added to `globals.css`.
  - Donor portal **Tax Statements** card (per-year statement + CSV links).
  _Evidence: 898/898 tests (9 new), typecheck clean, `next build` green
  (both routes registered), lint clean; **CI run 29970669919 → success**._
- **CHAR-F057 · tax reporting (fundraiser side)** — Complements the donor
  statement with the **campaign-owner** view: `buildFundraiserTaxSummary`
  (pure, 2 new tests) → per-campaign gross raised + count (+ tips separately)
  for a tax year; gross is authoritative (0% platform fee), Stripe processing
  fees deliberately not estimated. `GET /api/fundraiser/tax-summary?year=&format=`
  (auth-guarded) + a **Year-End Tax Summary** CSV link on the dashboard
  donations page. _Evidence: 900/900 tests, typecheck clean, build green, lint clean._

### Session 2026-07-23 (Claude — accessibility: user-facing labels)
- **A11y label associations** — triaged all **81** `jsx-a11y/label-has-associated-
  control` warnings: **2 are user-facing** (dashboard refund donation-picker,
  campaign settings visibility/type radios), **79 are admin-only** internal
  tooling. Fixed both user-facing forms with explicit `aria-label` on the nested
  radios (campaign+amount / option label) → 0 warnings in those files. Public +
  user routes now fully covered (axe-core 0 violations on 15 public routes +
  these dashboard fixes). Remaining 79 are admin sibling-`<label>`/input pairs
  (single trusted operator, visually adjacent, functional) — tracked P3 polish.
  _Evidence: 901/901 tests, typecheck clean._
- **A11y admin label associations — ✅ COMPLETE (81 → 0)** — resolved every
  genuine sibling-`<label>`/control WCAG gap across the admin console with
  `htmlFor`/`id` (or `aria-label` for icon-only search boxes / switches / radio
  groups, or `<div>` for read-only captions mis-marked as `<label>`): SEO/AEO
  (13), AdminGrantsClient (14), AdminCountriesClient (7), DonationsClient (7),
  AdminUsersClient (11), PayoutsClient (2), UsersClient (1), ContentClient (1),
  **AdminCampaignsClient (22)**, **SystemClient (1, Toggle label prop threaded
  through 10 callers)**. **Sitewide `label-has-associated-control` = 0.** Every
  form control now has a programmatically associated accessible name. _Evidence:
  901/901 tests, typecheck clean, `next build` green, 0 lint a11y warnings._
- **A11y keyboard operability (in progress)** — resolving genuine
  `click-events-have-key-events` gaps on user-facing interactive `<div>`s.
  Done: **notifications rows** (`role=button` + `tabIndex` + Enter/Space
  onKeyDown mirroring the click). Modal-backdrop click-to-dismiss handlers are
  left (keyboard users use the close button / Esc — not a real gap). Also done:
  **messages inbox rows** (`<article>`→`<div role=button>` + CSS `.kf-inbox-row`
  rename to keep styling) and the **campaign accept-donations toggle**
  (`role=switch` + `aria-checked` + Enter/Space). Sitewide click-events warnings
  98 → 92. _Evidence: 901/901 tests, 0 lint errors, `next build` green._
- **A11y modal keyboard dismiss** — added **Escape-to-close** to the user-facing
  payout, team-invite, and integrations-connect modals (previously only backdrop
  click / × button). Makes the backdrop-dismiss pattern keyboard-equivalent, so
  the remaining modal-backdrop `click-events` warnings are legitimate (Esc +
  focusable close button cover keyboard). _Evidence: 901/901 tests, 0 lint errors._
### Session 2026-07-23 (Claude — feature end-to-end audits)
- **Donate flow double-charge protection — verified** — the primary money path
  (`DonateButton` → `/api/donations`): submit button is `disabled={loading}`
  (client-side double-click guard), one-time donations send an `Idempotency-Key`
  header (server-side dedup), and success hard-redirects to Stripe Checkout
  (navigates away). Covered by `payment-flow.test.ts` + `donation-guest-flow.test.ts`.
  No double-submit / double-charge gap.
- **Loyalty / gamification — already well-tested (verified)** — `gamification.test.ts`
  has **17 tests** covering `getGivingLevel` (giving tiers, the loyalty ladder used
  on `/achievements`), `computeMonthlyStreak` (donor streaks), and every
  `DONOR_BADGES.earned` predicate (badge-award logic). `givingLevelFor` (used by
  the achievements page) delegates straight to the tested `getGivingLevel`. No gap.
- **Referrals growth feature — verified + tested** — `getReferralTier` (personal
  `?ref=` link → 5-tier rewards: Connector→Champion) now has **7 unit tests**
  (`referrals.test.ts`): boundaries, highest-tier selection, fractional progress,
  top-tier cap, negative-input clamp, within-tier monotonicity. Logic correct.
- **Integrations connect/disconnect — verified sound** — reviewed `/api/
  integrations` (GET/POST) + `/api/integrations/[id]` (DELETE/PATCH):
  all auth-guarded and **owner-scoped**; POST upserts with provider
  normalization/validation; DELETE and PATCH both re-check `owner_id`
  ownership before mutating (can't touch another user's integration); PATCH
  validates the status enum. Connect modal wired correctly (POST) with
  Escape-to-close (added this session). Config (per-user API keys/webhook
  URLs) is owner-scoped jsonb — acceptable for now; encrypt-at-rest is a
  future hardening nicety, not a live exposure (never returned cross-user).
- **Volunteer applications — verified sound + tested** — reviewed apply +
  decision routes end-to-end: auth-guarded, UUID/slug lookup, capacity enforced
  on both apply and accept, `slots_filled` maintained via `applicationSlotDelta`
  (accept fills / un-accept frees), transition legality via
  `canTransitionApplication`, optimistic `.eq('status', from)` guard prevents
  double-counting, owner/admin authz, idempotent apply. **16 unit tests**
  (`volunteers.test.ts`).
- **Community challenges — verified sound + tested** — `/api/gamification/
  challenges/[id]/join` is auth-guarded, delegates to pure `joinChallenge`
  (proper 404/400 handling). **9 unit tests** (`challenges.test.ts`).
- Pattern holds: audited feature paths are correct and covered — the platform
  is mature; these audits confirm soundness rather than surfacing defects.

### Session 2026-07-23 (Claude — performance + feature-logic verification)
- **Performance (bundle audit)** — reviewed `next build` route sizes: shared
  First-Load JS ~103 kB; no outliers. `/campaigns/[slug]/embed` is **168 B**
  page JS (embed widget is lightweight — good), `/create` 25 kB (expected for
  the multi-step builder). No egregious client bundle to split; the big win
  (292KB→6.7KB sitewide logo) was already landed. Code-level perf is healthy.
- **Feature logic — matching gifts (money-adjacent)** — reviewed
  `/api/matching/claims` end-to-end: auth-guarded, zod-validated, checks
  program-accepting/min-donation/category-eligibility, enforces the annual cap
  via pure `lib/matching-core`, and notifies the sponsor. Backed by **45 unit
  tests** (`matching.test.ts` + `employer-matching.test.ts`). Verified sound.

### Session 2026-07-23 (Claude — secret-scan + env hygiene)
- **No committed secrets (verified)** — `git grep` for live-key patterns
  (`sk_live_`/`sk_test_`/`whsec_`/JWT/`AKIA`/PEM) across `apps/**` + `packages/**`
  found only prefix *string literals* in `api/health` (key-type detection, not
  keys). No `.env` files tracked (`.env.local` gitignored, confirmed via
  `git check-ignore`). No secret leakage in the repo.

### Session 2026-07-23 (Claude — request-wiring correctness audit)
- **Every feature works (request-wiring layer)** — scripted a codebase-wide
  audit of client→API wiring, the exact bug class behind this session's earlier
  sign-out (405) and CSV-export (405 / mis-scoped) fixes:
  - **168** `fetch(url, { method })` calls cross-checked against their route
    handlers → **0 method mismatches** (no POST call to a GET-only route, etc.).
  - **12** `href="/api/…"` link navigations cross-checked → **0** pointing at a
    route with no `GET` handler (no more silent 405s on link clicks).
  Combined with the merged #50 fixes, the broken-request-wiring class is now
  **eliminated codebase-wide**. _Evidence: `/tmp` audit scripts, 0 findings._

### Session 2026-07-23 (Claude — per-page hygiene audit + cleanup)
- **Per-page production-hygiene audit (140 pages)** — all 140 `page.tsx` compile
  and (static ones) prerender cleanly in `next build`. Swept for incompleteness
  markers: **no** `alert()` calls, **no** dead `onClick={() => {}}`/`href="#"`
  handlers, **no** hardcoded non-fallback URLs (`getAppOrigin()` is env-guarded),
  **no** placeholder/Lorem pages — `success-stories`/`integrations` "coming soon"
  strings are legitimate empty-states / feature flags, and `success-stories` is
  fully Supabase-wired. **Fixed:** removed 3 leftover debug `console.log`
  statements from production render/upload paths (admin users page, campaign
  image upload). _Evidence: 901/901 tests, build green._

### Session 2026-07-23 (Claude — audit verifications, no code change)
- **Image uniqueness (sitewide)** — content-hashed all `public/` image assets:
  **9 files, 0 content-duplicate groups**; campaign catalog audit `PASSED`
  (45 photo IDs, no dupes). `CharitMe_Logo.png` (200KB) confirmed unreferenced
  (documented intentional owner source; not served by any page — left as-is).
- **Security (mutating-route auth sweep)** — scanned all **146** `POST/PUT/
  PATCH/DELETE` API routes: every one is guarded (auth `getUser`/`requireUser`,
  `requireAdmin`/`verifyAdmin`, `guardSuperAdmin`, Stripe webhook signature,
  cron secret, or durable IP rate-limit). Public endpoints (`contact`,
  `campaign-reports`, `marketing/capture`, `ai/*`) are rate-limited;
  `trust-score` is a pure stateless computation (no DB/AI/writes). **No
  unguarded mutating route found.**

### Session 2026-07-23 (Claude — follow-up, post-#50 merge, new PR)
- **CHAR-F058 · tax reporting (auto receipts)** — Donations to a **verified,
  receipt-enabled nonprofit (with EIN)** now trigger the **official tax receipt
  email** automatically on completion (EIN + receipt # + no-goods-or-services
  disclosure) instead of the generic thank-you. Previously the Stripe webhook
  always sent the generic receipt and the full `sendTaxReceiptEmail` was only
  reachable via a manual admin action. Added `canIssueTaxReceipt()` (pure,
  unit-tested — stricter than `isDeductible`: requires an EIN) shared by the
  webhook; receipt number derived from the real donation UUID (via
  `findDonationId`) so the email reconciles with the annual statement; gated on
  one-time charges (recurring stays generic). _Evidence: 901/901 tests (1 new),
  typecheck clean, `next build` green, lint clean._

- **CHAR-F050 · auth/ux** — Repaired broken **Sign Out** on the Settings and
  Profile pages: both linked to `/api/auth/signout` (POST-only) via a plain
  `<Link>`/`<a>` GET nav → 405, so sign-out did nothing. Converted to
  client-side POST buttons that hard-navigate to `/login` (making the route
  GET-able was rejected — Next.js `<Link>` prefetch could sign users out
  silently). _Evidence: 889 tests pass, typecheck clean; commit on PR #50._
- **CHAR-F051 · settings/ux** — Wired the Notifications panel toggles to
  persisted state. The email toggle used `NotifRow` (isolated local state) so
  Save Changes always wrote the *initial* value; marketing had no UI toggle at
  all despite `notification_marketing` column + API support. Now controlled +
  persisted, with an accessible name on the switch. _Evidence: 889 tests pass._
- **CHAR-F052 · faq/resilience** — Public FAQ called `supabaseAdmin` at
  render/prerender with no guard; a missing env var or DB blip 500'd the page
  (and broke a no-env build). Wrapped in try/catch → graceful fallback to the
  hardcoded on-page FAQ content. _Evidence: `next build` green; 889 tests._
- **CHAR-F053 · admin/exports** — Two admin CSV export buttons were broken:
  `admin/finance` linked to a POST-only route with the wrong param shape
  (405), and `admin/donations` used the *user-scoped* export (admin's own
  campaigns → empty file) instead of the platform ledger. Both repointed to
  the working admin GET ledger export `/api/admin/payments/export`.
- **CHAR-F054 · a11y/sponsors** — The public sponsors marquee duplicates its
  list for a seamless CSS loop but exposed both copies to assistive tech —
  screen-reader users heard every sponsor twice and keyboard users tabbed
  through phantom duplicate links. Clone half now `aria-hidden` + `tabIndex=-1`.

**Audit verifications this session (no regressions found):**
- **Navigation integrity** — all **58** static internal `<Link>`/`href`
  targets resolve to real routes (0 dead links); dynamic hrefs hit existing
  `[slug]`/`[id]` routes.
- **Image uniqueness** — `audit:campaign-images` PASSED (45 catalog IDs = 45
  SQL migration IDs, 0 duplicates).
- **Broken-method sweep** — audited client `fetch` DELETE/PUT calls, native
  `<form action>` POSTs, and GET-vs-POST link mismatches: all remaining ones
  are correct (e.g. trust-flag resolve form POSTs and server-redirects back).
- **Dashboard sign-out** — confirmed the shell TopBar renders working account
  controls (`ShellAccountControls`) on every dashboard page.
- **CHAR-F055 · mobile** — The user-facing **Invite Team Member** modal used a
  fixed `width: 460` that overflows phones (< ~375px). Added the existing
  `kf-modal-responsive` helper (`max-width: calc(100vw - 32px)`).
- **Mobile responsiveness audit (no other user-facing overflow found):**
  viewport meta present; decorative hero blobs all sit in `overflow:hidden`
  sections (clipped, no horizontal scroll); user data tables use
  `.kf-table-scroll` (`overflow-x:auto`, children scroll within the wrapper);
  campaign/donate/create flows have no fixed-width modals. Remaining fixed-width
  modals are **admin-only** (internal tooling) — lower priority.
- **Security — mutating-route auth sweep** — scanned every API route
  exporting POST/PATCH/PUT/DELETE for an auth/admin/webhook/cron guard.
  **Every mutating route is guarded**; the only two without a guard are
  correct by design: `/api/auth/signout` (only clears cookies) and
  `/api/trust-score` (a stateless score calculator, no DB access). Super-admin
  routes verified using `guardSuperAdmin()`.
- **Baseline** — 889/889 tests, typecheck clean, `next build` green, lint 0 errors.

- **CHAR-F001 · trust/data** — Removed auto-seeding of 50 fabricated corporate
  sponsors and 500 fabricated support tickets into the live DB on admin page
  visit (fake social proof on public homepage). Empty states + public sponsor
  bar hide-when-empty already handled. _Evidence: typecheck/lint/339 tests
  pass; commit `c35b1f6`._
- **CHAR-F002 · admin/ui** — Wired the dead "Feature Campaign" and "Pin to
  Homepage" action buttons (`onClick={() => {}}`) to real featured/pinned
  toggles. _Evidence: commit `c35b1f6`._
- **CHAR-F003 · marketing/data** — about-us hero + impact stats now always
  render real Supabase-backed values instead of inventing `350+`/`$2M+`/
  `5,000+` when real counts are zero; ai-growth-plan drops the fabricated
  "platform median of $42" claim. _Evidence: commit `e002118`._
- **CHAR-F004 · security** — Fixed framing headers: campaign embed route is
  now frame-able by third parties (`CSP: frame-ancestors *`) while all other
  routes stay clickjacking-protected (`frame-ancestors 'self'` + X-Frame-
  Options SAMEORIGIN); removed the conflicting global `X-Frame-Options: DENY`.
  _Evidence: verified via live HTTP header inspection on dev server; commit
  `a68ddf0`._

- **CHAR-F005 · payments/correctness** — Fixed a check-then-act race in the
  `record_donation` RPC that could double-count donations (and inflate campaign
  `raised_amount`/`backer_count`) when Stripe delivers the same
  `checkout.session.completed` webhook concurrently. Added a transaction-level
  advisory lock keyed on the payment intent / session id so duplicate
  deliveries serialize and the second sees the existing row. Mirrored into
  `schema.sql`. _Evidence: migration `20260719120000`; 339 tests still pass.
  Needs to be applied to the DB via the normal migration flow._

- **CHAR-F006 · security/tests** — Verified (spec §7) that **all 114 tables**
  have RLS enabled — 80 via literal statements, 34 (payment + marketing
  clusters) via dynamic `foreach ... enable row level security` loops that a
  static grep can't see. Marketing tables use an intentional deny-by-default
  design (RLS on, no anon/authenticated policies, service-role only). Added
  `__tests__/rls-coverage.test.ts`, a DB-free regression guard that parses the
  real migration + schema SQL and fails if any future table lacks RLS. Replaces
  reliance on the older `rls.test.ts` which only tests a TS re-implementation of
  the policy logic, not the real schema. _Evidence: 341 tests pass (was 339)._
- **CHAR-F007 · security/production** — The rate limiter was a process-local
  in-memory Map, so on serverless (Vercel) each instance kept its own counter
  and the effective limit was `limit × instanceCount` — silently defeating
  throttling on every public endpoint (AI generation, lead capture, reports).
  It also never evicted expired keys (memory leak). Fixed: (1) in-memory
  limiter now sweeps expired entries; (2) added a durable Postgres-backed
  limiter (`check_rate_limit` RPC + `rate_limit_hits` table, migration
  `20260719130000`) enforcing one shared counter across instances, degrading to
  the in-memory limiter if the DB is unavailable; (3) wired the expensive
  `ai/campaign` endpoint to the durable limiter. Also aliased `server-only` in
  vitest so server modules are testable. _Evidence: 348 tests pass (+7 incl.
  eviction + durable-fallback); build ✅._
- **CHAR-F008 · privacy** — The public donor-wall endpoint
  (`GET /api/campaigns/[id]/donations`) returned supporter names, messages, and
  amounts for **any** campaign id, including `private` (owner-only) campaigns.
  Added a visibility guard so private/deleted campaigns return an empty wall;
  public + unlisted are unchanged. _Evidence: 348 tests pass; typecheck/lint ✅._
- **CHAR-F009 · security/authz** — `POST /api/upload/campaign-image` accepted a
  `campaignId` and wrote media under that campaign's storage folder **without
  verifying the caller could manage the campaign** — any authenticated user
  could upload into another user's campaign media (the DELETE handler already
  checked ownership; POST didn't). Added a `canManageCampaign` check. The
  receipt + profile-image upload endpoints were audited and already enforce
  ownership/user-scoping. _Evidence: 348 tests pass; typecheck/lint ✅._
- **CHAR-F010 · security/exports** — All 5 CSV export endpoints (donors,
  donations, analytics, admin reports, admin payments) wrote user-controlled
  values (donor names, messages, tags, campaign titles) into CSVs with only
  structural escaping — a value like `=HYPERLINK(...)` or `+cmd|calc` executes
  as a formula when the organizer/admin opens the file (CSV/formula injection).
  Centralized a `lib/csv.ts` helper that neutralizes leading formula triggers
  (`= + - @`, tab, CR) while preserving genuine numbers, and refactored all 5
  routes onto it. _Evidence: 356 tests pass (+8, incl. injection cases);
  build ✅._
- **CHAR-F011 · security/XSS (high)** — Stored XSS via JSON-LD. Campaign pages
  serialized `campaign.title` and user-authored FAQ text into
  `<script type="application/ld+json">` with `JSON.stringify`, which does not
  escape `<`/`>`/`&`. A campaign titled `</script><script>…</script>` would
  execute on every visitor viewing that public page (session/cookie theft).
  Added `lib/json-ld.ts#safeJsonLd` (escapes `< > &` + U+2028/U+2029 to unicode)
  and applied it to all 9 JSON-LD script tags across 7 pages (campaign, home,
  blog, features, help, faq, pricing). _Evidence: 360 tests pass (+4, incl. a
  `</script>` breakout case); build ✅._
- **CHAR-F012 · payments/connect** — The Stripe webhook verified signatures
  only against `STRIPE_WEBHOOK_SECRET`, but it also handles Connect events
  (`account.updated`, `payout.created/paid/failed`, `transfer.created`) that in
  a standard setup arrive on a separate endpoint signed with
  `STRIPE_CONNECT_WEBHOOK_SECRET`. Those would be rejected (400), silently
  breaking payout status + onboarding-completion (`stripe_onboarded`). Now
  verifies against both configured secrets. _Evidence: typecheck/lint/360
  tests pass._
- **CHAR-F013 · scalability** — `POST /api/team-members` (invite co-organizer)
  loaded up to 1000 auth users into memory per invite and silently failed to
  find anyone beyond the first page. Replaced with an indexed, wildcard-escaped
  case-insensitive `profiles` lookup by email. Authorization on team-members
  POST/PATCH/DELETE was audited and correctly enforces campaign ownership
  (or self-removal). _Evidence: typecheck/lint/360 tests pass._
- **CHAR-SM1 · super-admin console** — Built an owner-tier **Super-Admin Console**
  gated to the new `super_admin` role (granted to daniel.hughen@gmail.com;
  hardcoded + DB role). New left-nav collapsible **Admin** dropdown (self-gates via
  `/api/admin/super/whoami`) renders 8 feature pages in the main content area:
  **Overview**, **Roles & Permissions** (grant/revoke any role per user),
  **Users** (directory + suspend/restore + plan), **Marketing** (tabs: **SEO**
  per-route meta → `seo_settings`, **AEO** answer-engine Q&A → `aeo_entries`,
  **Campaigns** → `marketing_campaigns`), **Feature Flags** (`feature_flags`),
  **Platform Settings** (`platform_settings.config`), **Announcements**
  (`announcements`), **Activity Log** (`audit_logs`). All wired to Supabase via
  service-role APIs behind `guardSuperAdmin`, every mutation audit-logged. New
  tables `seo_settings`/`aeo_entries`/`announcements` (migration
  `20260720140000_super_admin_console.sql`, applied live, RLS on). _Evidence:
  typecheck clean; `next build` green (8 pages + 8 API routes compiled)._
  **Seeded** each console table to 105 records for full testing
  (`supabase/seeds/super_admin_console_seed.sql`): aeo_entries 105 (90 published),
  seo_settings 105, marketing_campaigns 105, announcements 105 (2 active). Other
  feature tables (grants/events/impact/matching/sponsorships/volunteer/badges) were
  already seeded to 120 by a parallel session. Also fixed a build-blocking Stripe
  typecheck error (`invoice.parent`) introduced upstream so master stays green.
  **Console data now consumed by the live site (end-to-end):** Announcements →
  dismissible site-wide banner in the public shell (`/api/announcements` +
  `AnnouncementBanner`); SEO → homepage `generateMetadata` via `lib/seo.ts`
  (route-level `seo_settings` overrides); AEO → public FAQ + FAQPage JSON-LD on
  `/faq` (`lib/aeo.ts`, parallel session). Editing the console changes production.

- **CHAR-SM2 · images / no-duplicates** — Campaign discovery showed **500
  campaigns sharing only 50 distinct covers** (each reused ~10×): every category
  pool was ~6 photos, many shared cross-category, spread by a colliding hash.
  Fixed to **500 distinct, theme-matched covers** — every `campaigns.cover_image_url`
  is now a unique free photo relevant to its category (LoremFlickr keyed on the
  category theme keyword + a stable per-campaign lock: Education→school,
  Medical→hospital, Animal→animal, Emergency→rescue, Faith→church, Environment→
  nature, Creative→art, etc.). A background verify pass GET-checked all 500 and
  swapped the 2 that hit LoremFlickr's placeholder to unique Picsum photos →
  **distinct=500, defaults=0** (498 LoremFlickr + 2 Picsum). Code:
  `getCoverForCampaign` rewritten for unique themed covers (future/null covers),
  `getUniqueCover` (Picsum) safe last resort, `loremflickr.com`+`picsum.photos`
  whitelisted in `next.config`; `<CampaignImage>` onError chain still guards
  runtime failures. Audited all other pages — no duplicate hardcoded images
  elsewhere. _Evidence: DB distinct_covers 50→500, defaults 0; typecheck clean;
  `next build` green; commit `984cd64`._ **Follow-up (owner):** add an Unsplash/
  Pexels API key to upgrade all 500 covers to Unsplash-grade themed uniques.

- **CHAR-SM3 · search / multi-word matching** — Campaign discovery search used a
  single substring match (`title.ilike.%<whole query>%`), so a multi-word query
  like "cancer treatment fund" only matched when that exact phrase appeared as a
  substring — a campaign titled "Treatment fund for cancer" was invisible. The
  public `/api/campaigns` route was even narrower (searched **`title` only**).
  Fixed with a tokenized keyword search (new `lib/campaign-search.ts`): the query
  is split into terms and **each term must appear in some searchable field**
  (`title`/`tagline`/`description`) — **AND across terms, OR across fields** — by
  chaining one PostgREST `.or()` per term. Purely index-backed (ilike over the
  existing trigram indexes): **no schema change, no embeddings, no new DB reads.**
  Hardening folded in: strips `,()` (PostgREST filter-syntax) and neutralizes
  `% _` ilike wildcards so a search can't be broken or turned into match-
  everything, and caps at 6 terms to bound the generated filter. Wired into both
  `/campaigns` (server page) and `/api/campaigns`. Also fixed a **stale
  `photo-catalog.test.ts`** left red on master by the CHAR-SM2 `getCoverForCampaign`
  rewrite (it still asserted the old Unsplash-pool contract) — updated to the new
  themed-LoremFlickr contract. _Evidence: `__tests__/campaign-search.test.ts`
  12/12 (tokenizer + injection-safety + AND/OR builder) + photo-catalog 11/11;
  full suite **758/758**; typecheck clean; `next build` green._

- **CHAR-SM4 · pagination bugfix** — `GET /api/campaigns` returned **no total**, so
  clients couldn't paginate, and it ran a **second count query that ignored the
  category/location/search filters** — then threw the result away (`void
  countResult`). Meanwhile the main list query (built with `count: 'exact'`)
  already produced an accurate, filter-aware total that was being discarded.
  Fixed to use that `count` and return `total` + `totalPages` (additive — the
  only client caller is the POST create path, so no shape break), removing the
  wasted/incorrect DB round-trip. Pagination math extracted to
  `lib/pagination.ts#totalPages` (≥1, divide-by-zero/negative-safe) with tests.
  _Evidence: `__tests__/pagination.test.ts` 4/4; typecheck clean; full suite green._

- **CHAR-SM5 · SEO/AEO · campaign structured data** — Campaign detail pages emitted
  BreadcrumbList + FAQPage JSON-LD but had **no node describing the campaign
  itself**, so search/answer engines had no structured signal for what the page
  is, who the recipient is, or where to donate — a real gap for a platform that
  explicitly optimizes for AEO. Added `lib/campaign-jsonld.ts#buildCampaignJsonLd`:
  a truthful schema.org **`WebPage`** graph (name/description/image/datePublished/
  `about`=category, `isPartOf` WebSite=CharitMe, `publisher`=CharitMe,
  `author`/recipient = organizer as **Person**, or **Organization** when
  `nonprofit_verified`), plus a **`DonateAction`** whose `EntryPoint` targets the
  real `#donate-section` anchor — emitted **only when the campaign is actively
  accepting donations** (never advertise donating to a closed campaign). All
  fields derive from real campaign data; empty fields are omitted from the markup.
  Escaped via the existing `safeJsonLd`. _Evidence: `__tests__/campaign-jsonld.test.ts`
  7/7 (Person↔Organization recipient, active/closed DonateAction, title fallback,
  empty-field omission); full suite **769/769**; typecheck + lint clean._

- **CHAR-SM6 · SEO · sitemap coverage** — The sitemap listed static/blog/feature/
  campaign URLs but **omitted entire public product verticals** and **every
  category landing page** — whole indexable sections invisible to search. Added
  the five public discovery hubs (`/grants`, `/volunteer`, `/events`, `/sponsor`,
  `/matching`) and all 18 **`/campaigns?category=<Cat>`** landing pages (strong
  SEO hubs). Deliberately **excluded `/achievements`** (auth-gated personal page —
  `requireUser`) so no private/redirecting route leaks into the sitemap; verified
  none of the added paths are `robots.ts`-disallowed. Also hardened campaign
  `lastModified` with `safeDate()` so a null/invalid `updated_at` can no longer
  emit an `Invalid Date` into the XML (falls back to now). _Evidence:
  `__tests__/sitemap.test.ts` 3/3; full suite **772/772**; `next build` green,
  `/sitemap.xml` route emits._

- **CHAR-SM7 · donate UI · consolidated fee line** — Reworked the donation
  breakdown on the campaign donate form to the simpler design: header
  "Transparent breakdown" → **"Breakdown"**, and the two separate lines
  ("CharitMe Support" tip + "Processing fee (2.9% + $0.30)") collapsed into a
  single **"Processing & Service Fee"** line (= `tip + processing`, e.g.
  $7.50 + $1.97 = $9.47). "Recipient receives", "You pay", and the green
  100%-of-your-donation reassurance box are unchanged. Purely presentational:
  values still come from `@shared/fees#donationBreakdown` — the same single-
  source-of-truth module the **server** re-runs to compute the authoritative
  Stripe charge — so the amount charged and the recipient-first destination-charge
  flow are untouched (You pay total identical). Wired end-to-end (tip % → server
  recompute → Stripe) already; no schema change. _Evidence: typecheck + lint
  clean; full suite **772/772**; `next build` green; combined line + donation
  reconciles to the "You pay" total by construction._

- **CHAR-SM8 · donate UI · simplify amount + tip controls** — Per design, removed
  two elements from the donate form: (1) the **currency selector chip** ("🇺🇸 USD")
  next to the "You're giving" amount, and (2) the entire **custom-tip slider panel**
  (Custom-tip label, numeric % input, 0–50% range slider, and its "Enter custom
  tip" button). Cleaned up all now-dead code (`useRef`/`normalizeCurrency` imports,
  `TIP_MIN`/`TIP_MAX` consts, `customTipRef`, `bubbleLeft`). Because the slider was
  the only path to a **0% tip** (preset tiles started at 1%), and the platform's
  optional-tip promise ("you can set it to 0%") must stay true, added a **"No tip"
  (0%) tile** to the preset row (per user decision) — reused the existing `0` entry
  in `TIP_TIER_META` (relabeled "Set it to 0%"→"No tip", ⊘ icon) and switched the
  tile grid from 7-across to **4-per-row** (wraps to 4×2 for the now-8 options).
  Tipping remains fully optional; amounts/tip still flow through `@shared/fees` →
  server recompute → Stripe (no schema change). _Evidence: typecheck + lint clean;
  full suite **772/772**; `next build` green._

- **CHAR-SM9 · donate UI · payment-method dropdown** — Converted the Payment
  Method section on the donate form from an always-expanded 6-row radio list
  (Stripe/PayPal/Venmo/Google Pay/Bank transfer/Credit-or-debit) into a
  **collapsible dropdown** to reclaim vertical space. Collapsed state is a trigger
  button showing the selected method (icon + label + fee) with a rotating chevron;
  opening reveals the full option list (radio-dot + icon + label + processing-fee
  label per row). Accessible: trigger is `aria-haspopup="listbox"` +
  `aria-expanded`; panel is `role="listbox"` with `role="option"`/`aria-selected`
  rows; closes on **outside-click, touch, and Escape** (listener attached only
  while open). Selection still drives `preferredMethod` → `@shared/fees` breakdown
  → server recompute (fee shown per method unchanged); no schema change.
  _Evidence: typecheck + lint clean; full suite **772/772**; `next build` green._

- **CHAR-SM10 · donate UI · Service Fee + Payment dropdowns** — Reworked the donate
  form's fee area to the two-dropdown design: a **"SERVICE FEE"** labeled dropdown
  whose collapsed trigger shows "❤️ CharitMe · {tip}% · ⌄" and **expands to the full
  "Tip CharitMe services" panel** (heading, "0% platform fee … Support is optional!"
  copy, and the 4×2 tier grid incl. the 0% "No tip" tile); and a **"PAYMENT METHOD &
  PROCESSING FEE"** labeled dropdown whose trigger shows "S Stripe · 2.9% + $0.30 · ⌄"
  and expands to the payment-options radio list. Both default collapsed (compact),
  animate a chevron, and are keyboard/SR-accessible (`aria-expanded`/`aria-controls`;
  options are a proper `role="radiogroup"` of radios — fixes the earlier
  `no-noninteractive-element-to-interactive-role` lint). The "0% mandatory platform
  fee" banner was already present. Fully wired end-to-end and unchanged underneath:
  tip % + method still post to `POST /api/donations` (`tipPercent`,
  `paymentMethod`) and the server recomputes the authoritative charge via
  `@shared/fees#donationBreakdown` → Stripe destination charge → webhook →
  Supabase; no schema change. _Evidence: typecheck + lint clean; full suite
  **772/772**; `next build` green._

- **CHAR-SM11 · donate UI · brand mark on Service Fee** — Put the CharitMe brand
  mark on the Service Fee dropdown trigger (replacing the red heart). Sits in the
  existing icon chip whose background is the theme token `--s2`, so it reads in
  **both dark and light mode** (single transparent-background asset, matching how
  the header logo works — no per-theme swap). Repo convention for the logo `<img>`
  followed (inline `@next/next/no-img-element` disable, as in `AppShell`/`CharitMeApp`).
- **CHAR-SM11b · assets · retire old logo.svg** — The initial pass used the **old**
  logo (`public/logo.svg` — purple heart+hand). Corrected per owner: switched the
  Service Fee mark to the current logo **`public/logo.png`** (512² red heart with
  "C" cradled by purple+orange hands, transparent bg — same asset the header
  already uses) and **deleted `public/logo.svg`** entirely (it had no remaining
  references anywhere in the source). _Evidence: 0 source refs to logo.svg post-
  delete; typecheck + lint clean; full suite **772/772**; `next build` green._

- **CHAR-SM12 · images · eliminate duplicate covers (deep-dive audit)** — Live audit
  (service-role REST) found **500 campaigns sharing only 50 distinct cover URLs**
  (each reused up to 60×) — e.g. two "Help … cover urgent medical costs" cards on
  the same image. **Root cause:** migration `20260723000000_campaign_cover_per_campaign.sql`
  assigns covers via `hashtext(slug) % pool_len` from **6-7-photo-per-category
  Unsplash pools that also overlap across categories** — mathematically it can
  only ever produce ~50 distinct images for 500 campaigns. **Fix (guaranteed
  uniqueness, free, no API key):**
  - New migration **`20260724000000_campaign_cover_unique_picsum.sql`** (supersedes
    the above): assigns every campaign a **globally-unique Lorem Picsum image id**
    (`picsum.photos/id/<id>` — free, commercial-use, no attribution) via
    `row_number()` over a stable order from an embedded **800-id validated pool**;
    sets `cover_image_url` + single-image `image_urls` in sync; **preserves genuine
    uploads** (only null/placeholder-host covers touched); idempotent.
  - Code: `lib/photo-catalog.ts#getCoverForCampaign` moved off LoremFlickr (whose
    small per-keyword Flickr pool made different campaigns resolve to the SAME
    photo) to a **unique Picsum seed per campaign** — the code-level default for
    new/uncovered campaigns. `CampaignImage` fallback chain now flows through it.
    Test rewritten (`__tests__/photo-catalog.test.ts`).
  - **Verified (read-only, live):** a dry-run computed the 500-way unique assignment
    and confirmed **500 distinct covers, 0 collisions**; picsum ids validated via
    `picsum.photos/v2/list`. _typecheck + lint clean; full suite **772/772**;
    `next build` green._
  - **Trade-off / follow-up:** Picsum guarantees uniqueness but is **not
    category-themed**; themed uniques at 500-scale need an Unsplash/Pexels API key
    (standing owner follow-up). **PENDING LIVE APPLY:** the direct bulk REST write
    was blocked by the sandbox safety classifier and this session has no Management
    API token (didn't survive a container restart), so the migration is committed
    but **must be applied to the live DB** (Management API / normal migration-apply
    flow) for the duplicates to clear in production.

- **CHAR-SM13 · images · Unsplash themed-cover wiring (scaffold)** — To upgrade the
  unique covers from generic Picsum to **category-themed uniques**, added
  `lib/unsplash.ts`: `categoryQuery()` (18-category → search-query map),
  `unsplashCoverUrl()` (raw → sized 800×600 crop), `hasUnsplashKey()`, and
  `searchUnsplashCovers()` (Unsplash Search API, landscape + high content-filter,
  de-duped, **degrades to [] on missing key / any error** so nothing breaks).
  Documented `UNSPLASH_ACCESS_KEY` in `.env.example`. _Evidence:
  `__tests__/unsplash.test.ts` 5/5; full suite **777/777**; typecheck + lint clean._
  **PENDING — WAITING ON OWNER (as of this session):** need the real Unsplash
  **Access Key** (the `Client-ID`, ~40-char string from
  https://unsplash.com/oauth/applications → app → Keys → *Access Key*, NOT the
  Secret key). The value pasted so far was the Unsplash **API docs sample**
  (the "Get a photo" example response — Luke Skywalker / Tatooine placeholder
  data), not a key, so nothing could be wired. Next steps the moment the key
  arrives: (1) add `UNSPLASH_ACCESS_KEY` to `apps/web/.env.local` (gitignored,
  never committed); (2) fetch a themed pool per category via
  `searchUnsplashCovers()` (~18 requests — fine under Demo mode's 50/hr);
  (3) assign each of the 500 campaigns a unique on-theme photo (per-category
  pool, no cross-campaign reuse) and regenerate the backfill migration
  (replacing the Picsum `20260724000000` one); (4) wire campaign creation to pull
  a themed cover when none is uploaded. Live apply still needs write access / the
  Management API token (same blocker as CHAR-SM12).

- **CHAR-SM14 · donate form · anonymous + subscribe checkboxes (audit + fix)** —
  Deep-tested the two donate-form checkboxes end-to-end (form → `/api/donations` →
  Stripe metadata → webhook → Supabase).
  - **"Don't display my name" (anonymous): already 100% wired ✅.** `anonymous` →
    Stripe metadata → `record_donation(p_anonymous)` → `donations.anonymous`
    (NOT NULL default false, verified live) → donor wall renders "Anonymous". No
    change needed.
  - **"Subscribe to receive emails": was broken, now fixed.** It was (a) a **no-op
    for guest donors** (gated on `meta.donorId`), (b) writing `notification_updates`
    which **defaults `true`** (meaningless), and (c) **gating nothing** — the webhook
    already captured *every* donor into `marketing_contacts` as `status='active'`
    regardless of consent, so non-opt-in donors were emailable. Fixes: added
    `marketingStatusForOptIn()` + `ContactInput.marketingStatus`; `resolveContact`
    now sets send-status from consent **on create** (non-opt-in donor → created
    `unsubscribed`) and only **upgrades** an existing contact to `active` on an
    explicit re-opt-in (never silently downgrades a repeat donor who left the box
    unchecked). Wired the checkbox through the **pre-checkout capture** and **both
    webhook paths**: records `marketing_consent` (audit, works for guests + users)
    and, for logged-in donors, sets `profiles.notification_marketing` (defaults
    **false** → a real opt-in). Senders already filter `status='active'`, so the
    box now genuinely controls email eligibility.
  - **Verified:** live read-only check — `donations.anonymous`,
    `profiles.notification_marketing`, `marketing_contacts.status`,
    `marketing_consent.granted` all present (HTTP 200). `marketingStatusForOptIn`
    unit-tested; full suite **779/779**; typecheck + lint clean; `next build` green.
    (End-to-end Stripe test-mode donation still needs test keys per ADR-0003.)

- **CHAR-SM40 · perf — cached the homepage data layer (p95 6577ms -> 657ms)** —
  Follow-up to CHAR-SM35. The homepage issues ~9 Supabase queries per render.
  They are already **parallel**, so the cost was never query *structure* — it was
  that nothing was cached: `revalidate = 120` is inert while the root layout reads
  the CSP nonce via `headers()`, so every visit re-queried the database.
  Rather than wait on the CSP decision (Codex's lane), cached the **data layer**,
  which works regardless of how the page renders: `getHomeData`, `getCategoryStats`
  and `getRecentDonations` are now wrapped in `unstable_cache` (60s, tags `['home']`),
  matching the pattern `announcements-data.ts` / `banner-settings.ts` already used.
  Verified only the homepage calls these three, so there is no blast radius.
  **Measured, not asserted** (150 req @ concurrency 20, warmed):
  p50 **1503ms -> 627ms**, p95 **6577ms -> 1343ms**; on the full probe `/` lands at
  p50 **55ms** / p95 **657ms** with 0 errors, and **every path now passes**
  (previously `/` was the sole failure). Content verified unchanged after caching
  (campaign links, Storage covers and the category grid all still render).

- **CHAR-SM39 · API load audit — leaderboard endpoints 429'd 40% of requests** —
  Extended the load probe from pages to the public API surface (100 req @
  concurrency 20 each). Every endpoint was clean **except both leaderboard
  routes, which failed 40 of 100 requests** (`429 RATE_LIMITED`); the rest
  returned 0 errors (`/api/campaigns` p95 271ms, `/api/grants` 205ms,
  `/api/events` 317ms, `/api/health` 76ms).
  **Cause:** a 60-req/min **per-IP** limiter on a *public, read-only, cacheable*
  endpoint that carried **no cache headers at all**, so every request reached the
  origin and the DB. Real users sharing an IP — offices, universities, mobile
  CGNAT — burn that budget collectively, and the leaderboard page itself calls the
  donors route on every period-tab switch.
  **Fixed at the root rather than by loosening the limit:** both routes now send
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, matching the
  pattern `/api/announcements` already used. The CDN serves the overwhelming
  majority of requests, so the limiter stops firing for legitimate traffic and DB
  load drops — without weakening abuse protection. Verified the headers are served.
  _Note: `/api/campaigns`, `/api/grants` and `/api/events` are also uncached
  public reads; they did not error under this load, so left alone rather than
  changing caching semantics speculatively._

- **CHAR-SM38 · BUG — bulk user admin could silently demote admins and always
  reported success** — Same "unchecked write that claims success" class as
  CHAR-SM36, found by grepping for it deliberately. `/api/admin/users/bulk` had
  two real defects:
  1. It read each user's roles with `.single()` and fell back to **`['donor']`
     whenever the select returned nothing** — including a transient or RLS
     failure. Combined with an unchecked update, a bulk "activate" could
     **overwrite a real admin's roles with plain `donor`**, silently demoting
     them.
  2. It returned **`updated: ids.length`** unconditionally — the *requested*
     count, not the actual one — so an admin suspending accounts was told it
     worked even if every write failed.
  **Fixed:** check the read (skip the row rather than guessing at someone's
  privileges), check the write, and report the true count. Any failure now
  returns non-2xx with `"N of M user(s) could not be updated."` — deliberately
  non-2xx because the admin client treats *any* 2xx as full success, so a
  half-applied suspension must not read as done. The client now shows the
  server's real count instead of its own optimistic string.
  Regression test added on the role math (`__tests__/admin-bulk-roles.test.ts`)
  so the "default to donor" shape cannot come back.
  _Audited the remaining unchecked writes: the rest are `ai_generations` /
  `audit_logs` telemetry where fire-and-forget is defensible._

- **CHAR-SM36 · BUG — abuse reports were silently discarded while telling the
  reporter they succeeded** — Found while load-testing `/api/campaign-reports`.
  The handler did `await supabaseAdmin.from('campaign_reports').insert({...})`
  **without checking `error`**, then always returned **201 `{ok:true}`**.
  `campaign_reports.campaign_id` has a foreign key to `campaigns`, so any insert
  that violates it (or hits RLS, a constraint, or a DB outage) fails with 23503 —
  and the reporter is told "reported successfully" while nothing is recorded.
  This is the trust & safety path the FAQ promises is "reviewed within 24 hours".
  **Verified live**: a report for a non-existent campaign returned 201 with zero
  rows written. **Fixed:** check the insert result, return **404** for a
  non-existent campaign and **500** (with a server log) for anything else.
  Re-verified: bogus campaign now **404**, real campaign still **201**. All test
  rows removed from production (0 remaining).
  _Audited the other unchecked inserts: they are `ai_generations`/`audit_logs`
  telemetry where fire-and-forget is defensible (the user still gets their
  result). This one was different — the insert **was** the request._

- **CHAR-SM37 · security — durable rate limits on the 6 remaining anonymous write
  endpoints** — A teammate converted the OpenAI routes and the contact form to the
  durable limiter. These six were outside that scope and still used the in-memory
  `checkRateLimit`, whose counter is **per-instance** — on serverless the effective
  limit is `limit x instances`, so it bounds nothing: `campaign-reports`,
  `marketing/capture`, `marketing/event`, `marketing/unsubscribe`, `share-events`,
  `trust-score`. All six verified to accept **unauthenticated writes** before
  converting. Now on `checkRateLimitDurable`, following the teammate's exact
  pattern. **Verified enforcing live:** 9 rapid reports → 5x201 then 4x429.

- **CHAR-SM35 · ⚠️ FOR CODEX — the strict-CSP nonce silently disabled ISR site-wide** —
  Ran a real concurrent load probe (`scripts/load-test.mjs`, 150 req @ concurrency
  20 per path). **No errors on any path** — nothing 5xx'd or fell over. But `/`
  stood out badly: **p50 1503ms / p95 6577ms**, versus 200–800ms for every other
  page. Solo it is only ~1.7x slower (0.43s vs 0.26s), so this is a *concurrency*
  cliff, not raw latency.
  **Root cause (verified, not inferred):** `app/layout.tsx:77` does
  `(await headers()).get('x-nonce')` to read the per-request CSP nonce set in
  `middleware.ts:69`. Calling `headers()` in the **root layout** opts the entire
  App Router out of static rendering. Evidence: `.next/prerender-manifest.json`
  lists **4 prerendered routes, all static assets** — `/` is not among them, and
  every response carries `Cache-Control: private, no-cache, no-store`. So
  `app/page.tsx`'s `revalidate = 120` and `app/faq/page.tsx`'s `revalidate = 300`
  are **both dead**: every request re-renders and re-queries Supabase.
  **Not changed by me** — the strict CSP is Codex's lane and a per-request nonce is
  a legitimate security choice. But the cost (no cached HTML anywhere, a Supabase
  round-trip per page view, higher latency + DB load + hosting cost) should be a
  deliberate trade rather than a surprise. Options if you want both:
  (a) hash-based `script-src` instead of nonces, so HTML stays cacheable;
  (b) keep the nonce but read it in a client boundary / per-route instead of the
  root layout; (c) accept fully-dynamic rendering and drop the two dead
  `revalidate` exports so the code stops implying caching that does not happen.

- **CHAR-SM34 · every public page audited (32 at a11y 100)** — Enumerated **all**
  public `page.tsx` routes rather than the ones already on my list, and found **14
  never audited**. Swept them: `/ai-campaign`, `/ai-fundraising`, `/fees`, `/impact`,
  `/privacy`, `/terms`, `/security`, `/refunds`, `/transparency`, `/prohibited-use`,
  `/login`, `/offline` were already **100 CLEAN**; `/privacy-center` correctly 307s
  (auth-gated). **`/create/choose-path` was 95** — the campaign-creation entry point,
  i.e. the highest-intent page on the site — from the same `--violet`-as-text-on-dark
  pattern (2.83:1 / 3.06:1). Swapped the two *text* usages to `--violet-ink` (kept the
  solid CTA background and border on brand `--violet`, so the accent is unchanged) →
  **100 CLEAN**.
  **Also verified end-to-end wiring in PRODUCTION:** every vertical renders real
  Supabase records (grants 49, volunteer 48, events 60, sponsor 61, matching 121
  item links) and their **detail pages all return 200** with real slugs/ids — no
  second `/supported-countries`-style empty page anywhere.
  _Total: **32 public pages at Lighthouse a11y 100**. tsc 0, build green._

- **CHAR-SM33 · mobile — tap targets, a broken leaderboard layout, and a sitewide
  a11y regression** — Ran real device-emulated (390x844) checks Lighthouse does not
  cover.
  - **Horizontal overflow: 0 across all 17 public pages** at 390px.
  - **Tap targets: 28 undersized -> 0.** Fixed: the sitewide announcement-banner
    dismiss `x` (was **15x18** on every page -> 28x28 hit area); footer links (17px
    tall -> ~25px by converting half the spacing from margin to padding, same flow
    height); homepage carousel dots (**8x8** -> **24x24** hit area via padding +
    `background-clip: content-box`, so the 8px visual dot is unchanged); pricing
    breadcrumb links (18px -> 24px+).
  - **BROKEN MOBILE LAYOUT on /leaderboard (real bug):** the 4-column row
    (rank 36 + cover 64 + info + amount 132 + 42 gaps) does not fit the ~292px
    content width, so the flexible title column **collapsed to 18px and wrapped
    titles one character per line into a 714px-tall column**. Added a <=560px
    breakpoint: smaller cover, amount wraps to its own line, title always has room.
  - **Caught + fixed a sitewide accessibility REGRESSION** introduced with the new
    configurable banner: default background `#12b76a` gives white text only
    **2.62:1** (AA needs 4.5:1). Because the banner renders on every page with 4
    active announcements — and `banner_settings` is not yet applied in prod, so the
    code default is what ships — **every page dropped from a11y 100 to 94-96**.
    Changed the default to the app's AA-safe `#08763b` (5.68:1) and darkened the
    level-colour gradients (`#f59e0b` was ~2.1:1, `#19b86a` ~2.5:1). **Verified back
    to 100 CLEAN.** Updated Codex's `banner-settings` test (it pinned the failing
    colour) and **added a contrast-ratio assertion** so this cannot regress again.
  _tsc 0, lint clean, suite **1063/1063**, build green._

- **CHAR-SM32 · seed-gap audit — the 64 empty tables, triaged** — Checked every empty
  Supabase table against the code to distinguish "feature can't be tested" from
  "correctly empty". Three categories:
  1. **Event / log / activity tables** (payment events, webhook events, audit logs,
     `contact_messages`, `marketing_consent`, ledger entries, …) — correctly empty;
     they populate only from real user activity. Seeding them would be fabricated
     history. **No action.**
  2. **Schema-only tables with ZERO code references** — `membership_tiers`,
     `digital_products`, `auction_items`, `auction_bids`, `livestreams`,
     `donation_forms`, `reward_tiers`, `giving_days`, `donor_segments`,
     `exclusive_posts`, `sms_campaigns`, … These came from a competitor-parity
     migration but **no UI or API reads them**, so there is no feature to test and
     seeding them would be pure fake data. **No action** (flagged as unbuilt
     features, not a seed gap).
  3. **A genuinely broken wired feature** — `supported_countries` → fixed in
     CHAR-SM31.
  _Conclusion: the "≥100 seed records per feature" goal is met for every table that
  actually backs a shipped feature; remaining emptiness is either real-activity data
  or unbuilt features._

- **CHAR-SM31 · PROD BUG FIXED — /supported-countries was live with ZERO countries** —
  Audited the 64 empty Supabase tables for ones that back real user-facing features.
  Most are event/log tables that only fill on activity (correct), but
  **`supported_countries` backs a PUBLIC page** that is fully Supabase-wired.
  It was **empty in production**, so charitme.com/supported-countries was live
  showing *"supports fundraisers in **0** countries and accepts donations from **0**
  countries"* with both country grids empty and every stat at 0.
  **Root cause:** the canonical country list was trapped inside
  `/admin/countries` behind a lazy `maybeSeed()` that only runs when an admin
  happens to open that admin page — which had never happened.
  **Fix:** new migration `20260802000000_seed_supported_countries.sql` seeds the
  canonical **69 countries** (20 can fundraise, 69 can donate) with a unique index
  on `iso_code` + `ON CONFLICT DO NOTHING`, so it is idempotent and never
  overwrites later admin edits. **Applied to production** and verified:
  DB `total=69, fundraise=20, donate=69, active=69`, and the **live page now reads
  "fundraisers in 20 countries … donations from 69 countries."**

- **CHAR-SM30 · accessibility — full public-page sweep COMPLETE (19 pages)** — Swept
  every remaining public page. Result: **19 pages verified at a11y 100**.
  - Already clean at 100: about-us, blog, features, contact, help, trust-safety,
    fast-payouts, supported-countries, for-individuals (9 pages, no changes needed).
  - Fixed the same `heading-order` skip (h1 -> h3, card titles missing h2) on
    **events, sponsor, matching** (98 -> expected 100; identical to the
    grants/volunteer fix already verified at 100).
  **Full a11y-100 list:** home, how-it-works, campaigns, faq, for-donors,
  for-nonprofits, pricing, success-stories, leaderboard, grants, volunteer,
  about-us, blog, features, contact, help, trust-safety, fast-payouts,
  supported-countries, for-individuals.
  _tsc 0, lint clean, suite **1052/1052**, `next build` green — and
  **events / sponsor / matching re-verified at a11y 100 CLEAN in a real prod build**
  (the earlier empty-output build failures were transient container flakiness, not a
  compile error)._

- **CHAR-SM29 · accessibility — long-tail page sweep (11 pages now at 100)** — Audited
  the previously-unchecked public pages. Found and fixed real failures:
  - **success-stories 95->100** and **leaderboard 94->100**: brand `--violet`
    (#6d35ff) used as *text* is only **3.06-3.28:1** on dark surfaces. Swapped the
    10 text usages to the existing AA-safe **`--violet-ink`** token (#5b21b6 light /
    #c4b5fd dark) - component-level, so it does not collide with Codex's theme work;
    the one globals.css touch extends a dark override Codex already wrote for
    `.lb-tabs button.active` (flagged here for visibility).
  - **grants 98->100** and **volunteer 98->100**: `heading-order` - both pages jumped
    **h1 -> h3** (card titles skipped h2). Card titles are now `h2`.
  - **Load check across 16 public pages**: all HTTP 200, 0.013-0.84s server response.
  **Pages verified at a11y 100:** home, how-it-works, campaigns, faq, for-donors,
  for-nonprofits, pricing, success-stories, leaderboard, grants, volunteer.
  _typecheck + lint clean; suite **1040/1040**; build green._

- **CHAR-SM28 · admin — merged the two Marketing pages into one** (owner request).
  `/admin/marketing` and `/admin/super/marketing` were **two parallel UIs over the
  SAME tables** (`seo_settings`, `aeo_entries`, `marketing_campaigns`) with their
  own duplicate API routes — an admin could edit the same record in two places with
  different field sets and different validation. Now **one Marketing page**:
  - **SEO** and **AEO** are first-class tabs on `/admin/marketing` (data loaded
    server-side alongside the overview; coverage metrics preserved).
  - `/admin/super/marketing` → **redirects** to `/admin/marketing`; its orphaned
    `MarketingClient.tsx` deleted; SuperAdminNav points at the merged page.
  - The six sibling pages that were just the hub with a preset tab (audience,
    segments, campaigns, automations, copilot, outreach) → **redirects** to
    `?tab=…`, so old links/bookmarks still work (build: 656 B stubs vs the 12.9 kB
    real page). `/admin/marketing/seo` also redirects to `?tab=seo`.
  - **Duplicate API routes removed** (`/api/admin/super/{seo,aeo}`, no callers left).
  - **⚠️ Caught a governance regression in the merge:** the retired super routes used
    `guardSuperAdmin` + `logSuperAdminAction`, while the surviving admin routes had
    **no audit trail**. Added `marketing_audit_logs` writes to
    `/api/admin/{seo,aeo}` for create/update/delete so auditability is preserved.
  _typecheck + lint clean; suite **1040/1040**; build green (routes verified in the
  build output). Note: admin routes are auth-gated, so redirect targets could not be
  followed headlessly — verified by build/type/lint rather than a logged-in click-through._

- **CHAR-SM27 · payments BUG — donor payment methods that Checkout can't fulfil** —
  The donate form offered **PayPal** and **Venmo** with their own processing-fee
  rates, but `ONE_TIME_PAYMENT_METHOD_TYPES` only enables card/link/cashapp/
  us_bank_account/amazon_pay/klarna/afterpay, and the live account has **no PayPal
  or Venmo capability**. Real money impact both ways: a donor picking **Venmo** was
  quoted **1.9% + $0.10** while the charge actually settled as **card 2.9% + $0.30**
  → **~$0.78 under-collected per $50 donation, absorbed by the platform** (the
  application fee is tip + processing); picking **PayPal** **over-charged** ~$0.53
  for a method they could never use. Fixed by offering only fulfillable methods
  (Stripe/card, Google Pay → card rail, Bank transfer → ACH), all of which quote
  their true rate. Added **`__tests__/payment-method-parity.test.ts`** (5 tests)
  that parses the real `PAY_OPTIONS`, asserts every option maps to an enabled
  Checkout type, has a fee config, and that **card-rail methods quote the exact card
  rate** — verified the guard fails loudly if PayPal/Venmo are reintroduced.
  _typecheck + lint clean; suite **1040/1040**._

- **CHAR-SM26 · performance — WebP covers across ALL remaining surfaces** — Extended
  `optimizedCoverUrl` to every other place a cover renders, each sized to its actual
  render box: `/success-stories` featured hero (900) + story cards (700),
  `/donors/[id]` campaign tiles (480), campaign-detail **similar-campaigns** rail
  (420), and `/leaderboard` rows (320). Deliberately **left the OG/social-share
  image full-size** (`campaigns/[slug]` metadata) — social scrapers need the large
  asset. Every cover on every page is now right-sized WebP from known hosts, with
  uploads untouched. _typecheck + lint clean; suite **1035/1035**; build green._

- **CHAR-SM25b · merge note (Claude ⇄ Codex)** — Codex converted the `/campaigns`
  card cover from a CSS background to a **lazy-loaded `<img>`** while Claude added
  **WebP right-sizing**; resolved by combining both (their `<img loading="lazy">`
  with `optimizedCoverUrl(...)` as the `src`). Codex also extended
  `lib/campaign-draft.ts` with **cross-device (Supabase) resume** + publish-failure
  copy on top of Claude's autosave module. Suite after merge: **1035/1035**.

- **CHAR-SM25 · performance — right-sized WebP campaign covers** — Discovery cards
  render ~190–350px tall but loaded full **800×600 JPEG** covers (45.7KB each ×
  60 cards). New `lib/img-optimize.ts#optimizedCoverUrl` (pure, 7/7 tested)
  rewrites **known hosts only** to a card-sized WebP — Picsum
  `/id/<n>/700/525.webp` (45.7KB → **11.1KB, −76%**) and Unsplash (`w`/`fm=webp`/
  `q=75`) — while **genuine user uploads (Supabase Storage), LoremFlickr, and data
  URIs pass through untouched**. Wired into `<CampaignImage>` (2× CSS width for
  retina) and the `/campaigns` card backgrounds. _Verified in the served HTML
  (`picsum.photos/id/100/700/525.webp`); prod Lighthouse `/campaigns` **perf 85,
  a11y 100**, total page weight 349KB. Full suite **896/896**; typecheck clean;
  build green._

- **CHAR-SM24 · UX — AI-default prefill (never an empty title field)** — Per the brief
  ("if AI can do it, never ask"), the guided builder no longer shows a blank title.
  New `lib/campaign-title.ts#suggestCampaignTitle` (pure, tested) derives a smart
  title from what's entered (beneficiary / self / category → e.g. "Help Sarah with
  medical expenses"); an effect seeds it once on reaching the Title step if empty,
  and a new **"✨ AI improve"** button calls `/api/ai/campaign` to overwrite with a
  polished version. Deterministic seed = instant + reliable (the app's AI-fallback
  pattern), fully editable. _Note on "fewer steps": physically merging steps was
  assessed but deferred — the steps carry entangled fields (e.g. the Location step
  also captures beneficiary name/relationship for non-self campaigns), so a blind
  merge risks regressions I can't verify headlessly; the prefill removes the actual
  friction (blank fields) instead._ _Evidence: `__tests__/campaign-title.test.ts`
  6/6; full suite **889/889**; typecheck + lint clean._

- **CHAR-SM23 · UX — publish-before-payout (biggest builder drop-off lever)** — The
  wizard hard-**blocked publishing** until a payout method was linked (step 8 of 9) —
  the #1 abandonment point. Made payout **optional to publish**: removed the
  `goNext` gate, so a creator can launch and share immediately and finish payout
  later. Safe by design — the donation API already 409s `PAYOUT_NOT_READY` until the
  recipient is payout-ready (destination charges), so nothing is lost by publishing
  first. Added clear, honest messaging throughout: payout step shows an "optional
  right now" note + the nav button becomes **"Skip — set up later →"**; the review
  step shows "you can launch now… connect a payout method to receive donations
  (do it now / from your dashboard)"; the success screen swaps its copy when unlinked
  and shows a prominent **"Set up payouts →"** CTA (starts Stripe onboarding). The
  public campaign page already handles the unlinked state gracefully for donors
  ("💜 Donations open soon — payout setup is being completed"). _typecheck + lint
  clean; build green._

- **CHAR-SM22 · performance — hero image WebP** — `/hero-child-crop.png` was a 310×278
  photo weighing **211KB as PNG** (homepage hero fallback + demo avatars). Converted
  to **WebP → 12.2KB (94% smaller)**, updated its 3 references, removed the old PNG
  (now 404s). Prod home perf **89**, a11y 100. Combined with the logo fix, ~480KB
  less on the homepage. (Also noted: `CharitMe_Logo.png` 195KB is unreferenced — not
  served, kept as an owner source; no runtime cost.)

- **CHAR-SM21 · performance — oversized logo (sitewide)** — `/logo.png` was a **292KB
  512×512 PNG rendered at ≤42px** in the header on every page (Lighthouse: 288KB
  wasted, the top "responsive-images" offender). Resized with `sharp` to a crisp
  128px (3× the max display) → **6.7KB (98% smaller)**, transparent bg preserved,
  logo verified intact. No code change (all 5 usages are ≤42px `<img>`; not used
  large anywhere — checked OG/manifest/icons). **Prod Lighthouse home: perf 63 →
  88** (LCP 4.1→3.1s, TBT 640→100ms; the image opportunities dropped off). Benefits
  every page since the logo loads in the shared header.

- **CHAR-SM20b · ✅ RESOLVED (owner-authorized) — live Stripe webhook config fixed** —
  With explicit owner authorization, modified the live Stripe webhook config:
  1. **Prod webhook `www.charitme.com/api/stripe/webhook` expanded 2 → 20 events** —
     the full set the handler processes (checkout.session.completed, invoice.payment_
     succeeded/failed, payment_intent.*, charge.succeeded/updated/refunded,
     charge.dispute.created/closed, customer.subscription.created/updated/deleted,
     account.updated, transfer.created/failed, application_fee.created, payout.*).
     **Recurring renewals, subscriptions, refunds, and disputes will now be
     delivered.** Signing secret unchanged (event-only edit) — existing
     `STRIPE_WEBHOOK_SECRET` stays valid.
  2. **Unknown `eli54u.com` endpoint DISABLED** (reversible; not deleted, in case
     it's a first-party service) — it no longer receives live payment events, closing
     the data-exposure risk. Owner should **delete** it permanently after confirming
     it's not theirs.
  3. Still open: real `STRIPE_CONNECT_WEBHOOK_SECRET`; set Stripe env in Vercel.

- **CHAR-SM20 · 🚨 CRITICAL — live Stripe webhook findings (OWNER ACTION REQUIRED)** —
  Read-only audit of the live Stripe account (`acct_1TNul7…`; charges/payouts/
  details_submitted all ✅; card_payments + transfers active).
  1. **Prod webhook `www.charitme.com/api/stripe/webhook` subscribes to only 2 events**
     (`checkout.session.completed`, `account.updated`). The handler processes many
     more, so **one-time donations record, but recurring-donation renewals,
     CharitMe Plus/Pro subscription lifecycle, and refunds/disputes are NEVER
     delivered → those flows are broken in production.** Owner must add the events
     the handler consumes (at minimum: `invoice.paid`/`invoice.payment_succeeded`,
     `invoice.payment_failed`, `customer.subscription.created/updated/deleted`,
     `charge.refunded`, `charge.dispute.created`, plus the async checkout variants),
     and set the resulting **signing secret** as `STRIPE_WEBHOOK_SECRET` in Vercel.
  2. **🔴 UNKNOWN webhook endpoint on the LIVE account:** `https://eli54u.com/api/stripe/webhook`
     (created 2026-06-02) is subscribed to **8 sensitive events** — `checkout.session.completed`,
     `customer.subscription.*`, `invoice.payment_*`, `customer.card.updated`,
     `customer.bank_account.updated`. **Possible payment-data exfiltration.** Owner
     should review in the Stripe Dashboard and **delete it** unless it is a known
     first-party endpoint. (Not modified by me — deleting live webhook endpoints is
     an owner decision.)
  3. **`STRIPE_CONNECT_WEBHOOK_SECRET` still a placeholder** — Connect events won't
     verify until the real Connect-endpoint secret is set.

- **CHAR-SM19 · accessibility (real Lighthouse against live data)** — Ran Lighthouse
  (mobile) on the running app wired to live Supabase. **Home a11y = 100**, BP 96.
  **`/campaigns` a11y 91 → 95**: fixed real issues — added `aria-label` to the
  category/sort `<select>`s (cleared `select-name`) and both filter inputs;
  darkened the Search button to `--green-dark` (#08763b, 5.68:1 on white) and set
  filter-input placeholders. **A prod build then exposed the REAL root cause** (dev
  Lighthouse was noisy but the issue was genuine): the page renders in dark mode,
  where `--green-dark` flips to light-green (#4cce86 → white button text 2:1) and
  the filter inputs had **no explicit background**, so dark-mode light text tokens
  sat on the browser-default white input surface. Fixed properly: inputs get
  `background: var(--s1); color: var(--t1)` (text+bg track the theme together, so
  placeholder `var(--t2)` contrasts in both), and the Search button uses a **fixed**
  dark green `#08763b` (5.68:1 with white in either theme). **Prod Lighthouse:
  `/campaigns` a11y 91 → 100, 0 issues.** typecheck + lint clean; suite **880/880**.
  **Prod-Lighthouse contrast sweep** (exact ratios extracted): fixed **faq** CTA
  `emerald-600`→`emerald-700` (white-on-#059669 was 3.76); **pricing**
  `.fee-calc-badge` #19b86a→#08763b (white was 2.59) + dark-mode override
  `.fee-calc-warning`→#fb7185 (rose was 3.8 on the dark card). _Remaining a11y
  (logged): `/for-donors` + `/for-nonprofits` aren't dark-mode-aware — fixed
  `text-blue-700`/`text-purple-700` stats sit on the dark bg (2.66:1); needs a
  per-page dark-mode color treatment (a larger slice)._
  **✅ RESOLVED:** root cause was the `.mktg-page` dark theme remapping `bg-white`/
  `bg-slate` + text but leaving **colored tint surfaces** (`bg-blue-50` #eff6ff)
  light while their text went light → light-on-light. Extended the `.mktg-page`
  dark block to remap `bg-{blue,sky,indigo,purple,violet,amber,yellow}-50` to dark
  accent tints, lightened `text-{blue,purple}-{600,700}` accents on dark, and added
  `[data-theme=dark] .fee-calc-bad`. **Prod Lighthouse: for-donors, for-nonprofits,
  pricing all 91/95→100.** 7 key pages now a11y 100.

- **CHAR-SM18 · security + builder analytics (goal: security resolved, track every step)** —
  (a) **RLS verified live:** all **143** public tables have RLS enabled, **0 without**.
  (b) **Campaign-builder funnel analytics** (was invisible → now measurable):
  migration `20260725000000_campaign_builder_events.sql` (append-only table, anon
  INSERT + service-role-only SELECT, event/path CHECK enums, indexes) **applied
  live** (RLS verified, self-cleaning insert→delete smoke passed). `POST
  /api/analytics/builder` (validated, best-effort 204, captures user id when
  logged in) + `lib/builder-analytics.ts` (`parseBuilderEvent` — tight enum/size
  validation, tested). Wired `/create` to emit `enter` per step, `save_draft`/
  `publish` on completion, and **`abandon` on tab close** — giving real drop-off /
  abandonment / completion-time signal. _Evidence: `__tests__/builder-analytics.test.ts`
  8/8; full suite **880/880**; typecheck + lint clean; `next build` green._

- **CHAR-SM17 · seed coverage audit (goal: ≥100 records/feature)** — Live audit: **73
  non-empty tables**, every real feature table ≥100 rows (campaigns 500, donations
  620, recurring_donations 620, payouts 620, refunds 620, updates/milestones 620,
  volunteer/grants/events/impact/matching/sponsorship all 120, badges 120,
  notifications 120, tax_receipts 120, etc.). Sub-100 tables are **config/lookup**
  (`platform_settings=1`, `payment_processors=2`, `admin_settings=7`,
  `feature_flags=12`, `marketing_automations=24`) where 100 rows is meaningless, or
  low-volume real data (`sponsors=50`, `share_events=6`). **Goal item met** — no
  fake padding of config tables. _Verified read-only via Management API._

- **CHAR-SM16 · OPEN ITEMS — owner credentials provided (Stripe/Supabase live)** — Owner
  supplied real credentials (LIVE). **⚠️ SECURITY: every value was shared in chat/file
  and MUST be rotated after use; nothing secret is committed (`.env.local` gitignored).**
  Numbered open items, Stripe-first per owner request ("do what is needed starting at #1"):
  1. **Stripe subscription price wiring — ✅ DONE (local); owner must set in Vercel.**
     Checkout (`/api/stripe/checkout`) reads `STRIPE_{STARTER,PRO}_{MONTHLY,YEARLY}_PRICE_ID`;
     owner gave **product** ids only. Verified the live account read-only
     (`acct_1TNul7…`, charges_enabled, US) and resolved each product → its active
     **price** id (non-secret), wired into `.env.local`:
     - `STRIPE_STARTER_MONTHLY_PRICE_ID=price_1TbRHnBrwQtGmNLkGHtm2BrD` ($19/mo)
     - `STRIPE_STARTER_YEARLY_PRICE_ID=price_1TbRI5BrwQtGmNLk6BdLGetC` ($228/yr)
     - `STRIPE_PRO_MONTHLY_PRICE_ID=price_1TbRIKBrwQtGmNLknRFNkTZ5` ($59/mo)
     - `STRIPE_PRO_YEARLY_PRICE_ID=price_1TbRIWBrwQtGmNLkkh0b32KR` ($708/yr)
     **Owner action:** set these four (+ `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
     `STRIPE_WEBHOOK_SECRET`) in Vercel so production subscription checkout works.
  2. **Stripe env in production (Vercel, owner-side)** — set `STRIPE_SECRET_KEY`,
     `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, the four price ids,
     `DEFAULT_DONOR_TIP_PERCENT=15`. **`STRIPE_CONNECT_WEBHOOK_SECRET` is still a
     placeholder (`whsec_connect…`)** — the real Connect-endpoint signing secret is
     required or Connect webhooks won't verify.
  3. **Supabase keys rotated to new format** (`sb_publishable_…`/`sb_secret_…`) +
     `SUPABASE_ACCESS_TOKEN` restored. **✅ APPLIED the unique-covers migration
     (`20260724000000`) to production via the Management API** — `distinct_covers`
     50→**500**, dup groups **0**, all 500 Picsum, galleries synced. The
     "every image unique, 0 duplicates" goal item is met for campaign covers.
  4. **End-to-end donation verify** — now possible against LIVE, but only with a real
     tiny charge + immediate refund, or Stripe **test** keys; do NOT run live charges
     without explicit owner go-ahead (ADR-0003).
  5. **Still missing:** real `OPENAI_API_KEY` (file has `sk-...` placeholder → AI uses
     deterministic fallbacks) and `UNSPLASH_ACCESS_KEY` (CHAR-SM13 themed covers).
  6. **Campaign-builder roadmap** (CHAR-SM15): publish-before-payout, fewer steps +
     AI-default prefill, per-step drop-off analytics, in-flow image suggestions, live preview.

- **CHAR-SM15 · campaign builder · audit + draft autosave/recovery (slice 1)** — Began
  the world-class rebuild of the **two** existing campaign paths (AI creator at
  `/ai-campaign`; guided 9-step wizard at `/create`). Full audit in
  **`docs/campaign-builder-audit.md`** (friction inventory ranked by impact + a
  realistic roadmap; honest about which wishlist items — AI image/video gen,
  background removal, voice, transcription — need external services/keys and
  won't be faked). **Shipped the #1 abandonment fix: draft autosave + recovery.**
  The wizard previously wrote to Supabase only on final submit, so any
  interruption lost everything. New `lib/campaign-draft.ts` (pure, tested:
  build/serialize/parse with 7-day TTL + version + defensive validation,
  `draftHasContent`, `draftAgeLabel`) persists wizard state to localStorage on
  every change (debounced); `/create` shows a "Welcome back — resume?" banner with
  saved-age + Resume/Start-fresh, a "✓ Saved" indicator, and clears the local copy
  on successful Supabase submit. Coexists with the existing login-bounce
  `sessionStorage` restore (that takes precedence). Rationale: in-progress form
  state belongs in localStorage (instant, offline-safe, no half-built DB rows);
  committed drafts still go to Supabase via "Save draft". _Evidence:
  `__tests__/campaign-draft.test.ts` 9/9; full suite **872/872**; typecheck + lint
  clean; `next build` green._ **Next slices (roadmap):** publish-before-payout,
  step-count reduction + AI-default prefill, per-step drop-off analytics, in-flow
  image suggestions (Unsplash), live multi-device preview.

- **CHAR-F014 · comments/bugfix** — `POST /api/campaigns/[id]/messages` inserted a
  non-existent `visibility` column into `donor_messages` → every comment 500'd.
  Removed the stray field. _Evidence: verified live vs schema; commit `20d1597`._

- **CHAR-A001 · audit (no fix needed)** — Verified sound: open-redirect
  protection (`safeNextPath` rejects non-local hosts, `javascript:`, `//host`),
  recurring-donation cancel/pause ownership, campaign sub-resource mutation
  authz (milestones/updates/rewards/faqs/settings/beneficiaries), receipt +
  profile-image upload scoping. No changes required.
- **CHAR-O001 · data** — 50 fabricated sponsors + 500 fabricated support cases
  already exist in the **live** Supabase (inserted before CHAR-F001). Deleting
  production rows needs explicit owner approval — not yet actioned.
- **CHAR-O002 · security** — Live Stripe/Supabase/Resend/Google/CRON secrets
  were exposed in chat and should be **rotated**.
- **CHAR-O003 · content** — about-us company-history timeline (2022–2026,
  "millions raised") is fabricated brand narrative; owner should confirm/revise.
- **CHAR-O004 · security** — No full Content-Security-Policy (script-src/
  style-src) yet; only `frame-ancestors`. Full CSP needs a nonce strategy
  because the app uses pervasive inline styles.

---

## 0.1b GoFundMe competitive teardown — verified feature gaps (2026-07-25)

_Source: 18-slide screenshot deck of gofundme.com (ingested by rendering the
embedded images — the deck carries no extractable text). Every "MISSING" below
was checked against this repo, not assumed; the check used is noted. Owned by the
production-ready agent — **claim an item here before starting it** so we don't
collide._

**Already at parity (do NOT rebuild):** `/impact`, `/help`, `/supported-countries`,
`/pricing`, `/for-nonprofits`, `/volunteer`, `/matching`, `/sponsor`, `/grants`,
`/events`, `/leaderboard`, `/donor`, `/blog`, plus `lib/i18n.ts`. CharitMe also
ships several things GoFundMe does not surface at all (AI campaign builder, AI
growth engine, CharitScore trust, grants + volunteer marketplaces, 0% platform fee).

### P0 — strategic gaps (biggest competitive delta)

1. **Giving Funds / donor balance wallet** — GoFundMe's flagship new product
   ("All your giving. All in one place."): a donor adds money to a balance, then
   grants from it to nonprofits over time, with `Total contributed` / `Total
   donated` counters and a `Your Giving Fund` entry in the account menu. It is a
   donor-advised-fund pattern — it captures money *before* a specific campaign is
   chosen, which structurally raises lifetime donation volume.
   _CharitMe has a donor portal but no funded balance._ **Note:** holding donor
   funds has real regulatory weight (money transmission, DAF rules) — this needs a
   product/legal decision before any build, and must not be started as a pure
   engineering task. _Verified: no `giving-funds` route._
2. **Proximity discovery ("15 miles away")** — GoFundMe's discovery rail ranks
   fundraisers by distance from the visitor and labels each card with the mileage.
   Local relevance is one of the strongest donation drivers in crowdfunding.
   _CharitMe has only a free-text `Location…` filter on `/campaigns`; nothing
   geo-aware._ Needs lat/long on campaigns (or geocoded location), a distance sort,
   and consent-gated coarse geolocation. _Verified: 0 matches for
   `miles away|nearby|distance` across all `.tsx`._
3. **Donor protection guarantee** — GoFundMe leads with the "Giving Guarantee" as
   a top-level trust page. _CharitMe mentions guarantees only inside `/terms` and
   the refund form — there is no donor-facing guarantee page._ Highest
   trust-per-effort item on this list, and mostly content + policy rather than
   engineering. _Verified: `grep -rln guarantee app/` → terms + RefundForm only._

### P1 — product surfaces GoFundMe has and CharitMe doesn't

4. **True peer-to-peer fundraising** — a headline GoFundMe surface. **Partial
   parity:** `/dashboard/team` exists and genuinely supports inviting
   co-organizers, so the home FAQ's "invite co-organizers" claim is accurate.
   What's missing is real P2P: each supporter getting their **own sub-fundraiser
   page** that rolls up into a parent campaign total (the classic
   walk/run/team-page model). The FAQ's phrase "peer-to-peer **and** team
   fundraising" reads as promising both, so either build the sub-page rollup or
   tighten that sentence to the co-organizer capability that actually ships.
   _Verified: `/dashboard/team` present with invite flow; no sub-campaign/rollup
   model anywhere._
5. **Crisis relief hub** — curated emergency/disaster landing surface. CharitMe has
   an `Emergency` category but no hub.
6. **Social Impact Funds** — donate to a curated multi-charity fund rather than one
   campaign.
7. **Supporter Space** — a dedicated donor-community surface.
8. **Tiered nonprofit product** ("GoFundMe Pro for nonprofits") — CharitMe has
   `/for-nonprofits` marketing but no tiered/paid nonprofit offering.

### P2 — UX and polish deltas

9. **Hero has one CTA.** GoFundMe's hero is a single "Start a GoFundMe". CharitMe's
   renders **four** CTAs (`Create My Fundraiser With AI`, `Donate Now`, `Create My
   Fundraiser`, `Why We Beat GoFundMe`) — two of which are near-duplicates. Choice
   overload at the highest-intent moment on the site.
10. **Locale + language switcher** in the footer (`United States · English`).
    **✅ PARTIALLY FIXED — two dead controls found in `/dashboard/settings` while
    checking this.** Both were user-facing lies, now corrected:
    - **"Default Date Range" was a dead control.** It had no `value`/`onChange`
      binding and was **absent from the `savePreferences` payload** — so a user
      changed it, got a green *"Preferences saved!"* toast, and nothing persisted.
      No consumer exists anywhere in the codebase. Removed rather than faked.
      _Verified: not in the PATCH body; `grep default_date_range` → 0 hits._
    - **"Language" saves but does nothing.** It correctly persists
      `profiles.language` to Supabase, but `t()` in `lib/i18n.ts` is imported by
      **zero rendering components**, so selecting *Español* leaves the entire site
      in English. Added honest hint copy ("Translated pages are still rolling
      out — the interface currently displays in English") instead of implying it
      works. _Verified: only 2 importers of `lib/i18n`, neither renders UI._
    _Still open:_ real translation coverage (a genuine multi-quarter effort — every
    user-facing string), and the public footer locale switcher.

    **✅ Follow-up sweep — 3 MORE dead controls removed from `/dashboard/settings`.**
    Same signature as the Date Range one (`defaultValue` with no `onChange`, absent
    from every save payload, no consumer anywhere): **Country**, **Default Dashboard
    View**, and **Email Frequency**. All three sat beside working controls and were
    covered by the same green success toast, so the page reported saving four
    settings it never sent. Four dead controls total on one page.
    _Verified per control: not in `saveProfile`/`savePreferences`/`saveNotifications`
    bodies; not in the `/api/settings` zod schema._

    **⚠️ NEW — `supabase/schema.sql` + `catch_up.sql` are STALE for `profiles`.**
    Both generated mirrors list `profiles` with **12 columns** and no
    `language`/`timezone`/`currency`/`date_format`/`time_format`/
    `show_public_profile`/`campaign_recommendations` — yet `/api/settings` writes
    and selects exactly those, and the schema-contract test (which asserts every
    selected column exists in `__tests__/fixtures/schema-columns.json`, regenerated
    from the live DB) **passes**. So the live DB has them and the two committed
    mirrors do not. **Anyone provisioning a fresh database gets a broken Settings
    page.**

    **✏️ CORRECTION + ✅ MOSTLY FIXED.** My original note above said the fix was to
    "re-run `scripts/regen_schema.sh` against the live DB", and called it
    credential-gated. **That was wrong about the mechanism.** `regen_schema.sh`
    regenerates `schema.sql` **from `supabase/migrations/`** — it never reads the
    live database. So the mirrors were not "stale copies of production"; the real
    situation is that **the live DB has 7 `profiles` columns that no migration ever
    created**, added out-of-band. The mirrors were faithfully reflecting the
    migrations, which were the thing actually missing.
    That made it fixable here after all:
    - **Added `supabase/migrations/20260803000000_profiles_preference_columns.sql`**
      covering `timezone, currency, language, date_format, time_format,
      show_public_profile, campaign_recommendations`. All `add column if not
      exists`, so it is a **no-op against production** and only takes effect on a
      fresh provision. Nullable with defaults mirroring the app's own `??`
      fallbacks — `NOT NULL` would risk failing against existing rows.
    - **Regenerated `supabase/catch_up.sql`** via `scripts/build_catchup.py` (pure
      Python over the migrations, no DB needed). Diff is **1355 insertions, 0
      deletions** — purely additive, and notably it was behind on *other* agents'
      migrations too, not just this one.
    **✅ `profiles` NOW EXACTLY MATCHES PRODUCTION.** A second pass found the first
    migration was incomplete — it restored the 7 *preference* columns, but diffing
    the live snapshot (26 cols) against `schema.sql` (12) + that migration (7)
    showed **7 more** live-only columns: `bio`, `org_name`, `org_tagline`,
    `org_website`, `plan`, `stripe_customer_id`, `stripe_subscription_id`. Those
    back the **Profile & Organization** panel and **all of Billing** (incl. the
    `hasStripeCustomer` prop choosing between the Stripe portal button and "Add
    method"), so a fresh provision lost profile editing and billing too. Added
    `20260803010000_profiles_profile_billing_columns.sql` and regenerated
    `catch_up.sql` (+50 lines, 0 deletions).
    **Verified: base 12 + migrations 14 = 26 = live 26, nothing missing, nothing
    extra.**

    **🔴 SYSTEMIC — 21 of 143 tables have 61 live-only columns (NOT just `profiles`).**
    Same diff across every table. A database provisioned from the migrations is
    missing, among others:
    - **`donations`** (7): `tip_cents`, `processing_fee_cents`,
      `stripe_checkout_session_id`, `offline`, `offline_donor_email`,
      `offline_donor_name`, `offline_method` — **core money fields**
    - **`campaigns`** (5): `location`, `video_url`, `ai_generated`,
      `nonprofit_verified`, `thank_donors_sent_at`
    - `verification_documents` (7), `tax_receipts` (4), `subscriptions` (4),
      `trust_scores` (5), `refunds` (3), `campaign_updates` (3), `campaign_media` (3),
      plus 11 more tables.

    **I deliberately did NOT auto-generate these migrations.** The snapshot stores
    column *names only*, no types. For `profiles` the types were confidently
    inferable from active use and verified; guessing across 61 columns is a
    different matter — typing `tip_cents` as `text` instead of `integer` yields a
    database that looks correct and silently behaves differently, which is **worse
    than having no migration**. Getting this right needs one query against the live
    DB (`information_schema.columns`), which this sandbox cannot reach.

    **✅ BLIND SPOT NOW GUARDED — `__tests__/migrations-reproduce-schema.test.ts`.**
    Reconstructs what a fresh provision yields (`schema.sql` CREATE TABLE bodies +
    every `add column if not exists` across the migrations) and diffs it against
    the live snapshot. The existing 61-column gap is recorded in
    `fixtures/schema-migration-drift-baseline.json` rather than failing the suite,
    since closing it needs real types from `information_schema.columns`.
    It fails on **change in both directions**: new drift (a column added live, or a
    migration dropped) *and* reduced drift (someone fixed part of it → shrink the
    baseline, so it can't quietly re-hide future drift).
    **Verified non-vacuous:** planting a fake `donations.zz_new_live_only_column`
    in the snapshot makes it fail naming that exact table and column; the fixture
    was restored afterwards and `git status` confirms it unmodified.

    **✅ ONE PASTE FROM DONE — `scripts/gen_drifted_columns_migration.sql`.**
    Before settling for "needs a live DB", I checked two other routes to the types
    and both genuinely fail: there are **no generated Supabase types** in the repo,
    and inferring from how the same column name is typed on other tables covers
    only **26 of 61** (32 have no precedent anywhere, 3 conflict). Mixing verified
    and guessed types would be worse than a clean handoff.

    So instead of documenting the blocker, the query that *resolves* it is now
    committed. Run it against the live DB and it **emits the finished migration**:
    all 61 `(table, column)` pairs are embedded, and it reads
    `pg_catalog`/`format_type` to render each real type — including enums, arrays
    and precision, which `information_schema.data_type` cannot (it reports
    `USER-DEFINED` and `ARRAY`, neither usable as a type name). Read-only; changes
    nothing. Then: save the output as a migration → `python3
    scripts/build_catchup.py` → shrink the drift baseline → tests go green.
    _Honest caveat, also in the file:_ **it has never been executed** — this
    sandbox has `psql` but no `initdb`/`pg_ctl` to stand up a server. It only
    touches `pg_catalog`, so the worst case is a syntax error you see instantly.

    **⚠️ The blind spot this closes:** the schema-contract test does **not** catch it. It
    validates that *code selects* exist in the live snapshot — i.e. that code
    matches production. It cannot tell that the *migrations* fail to reproduce
    production. Those are different invariants, and only the first is currently
    tested.

    _Still outstanding:_ `supabase/schema.sql` itself. `regen_schema.sh` needs
    `initdb`/`pg_ctl` to spin up a throwaway Postgres; this sandbox has only
    `psql`/`pg_dump`, and runs as root, which `initdb` refuses. Anyone with a local
    Postgres can now regenerate it from the migrations in one command.
    _(This nearly read as a production-breaking bug; the schema-contract test is what
    proved the columns really are live. Recording the reasoning so the next agent
    doesn't re-raise it as a runtime defect.)_

    **✅ FIXED — inverse gap: `date_format` + `time_format` now surfaced.**
    `/api/settings` already accepted both (zod enums), `page.tsx` already selected
    them and the client type already declared them — only `useState`, the
    `savePreferences` payload, and the UI were missing, so the fields could never
    be changed from the app. Added two bound selects in the Preferences panel with
    worked examples (`03/14/2026` / `2:30 PM`). Option values match the zod enums
    exactly (`MM/DD/YYYY|DD/MM/YYYY|YYYY-MM-DD`, `12h|24h`), verified by diffing
    the literals against the schema, so the round-trip cannot 400.
    _Net for this page: 4 dead controls removed, 2 real ones added._

    **⚠️ HANDOFF — 4 dead controls in the LIVE admin user drawer (not fixed here).**
    `app/admin/users/_components/AdminUsersClient.tsx`, all verified as having no
    `onClick` and no enclosing form:
    - **L658 `Edit ✏️`** — no handler.
    - **L766 sub-tab strip** (`Login History` / `Actions` / `Sessions`) — no handler,
      and `active` is hardcoded to `'Login History'`, so the selection can never
      move. The panel below renders `selectedActivities` regardless of tab, so the
      tabs are decorative over a single dataset.
    - **L820 `View Public Profile`** — no handler, and **nowhere to point**:
      `app/profile` has no dynamic segment, so no public per-user profile route
      exists.
    - **L793 `View all activity →`** — no handler.
    Not oversight-by-me: the button at L822 immediately below has a working
    `onClick`, so these four are genuinely unfinished. **I did not fix them** —
    each needs a feature that does not exist yet (a public profile route, a
    sessions/actions view, an admin edit flow), and the file is hot (3 recent
    commits from other agents: `a70587b`, `8a68d2d`, `679c294`). Whoever owns
    admin should take it with this evidence.

    **⚠️ COORDINATION HAZARD — `_components/UsersClient.tsx` is orphaned dead code.**
    623 lines that duplicate the live `AdminUsersClient.tsx` (1391 lines), and
    **nothing imports it** — verified with an exact-import regex, not a substring
    grep (a plain `grep UsersClient` gives false hits because it also matches
    `AdminUsersClient` and `SuperUsersClient`). `app/admin/users/page.tsx` imports
    `AdminUsersClient`. It carries its own copies of the same dead controls, so an
    agent could "fix" them there and see no effect in the running app. Recommend
    deleting it, but leaving that to the admin owner to avoid a collision.

    **✅ FIXED — `/forgot-password` double-submit + stale success banner.**
    Two real bugs on a critical account-recovery path:
    - **No pending state.** `submit` was async with nothing guarding re-entry and
      no disabled state, so double-clicking sent **two reset emails**. Added a
      `pending` guard, `disabled` + `aria-busy`, and a "Sending…" label.
    - **`message` was never cleared.** Only `setError('')` ran on submit, so a
      success followed by a failure left "Check your email" sitting above the new
      error. Now both banners clear, and the call is wrapped in try/catch/finally
      so a network throw can't strand the button disabled forever.
    Also made the implicit submit explicit (`type="submit"`).
    _Checked first, not assumed:_ the button looked handler-less in a sweep, but it
    sits inside `<form onSubmit>` and a typeless `<button>` defaults to submit —
    password reset was **never** broken. Flagging so nobody re-reports it.
    _No test added:_ the suite has **zero** component-render tests (no `render(`
    across 91 files); it is pure logic/unit. Pulling in React Testing Library for
    one case would add a dependency and setup other agents could collide with.

    **⚠️ For the theme agent — `/forgot-password` is hardcoded light.**
    `bg-white`, `border-slate-200`, `text-slate-600`, `bg-emerald-50` with no dark
    variants, so the card stays white in dark mode. Left alone deliberately: theme
    work is `38e1141`/`a1d06ee`'s lane. Note this page also uses raw Tailwind
    despite CLAUDE.md stating "No Tailwind, no CSS modules" — the auth pages
    diverge from the documented inline-style + CSS-variable convention.

    **✅ FIXED — Playwright was unrunnable in the sandbox; e2e now executes.**
    `npx playwright test` died with *"Executable doesn't exist at
    …chromium_headless_shell-1223…"*. The sandbox ships build **1194**
    (`/opt/pw-browsers/chromium` → `chromium-1194/chrome-linux/chrome`) and
    `playwright install` is explicitly disallowed here. Added an **opt-in**
    `PLAYWRIGHT_CHROMIUM_PATH` override wired into both projects' `launchOptions`.
    Unset it is a **no-op**, so CI and normal local dev are untouched; set, it
    launches the provided binary. Run with:
    `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test`
    _Verified: browser launches and tests execute (they now fail on app behaviour,
    not on a missing browser)._ This unblocks e2e for **every** agent, and is a
    prerequisite for CHAR-0014.

    **⚠️ NEW, MEASURED — every page blocks on a Supabase Auth round-trip.**
    `middleware.ts:92` awaits `supabase.auth.getUser()` — a real network call —
    and `matcher` (L131) covers every route except `_next/*`, `favicon.ico`, and
    `api`. Measured against a production build with live Supabase creds:

    | Request | Time |
    |---|---|
    | `/api/health` (matcher-excluded) | **0.014s** |
    | `/` (warm, ×2) | **7.16s / 7.15s** |
    | `/campaigns` (warm, ×2) | **7.08s / 7.09s** |

    The server is fast; the entire cost is the middleware auth hop. Note how
    *uniform* it is — 7.08–7.16s across pages with completely different queries —
    which is the signature of one fixed serial stall, not query load.
    **Caveat on magnitude:** ~7s is inflated by this sandbox's outbound proxy; on
    Vercel co-located with Supabase expect ~50–200ms. **The architecture is the
    finding, not the 7s** — every page, including fully public ones (`/about`,
    `/terms`, `/campaigns`) that need no auth, serially waits on Auth before
    rendering.
    _Not fixed here deliberately:_ `getUser()` is the security-correct call
    (validates the JWT server-side; `getSession()` trusts the cookie), so it must
    **not** be naively swapped. The safe optimization is to skip the refresh on
    routes that need no session, but that trades off how long sessions stay warm
    sitewide — an auth/security decision, in a hot shared file, that shouldn't be
    made unilaterally mid-sweep.

    **✅ FIXED — you could not file a Sports or Cheer campaign properly.**
    Directly on the "build a campaign for *anything*" goal. `CAMPAIGN_CATEGORIES`
    (canonical, `@shared/fees`) has **18** categories, but `lib/campaign-followups.ts`
    carried its own **hardcoded copy with only 11** of them. That list feeds the AI
    follow-up question *"What kind of campaign is this?"*, so a user fundraising for
    a **sports team, cheer squad, event, family need, travel, volunteering, or a
    wish** was offered no matching option and had to answer **"Other"** — the exact
    cases in the goal.
    Missing: `Competition, Event, Family, Sports, Travel, Volunteer, Wishes`.
    Fixed at the root by deriving the options from `CAMPAIGN_CATEGORIES` + `Other`,
    so it cannot drift again.

    **Also deduped two more copies of the same list** (both currently correct, both
    free to drift): `lib/marketing-goals.ts` and
    `app/admin/campaigns/_components/AdminCampaignsClient.tsx` — the latter declared
    a local `CAMPAIGN_CATEGORIES` that *shadowed* the shared export. Three
    hand-maintained copies existed; now there is one source of truth.

    **Regression test proven to fail against the old code**, not merely to pass
    against the new: temporarily restoring the 11-item list makes it fail with
    `categories missing from the follow-up picker: Competition, Event, Family,
    Sports, Travel, Volunteer, Wishes`. A second test pins the `Other` escape hatch.

    **✅ FIXED — "Build with AI" filed every competition campaign as *Animal*.**
    `lib/campaign-intake.ts` matched category keywords with a plain
    `text.includes(keyword)`, so short keywords fired **mid-word**:
    - `'pet'` is inside com**pet**ition → *"robotics competition entry fees"* and
      *"my daughter's cheer competition"* both classified **Animal**.
    - `'cat'` is inside va**cat**ion, dedi**cat**ed, communi**cat**ion → also Animal.
      (`education` escaped only because Education is tested before Animal — luck,
      not design.)
    Fixed by anchoring the **start** of each keyword to a word boundary while
    deliberately leaving the end open, so the intentional stems still work
    (`sustainab`→sustainable, `relocat`→relocating, `team`→teams). Regexes cached.

    **Also: whole cause types matched nothing at all.** Measured, not assumed —
    probed the real function before/after:

    | organizer types | before | after |
    |---|---|---|
    | "help our cheerleading squad get to nationals" | *no match* | Competition |
    | "my daughter's cheer competition" | **Animal** | Competition |
    | "robotics competition entry fees" | **Animal** | Competition |
    | "funds for our marching band new instruments" | *no match* | Creative |
    | "help me buy a new guitar for gigs" | *no match* | Creative |
    | "family vacation fund" | **Animal** | *no match* (honest) |

    `Competition` had **zero** keywords, so the category was unreachable from the AI
    path. Added cheer/dance/gymnastics/robotics/debate/esports/pageant terms, music
    terms (musician, band, guitar, orchestra, instrument, gig, tour…) which
    previously only matched `'album'`/`'music video'`, and more youth-sports terms.
    **6 regression tests, all verified to fail against the old matcher** (3 fail on
    the `includes` revert). Existing 15 intake tests still pass.

    _Pre-existing, NOT changed:_ "vet bills for my dog after surgery" → **Medical**,
    because Medical is ordered before Animal and `surgery` wins. Arguably wrong but
    it predates this fix; flagging rather than silently reordering a priority list
    other flows depend on.

    **✅ FIXED — the default campaign title said "Support my the team".**
    `lib/campaign-title.ts` prefills the wizard's title field. Its phrase map mixes
    bare nouns (`education`) with phrases carrying their own determiner
    (`the team`, `our cause`, `a creative project`), and the `Support my …`
    template pasted the latter straight in. **11 of 18 categories** produced
    broken English for anyone fundraising for themselves:

    | category | before | after |
    |---|---|---|
    | Sports | *Support my **the team*** | Support my team |
    | Competition (cheer) | *Support my **the team*** | Support my team |
    | Creative (musician) | *Support my **a creative project*** | Support my creative project |
    | Nonprofit | *Support my **our cause*** | Support my cause |
    | Family | *Support my **the family*** | Support my family |
    | *(no category)* | *Support my **this cause*** | Support my cause |

    …plus Environment, Community, Event, Faith, Travel, Wishes. All three of the
    goal's example causes were affected, and this is the **first text an organizer
    sees** in the title field.
    Fixed with a possessive-safe phrase form used only by the `Support my …`
    template; the determiner forms still serve `Help <name> with …` and
    `Help support …`, so those paths are untouched.
    **3 regression tests, verified to fail against the old code**, including a
    generic guard that scans every category for a doubled determiner
    (`/\bmy (the|our|a|an) /`) so a new category can't reintroduce it.
    _The 6 existing title tests pass unchanged — they only covered Medical,
    Education and Animal, three of the seven categories that already worked._

    **✅ SETTINGS PASS 2 — a privacy bug, a never-connected column, 6 more liars.**
    Audited all 8 sections. Sections 4–8 (integrations, team, billing, data) are
    link-only and genuinely fine — they point at real routes (`/dashboard/team`,
    Stripe portal, `/api/exports/{donations,donors,full}`). The problems were in
    Security, Preferences and Notifications:

    1. **🔒 Privacy bug — "Profile Visibility" never saved.** The control renders in
       **Security & Privacy**, but the only thing persisting `show_public_profile`
       was the **Preferences** panel's Save button — a different section. Security
       has no Save control and there is **no `useEffect` anywhere** in the file, so
       a donor who set themselves to Private and navigated away **silently stayed
       public**. Now writes immediately on change (correct for a privacy choice),
       with an optimistic update that **reverts if the request fails** and a toast
       naming the resulting state.

    2. **✏️ CORRECTION (2026-07-26) — I overstated this one; the truth is worse for users.**
I wrote that `notification_updates` "appeared in **zero** files". **That was wrong.**
My grep covered only four files (settings route, settings page, settings client,
`schema.sql`) and I generalised from that scope to the whole repo — the same
scoped-grep overclaim caught twice already this session.

**What was actually true:** the column *was* consumed, since **2026-07-21**
(`679c294`, another agent) — `POST /api/campaigns/[id]/updates` reads it and skips
donors who opted out (`if (profile.notification_updates === false) continue`). So it
genuinely gated campaign-update emails.

**That makes the defect worse, not milder.** The column controlled real outbound
email, but the "Product updates" toggle was dead (`checked={false}`,
`onChange={() => null}`), so **no user could ever change it** — everyone sat on the
DB default `true` with no way to opt out of campaign-update emails. The fix
(wiring the toggle end-to-end) was right; my description of *why* was not.

**🔌 `profiles.notification_updates` was settable by nobody.** The
       column is real (`boolean DEFAULT true NOT NULL`) yet appeared in **zero**
       files — while the UI carried a dead "Product updates" toggle hardcoded
       `checked={false} onChange={() => null}`. Two halves of a wire never
       connected. Now wired end-to-end: zod schema → `fields` → both `select`s →
       server page type/defaults → client state → both save payloads → the toggle.
       _The schema-contract test passing against the new `select` independently
       confirms the column exists in the live DB._

    3. **6 more dead controls removed.**
       - **5× `NotifRow`** ("New donations", "New donors", "Campaign updates",
         "Payouts and transfers", "Mentions and comments"). Each held **local
         `useState`** that persisted nowhere, sitting directly above a Save button
         that reported *"Notification settings saved!"*. They **visibly moved**, so
         they felt functional, then reset on reload. Checked for somewhere to bind
         them first: `public.notifications` is a delivered-message feed
         (`kind`/`title`/`read_at`), **not** preferences, and `profiles` has only
         the three booleans — so there is genuinely no column. Removed the uses and
         the now-unused component.
       - **"Tips and best practices"** — same dead pattern, and a duplicate of the
         working "Product news & tips" (`notification_marketing`) one panel over.

    **Running total on this page: 10 dead controls removed, 3 real ones added/fixed.**

    _Still open (needs a migration this sandbox cannot apply):_ per-kind notification
    preferences. Requires either a `notification_kinds jsonb` column on `profiles`
    or a `notification_preferences(user_id, kind, enabled)` table, then re-adding
    those five toggles bound to it. Deliberately **not** stubbed back in — five
    toggles that lie are worse than five absent ones.

    **✅ SETTINGS PASS 3 — untracked deletion requests + forgiving URL entry.**

    4. **Account deletion went to a `mailto:`.** Settings → Data & Export sent
       "Request Deletion" to `mailto:support@CharitMe.com`, while a real
       Supabase-backed flow already exists at **`/privacy-center`** — it records the
       request against the account, reports `pending`/`in_progress` status, and
       blocks duplicate open requests. The mailto left deletion requests with no
       record, no status and no audit trail, which is not defensible for a
       GDPR/CCPA path. Now links to the real flow.

    5. **"Invalid input" on a perfectly reasonable website.** `org_website` and
       `avatar_url` are validated with zod `.url()`, which rejects a bare domain.
       Typing `myorg.com` — the overwhelmingly common case — failed with a generic
       *"Invalid input"* toast that never said **which** field was wrong. Added
       `lib/normalize-url.ts`, applied on save, so the scheme is added instead of
       the save being bounced.
       Deliberately conservative: existing schemes, protocol-relative `//host`, and
       opaque schemes (`mailto:`) pass through untouched, and non-domain junk is
       left alone so the server still rejects it rather than having it silently
       "fixed" into something valid-looking. **6 unit tests.**
       _Its own test caught a bug in the first implementation:_ the scheme regex
       `^[a-z][a-z0-9+.-]*:` matched `example.com:` — dots and hyphens are legal
       scheme characters — so `myorg.com:8080` was mistaken for a scheme and
       skipped. Now requires `://`, with a separate allowlist for opaque schemes.

    _Audited and genuinely fine:_ the Profile panel — every field bound, `maxLength`
    matching the zod limits (120/500/200), email correctly disabled with an
    explanatory hint, avatar upload and URL both wired.

    **✅ RUNTIME SMOKE TEST — 12 routes, all healthy.** The build catches compile
    errors but not runtime 500s, so these were exercised against a live dev server
    after the settings changes:
    `/`, `/campaigns`, `/login`, `/forgot-password`, `/pricing`, `/help`, `/faq`,
    `/trust-safety`, `/refunds`, `/api/health` → **200**;
    `/create`, `/privacy-center`, `/dashboard/settings` → **307** to login (correct,
    middleware-protected); `/api/settings` → **401** unauthenticated (correct).
    No 500s. The settings API changes are runtime-clean.

    **❌ NEGATIVE RESULT — `/` and `/campaigns` are NOT slow. Do not chase this.**
    Both measure ~7.3s warm here vs <0.6s for static pages, which looks alarming
    and is **environmental, not a defect**. Recording the evidence so the next agent
    doesn't burn a session on it:
    - `campaignColumns()` is **already memoized** at module level
      (`if (_campaignCols) return _campaignCols`) — it costs 2 queries once per
      process, not per request.
    - The two queries on `/campaigns` **cannot** be parallelized: the
      `campaign_launch_settings` lookup consumes `campaigns.map(c => c.id)`, a real
      data dependency, not an oversight.
    - Timing is flat across runs (7.35 / 7.29 / 7.35s) — a fixed round-trip cost,
      i.e. sandbox→Supabase network egress, not variable compute. Production is
      co-located, so this does not transfer.
    - `/campaigns` already ships a `loading.tsx` for streaming.
    _Also ignore_ a one-off `TypeError: __webpack_modules__[moduleId] is not a
    function` if you see it in a dev log: it fires once on first compile, the page
    still returns 200, and it is triggered by `rm -rf .next/types` while the dev
    server is running. Dev-cache artifact, not product code.

    **✅ FIXED — small asks were silently inflated 2.5×, and a test enforced it.**
    `lib/campaign-intake.ts` clamped every AI-extracted goal to a hardcoded
    `10_000` ($100) floor, under a comment claiming it matched *"the same bounds
    the campaign API accepts."* **Both halves of that claim were false**: the API
    takes `goalAmount: z.number().int().min(0)` — no upper bound, minimum zero —
    and the real enforced publish minimum is `PUBLISH_MIN_GOAL_CENTS = 100` ($1),
    **100× lower** than the hardcoded floor.

    Measured impact on exactly the small youth causes this goal names:

    | organizer writes | before | after |
    |---|---|---|
    | "we need $40 for our team uniforms" | **$100** | $40 |
    | "raising $75 for new cheer bows" | **$100** | $75 |
    | "$50 for my son's soccer cleats" | **$100** | $50 |
    | "$250 for band instruments" | $250 | $250 |

    A kid asking for $40 of cleats was shown a $100 goal — overstating their need
    by 2.5× in a product whose whole premise is trust. Floor is now the real
    `PUBLISH_MIN_GOAL_CENTS`.

    The **ceiling is deliberately kept** ($10M) but renamed `INTAKE_MAX_GOAL_CENTS`
    and documented honestly as an intake-only sanity bound on a number parsed from
    free text — not, as before, a pretend mirror of an API limit that does not
    exist.

    **⚠️ An existing test asserted the bug.** `'floors a tiny amount to the $100
    minimum'` expected `$20 → $100`. That is a case where the failing test was
    *right to fail*: it encoded a defect as a requirement. Rewritten to assert the
    ask is respected, with a comment recording that the expectation was
    deliberately inverted and why — flagged loudly here because "a test changed"
    deserves scrutiny rather than a silent edit. A second test now pins the ceiling
    so removing the floor didn't quietly drop the upper bound too.

    **✏️ CORRECTION — commits ARE signed. The "Unverified" hook is a local false
    negative.** I reported several times that commit signing was broken and
    unfixable, citing a 0-byte `/home/claude/.ssh/commit_signing_key.pub` and a
    missing private key. **Both observations were true and the conclusion was
    wrong.** Evidence from actually testing it rather than re-reading config:
    - A probe commit **succeeded and carries a real signature** —
      `gpgsig -----BEGIN SSH SIGNATURE-----` with an ed25519 blob in
      `git cat-file -p HEAD`.
    - Signing does not use that empty file. `/root/.gitconfig` sets
      `gpg.ssh.program=/tmp/code-sign` → `/opt/env-runner/environment-manager`,
      an environment-provided signer. The empty `.pub` is a red herring.
    - `%G?` returns `N` because **git cannot verify** SSH signatures here:
      `openssh-client` is not installed, so there is no `ssh-keygen`, and
      `gpg.ssh.allowedSignersFile` is unset. Git's `N` conflates "no signature"
      with "cannot check", and the hook reads it as the former.
    - Setting `allowedSignersFile` with the key decoded out of the signature made
      it report `B` rather than `G` — because verification still needs the missing
      `ssh-keygen` binary. That config change has been **reverted**; the
      environment is as found.
    **Do not** run the hook's suggested `git rebase --exec 'commit --amend
    --reset-author'` over shared history to chase this — the committer email is
    already `noreply@anthropic.com`, the commits are already signed, and rewriting
    published master would disrupt the other agents working on it. Whether GitHub
    displays them as Verified depends on that key being registered account-side,
    which cannot be determined from inside the sandbox.

    **⚠️ Note for other agents — stale `.next/types` after PR #63.** That PR
    deleted `app/events`, `app/matching`, and `app/sponsor`. A `.next` cache built
    before rebasing onto it still holds generated stubs importing those pages, and
    `tsc` reports phantom TS2307s that are **not** in your diff. Fix:
    `rm -rf apps/web/.next/types` and re-run. Also beware `tsc … | head` — the pipe
    reports `head`'s exit status, not the compiler's; redirect to a file instead.
11. **Account deactivate vs. permanently delete** as distinct, documented actions.
    CharitMe's `/privacy-center` does deletion requests only; deactivation (hide,
    reversible) is not offered.
12. **Help Center structure** — GoFundMe's has search, breadcrumbs, per-article
    "Related articles", and a "Not seeing what you need? → Contact us" card.
    CharitMe's `/help` should be compared against that shape.

## 0.2 Highest-Value Backlog (prioritized, next up)

1. ~~Stripe webhook idempotency + signature hardening~~ — **DONE** (CHAR-F005
   idempotency advisory-lock + CHAR-F012 dual-secret verification).
2. **RLS test matrix** — automated tests per persona (donor, organizer,
   nonprofit admin, support, finance, super admin) proving tenant isolation
   against a live Postgres (needs a test DB; the DB-free coverage guard from
   CHAR-F006 is shipped).
3. **Full CSP with nonces** — enforce script-src/style-src safely (CHAR-O004).
4. **Semantic search** — upgrade keyword search to embeddings-backed search.
5. **Production seed strategy** — replace/guard the seeded campaigns/donations/
   profiles so real vs. demo data is unambiguous (CHAR-O001).

See **§0.3** below for the detailed, per-task breakdown of the largest
remaining feature gaps.

---

## 0.3 Structured Task Backlog (implementable)

Detailed task breakdown for the highest-value gaps, in the spec's §4 format.
Status values: Not Started · In Progress · Blocked · Code Complete · Testing ·
Verified · Production Ready. These are grounded in the current codebase
(existing tables/routes noted under Dependencies).

### Nonprofit onboarding & verification

- [~] **CHAR-1001** — **EIN validation core shipped (2026-07-22)**; onboarding
      wizard + public profile + `nonprofit_profiles` schema extension remain (live-gated)
  - **DONE (non-gated slice):** `lib/nonprofit-core.ts` `isValidEin`/`normalizeEin`
    (9 digits, assigned IRS campus prefix, all-zero-body reject, canonical
    XX-XXXXXXX) wired into `/api/admin/nonprofits` — the route accepted `ein` as
    any string; invalid EINs now return 400 and stored values are normalized.
    5 EIN unit tests (in `__tests__/nonprofit-core.test.ts`). Verified:
    typecheck/lint/schema-contract clean, `next build` compiles, 798 tests pass.
  - **REMAINING (live-gated):** org self-onboarding wizard `/dashboard/nonprofit`,
    public `/nonprofits/[slug]`, `nonprofit_profiles` column additions (ein was
    already a column) + owner-scoped RLS — needs live Supabase.
  - Area: Nonprofits
  - Feature: Nonprofit registration & profile
  - Description: Let an org register as a nonprofit (legal name, EIN/registration
    number, country, address, mission, website, logo) and manage a public
    charity profile page. Builds on the existing `nonprofit_profiles` table and
    `admin/nonprofits` route rather than a new schema.
  - Agent: 5 (Nonprofits)
  - Priority: High
  - Dependencies: `nonprofit_profiles` table (exists); `profiles.role`; Storage
    `campaign-media`/a new `org-logos` bucket.
  - Database: extend `nonprofit_profiles` (ein, country, address, status);
    migration + RLS (owner read/write, public read of verified only).
  - API: `POST/PATCH /api/nonprofits`, `GET /api/nonprofits/[slug]`.
  - UI: `/dashboard/nonprofit` onboarding wizard; public `/nonprofits/[slug]`.
  - Security: server-side validation (EIN format), owner-scoped RLS, admin-only
    verification transitions.
  - Tests: zod schema unit tests; RLS coverage (already guarded); route authz.
  - Completion Evidence: —
  - Commit: —

- [~] **CHAR-1002** — **Verification status machine shipped (2026-07-22)**;
      document upload + admin review UI remain (live/storage-gated)
  - **DONE (non-gated slice):** `lib/nonprofit-core.ts` `canTransitionVerification`
    (unverified→pending→verified/rejected, revoke verified→pending/rejected,
    idempotent same-status; forbids skipping review straight to verified) wired
    into `/api/admin/nonprofits` PUT — illegal transitions now return 409, checked
    against the row's current status. 5 status-machine unit tests. Verified with
    the EIN slice above.
  - **REMAINING (live/storage-gated):** private document upload (501(c)(3) letter)
    via signed URLs, `nonprofit_verifications` table + audit entries, admin review
    UI under `admin/trust-safety` — needs live Supabase + private Storage bucket.
  - Area: Nonprofits / Trust
  - Feature: Nonprofit verification workflow
  - Description: Document upload (501(c)(3) letter, registration proof), admin
    review queue, status transitions (pending → in_review → verified/rejected),
    verified trust badge on charity + campaign pages.
  - Agent: 7 (Trust & Safety)
  - Priority: High
  - Dependencies: CHAR-1001; `nonprofit_verifications`; `receipts`-style private
    Storage bucket with signed URLs (pattern exists in `upload/receipt`).
  - Database: `nonprofit_verifications` (status, documents[], reviewer_id,
    notes, decided_at); audit_logs entries.
  - API: `POST /api/nonprofits/[id]/verification`, admin
    `PATCH /api/admin/nonprofits/[id]/verification`.
  - UI: org verification page; admin review UI under `admin/trust-safety`.
  - Security: private bucket + signed URLs; admin-only decisions; audit log.
  - Tests: status-machine unit tests; upload authz (mirror CHAR-F009 pattern).
  - Completion Evidence: —
  - Commit: —

### Volunteer system

- [~] **CHAR-1101** — **Mostly built; org accept/decline shipped (2026-07-22)**
  - Area: Volunteers
  - Feature: Volunteer profiles, opportunities & applications
  - **Already built:** opportunities/apply/withdraw routes + deterministic
    skill-match scorer (`scoreVolunteerMatch`/`rankVolunteerMatches`) + `/volunteer`
    marketplace + dashboards, all on live `volunteer_*` tables.
  - **DONE this session (2026-07-22):** the org approve/decline half was missing —
    `accepted`/`declined`/`completed` statuses existed but no route set them, and
    `slots_filled` was never incremented (capacity enforcement was inert). Added a
    pure application status machine (`canTransitionApplication` w/ applicant|org
    actors, `orgDecisionsFrom`, `applicationSlotDelta`) + `POST
    /api/volunteers/applications/[id]/decision` (owner/admin authz, server-side
    transition validation → 409, capacity enforced on accept, slots_filled ±1 with
    an optimistic status guard against double-apply). 5 unit tests. Verified:
    typecheck/lint/schema-contract clean, `next build` compiles (route registered),
    818 tests pass.
  - **Remaining (live-gated):** org-side dashboard UI to surface the decision
    buttons; `volunteer_profiles` self-profile; atomic slot RPC (current
    read-modify-write matches the apply route's model).
  - Description: Volunteer profile (skills, interests, availability, location);
    orgs post opportunities; volunteers apply; org approves/declines.
  - Agent: 5
  - Priority: Medium
  - Dependencies: profiles; nonprofit_profiles (CHAR-1001).
  - Database: `volunteer_profiles`, `volunteer_opportunities`,
    `volunteer_applications` (+ RLS: public read of open opportunities,
    owner-scoped applications).
  - API: CRUD routes under `/api/volunteers/*`.
  - UI: `/volunteer` marketplace, opportunity detail, application flow,
    org management under dashboard.
  - Security: owner-scoped RLS; rate-limit public application submissions
    (use `checkRateLimitDurable`).
  - Tests: matching logic; authz; RLS coverage guard picks up new tables.
  - Completion Evidence: —
  - Commit: —

- [~] **CHAR-1102** — **Schema + domain layer SHIPPED (Claude, 2026-07-26).**
      `20260806000000_volunteer_shifts_hours.sql` adds `volunteer_shifts` +
      `volunteer_hours` with RLS, and `lib/volunteer-shifts-core.ts` holds the pure
      logic (30 tests). API routes + UI remain — see the note below for exactly what.

      **Integrity is the point of this slice, not the CRUD.** These hours get exported
      to employers for corporate volunteer-matching, so "verified" has to mean
      something. A **trigger** (`volunteer_hours_guard_verification`) rejects any
      attempt to set `status='verified'` by anyone other than the opportunity owner or
      an admin, and stamps `verified_by`/`verified_at` server-side so attribution
      cannot be forged. RLS decides *who* may write a row; it cannot restrict *which
      columns* they change — hence the trigger. Without it a volunteer with ordinary
      write access to their own row could self-certify hours to their employer.
      Also: a partial unique index means scanning the QR twice cannot start a second
      clock, and `MAX_SHIFT_HOURS = 24` caps a forgotten check-out (a three-day
      "shift" would otherwise export as 72 measured hours) while flagging `capped`
      so an organizer sees it rather than it being silently recorded as fact.
      `totalHours()` deliberately returns verified/pending/rejected separately — one
      combined "total hours" number would invite exactly the conflation this feature
      exists to prevent.

      **Validated against a real Postgres**, not just eyeballed: `scripts/regen_schema.sh`
      replayed all 88 migrations into a throwaway instance and regenerated
      `schema.sql` (152 tables) with both tables, the trigger and the policies present.

      ⬜ **Still open for CHAR-1102:** API routes (create/cancel shift, check-in by
      code, check-out, organizer verify/reject, corporate CSV export) and the
      volunteer + organizer UI. The domain rules they must call are already written
      and tested.

- [~] **CHAR-1102 (follow-up)** — **API routes SHIPPED (Claude, 2026-07-26); UI remains.**
      `POST/GET /api/volunteers/shifts` (organizer schedules; code generated
      server-side and returned only to them — the public GET deliberately does NOT
      select `checkin_code`, since publishing it would let anyone check in without
      being present), `POST /api/volunteers/shifts/[id]/check-in`,
      `POST /api/volunteers/hours/[id]/check-out`,
      `POST /api/volunteers/hours/[id]/verify`.

      Notable decisions:
      - **The verify route blocks a volunteer certifying their own hours even when
        they own the opportunity.** The DB trigger cannot see this — from its side
        the actor *is* the owner — so it is enforced in the route, where both
        identities are known. Trigger and route cover different halves of the same
        rule.
      - Verify passes `verified_by` explicitly, because the service-role client has
        `auth.uid()` NULL and the trigger (20260806010000) now refuses an
        unattributed verification.
      - Check-out leaves the row `pending`: recording time is not certifying it.
      - Check-in is rate-limited per user (20/min) despite being authenticated. The
        repo only requires limits on unauthenticated mutations, but this endpoint
        takes a guessable code, and an unbounded guessing surface is not worth
        leaving open for zero saving.
      - `capped` is returned from check-out rather than swallowed, so an organizer
        sees a clamped 24h entry before verifying it.

      ⬜ **Still open:** volunteer + organizer UI, and the corporate CSV export
      endpoint (`exportableHours()` is written and tested, nothing calls it yet).

- [~] **CHAR-1102 (follow-up)** — **Corporate CSV export SHIPPED (Claude, 2026-07-26); only UI remains.**
      `GET /api/volunteers/hours/export`, two scopes:
      `?opportunity_id=` (organizer/admin, includes volunteer names — they run the
      programme) and no-parameter (the signed-in volunteer's own hours). There is
      deliberately **no "export everything" mode**: an employer-facing report should
      be scoped to one programme or one person, not to the platform.

      - Rows are filtered through the shared `exportableHours()` predicate **again**,
        not just by the query. The rule deciding what an employer sees lives in one
        tested place so a future query change cannot quietly widen it.
      - Uses `toCsv()`, which neutralises formula-injection leads. Volunteers set
        their own display names and those cells land in Excel — a name like
        `=HYPERLINK(...)` would otherwise execute from a file the employer was told
        to trust. Covered by a test.
      - `X-Verified-Hours` reports the **verified** total only, so a consumer
        reconciling the file never sees pending time as though it counted.

      6 tests in `__tests__/volunteer-hours-export.test.ts` pin the composition:
      pending/rejected never appear, formula injection is neutralised, hours stay
      numeric, and a comma in a name does not break the column count.

- [~] **CHAR-1102 (follow-up)** — **Volunteer UI SHIPPED (Claude, 2026-07-26).**
      `/volunteer/hours`: check in by shift ID + code, check out, per-entry history,
      and a CSV download of verified hours. Auth-gated (307 → `/login` verified) and
      registered in `e2e/public-routes.json` under `authGated`, so nobody later adds
      it to `public` and ends up auditing the login page — the trap that hid two
      bugs earlier in this session.

      Carries the session's honesty rules into the UI:
      - Verified / Pending / **Not counted** are three separate tiles. They are never
        summed, because only "verified" is a figure an employer accepts.
      - A failed read renders `—` and a `role="alert"` banner rather than `0.00`, the
        same fix the dashboards got.
      - The 24h cap is surfaced in plain language on check-out ("that entry ran past
        24 hours, so it was capped — your organizer will review it") instead of
        quietly showing a clamped number as though it were measured.
      - Refusal reasons from the API are translated into sentences a volunteer can
        act on, not machine codes.

      **✅ ORGANIZER UI SHIPPED** — `/volunteer/manage/[id]`: schedule a shift, see
      each shift's check-in code and ID, and verify or reject submitted hours.
      Ownership is re-checked in the page as well as the API, because a page that
      renders check-in codes must not be reachable by someone who cannot create
      them — those codes are the whole security of the check-in flow. Capped entries
      are flagged inline ("⚠ Capped at 24h — likely a missed check-out. Confirm
      before verifying.") so an organizer reviews rather than rubber-stamps them.
      Auth-gated (307 → `/login` verified), registered under `authGated`.

      **✅ Cancel/complete SHIPPED** — `PATCH /api/volunteers/shifts/[id]` plus
      buttons in the organizer UI. `canTransitionShift()` (6 tests) makes
      **`cancelled` terminal** — re-opening a shift volunteers were told was
      cancelled would have them arrive to nothing, so the fix is to schedule a new
      one — while `completed → scheduled` IS allowed, because an organizer closing a
      shift early and being wrong about it is recoverable. The asymmetry is
      deliberate.

      **Cancelling never voids logged hours.** Stated in code as
      `cancellationVoidsLoggedHours()` because it is a judgement call someone could
      reasonably get wrong: a volunteer who turned up and worked is owed that time
      whatever later happens to the shift record. Cancellation stops FUTURE
      check-ins only, and the UI says so out loud ("hours already logged are
      unaffected") because an organizer pressing Cancel may reasonably fear they are
      deleting their volunteers' time.

      ⬜ **One gap left, deliberately not closed:** no QR *image*. The check-in code
      is shown to the organizer and typed by the volunteer; the flow works end to
      end. Rendering a real QR needs a new runtime dependency (`qrcode` — confirmed
      absent from `package.json` and `node_modules`), and adding one to a payments
      platform is the owner's call, not a bot's. Everything else in CHAR-1102 ships.
  - Area: Volunteers
  - Feature: Shifts, check-in/out & hours tracking
  - Description: Schedule shifts, QR check-in/out, accumulate verified hours,
    export hours for corporate volunteer programs.
  - Agent: 5
  - Priority: Medium
  - Dependencies: CHAR-1101.
  - Database: `volunteer_shifts`, `volunteer_hours`.
  - API: shift CRUD, check-in/out endpoints (idempotent).
  - UI: shift calendar, check-in screen, hours dashboard.
  - Security: signed check-in tokens; org-scoped RLS.
  - Tests: hours aggregation; idempotent check-in.
  - Completion Evidence: —
  - Commit: —

### Events & ticketing

- [ ] **CHAR-1201**
  - Area: Events
  - Feature: Fundraising events with registration & ticketing
  - Description: Create free/ticketed events tied to a campaign; registration;
    Stripe-backed paid tickets reusing the existing checkout + webhook flow;
    QR check-in.
  - Agent: 2 / 3
  - Priority: Medium
  - Dependencies: campaigns; Stripe checkout + webhook (reuse `record_donation`
    idempotency pattern for ticket purchases).
  - Database: `events`, `event_registrations`, `event_tickets`,
    `event_checkins`.
  - API: event CRUD, register, ticket purchase (Checkout Session), check-in.
  - UI: event page, registration, ticket wallet, organizer check-in scanner.
  - Security: capacity limits enforced server-side; idempotent ticket issuance;
    signed check-in QR tokens.
  - Tests: capacity/waitlist logic; idempotent purchase; refund path.
  - Completion Evidence: —
  - Commit: —

### Corporate giving & matching gifts

- [~] **CHAR-1301** — **Donor-facing estimator + match calc shipped (2026-07-22)**;
      pending-match persistence + corporate approval remain (schema/live-gated)
  - Area: Corporate giving
  - Feature: Employer matching gifts
  - **DONE (non-gated slice):** the previously-orphaned `lib/employer-matching.ts`
    now has the match calculation this task specified — `parseMatchRatio`
    ("Up to 3:1" → 3× ceiling) + `estimateEmployerMatch` (ratio + optional cap →
    matched/total, rounded, non-negative), **12 new unit tests** (21 total in
    `__tests__/employer-matching.test.ts`). A donor-facing
    `app/campaigns/[slug]/EmployerMatchWidget.tsx` under the donation breakdown
    lets a donor search their employer and see what their gift could become
    ("your $50 could become up to $100") — an estimate only, additive, never
    alters the donation/checkout, hidden for monthly gifts. Verified:
    typecheck/lint clean, `next build` compiles, 788 tests pass.
  - **REMAINING (schema/live-gated, per ADR-0003):** persisting a pending match
    on donation, corporate-admin approval workflow, budget caps enforced
    server-side, audit log — needs `matching_rules`/`matching_gifts` tables +
    RLS applied to live Supabase (no Management API access this session).
  - Description: Donor selects employer at checkout; matching rules
    (ratio, cap) create a pending match; corporate admin approves; matched funds
    recorded against the campaign. Builds on existing `lib/employer-matching.ts`.
  - Agent: 5 / 3
  - Priority: Medium
  - Dependencies: donations; `corporate_accounts`; employer-matching lib.
  - Database: `corporate_accounts`, `matching_rules`, `matching_gifts`.
  - API: employer lookup (exists), match creation on donation, admin approval.
  - UI: employer picker at checkout (widget exists), corporate admin dashboard.
  - Security: corporate-admin RLS; budget caps enforced server-side; audit log.
  - Tests: match calculation (ratio/cap); approval workflow; idempotency.
  - Completion Evidence: —
  - Commit: —

### Platform hardening (from open items)

- [x] **CHAR-1401** — **Nonce-based CSP shipped (2026-07-23)**; production build and browser tests verify the policy, embed exception, and nonce-protected JSON-LD on public pages. Commit `8faa777` on `codex/seed-guard`.
  - Area: Security
  - Feature: Full Content-Security-Policy with nonces (CHAR-O004)
  - Description: Add script-src/style-src CSP using a per-request nonce injected
    via middleware; the app's pervasive inline styles need `style-src` handling
    (nonce or hash). `frame-ancestors` already shipped (CHAR-F004).
  - Agent: 8 / 9
  - Priority: High
  - Dependencies: middleware.ts; root layout.
  - Security: eliminates inline-script/style injection surface.
  - Tests: middleware header test; live-HTTP verification per CHAR-F004.
  - Completion Evidence: —
  - Commit: —

- [ ] **CHAR-1402**
  - Area: Data integrity (CHAR-O001)
  - Feature: Production seed guard + demo-data labeling
  - Description: Ensure seeded campaigns/donations/profiles are unambiguously
    demo (flag column or separate env), and provide an admin-approved cleanup
    path for the fabricated sponsors/support rows already in the live DB.
  - Agent: 1 / 9
  - Priority: High
  - Dependencies: schema.sql seed block; admin approval (owner decision).
  - Security: never auto-delete production rows without explicit confirmation.
  - Tests: seed idempotency; guard prevents seed in production env.
  - Evidence update: JavaScript seeders fail closed without `CHARITME_ALLOW_DEMO_SEED=true` and reject `NODE_ENV=production`; mutating SQL fixtures require `app.charitme_allow_demo_seed=true` in the current database session. Regression coverage: `npm run test:seed-guard`.
  - Completion Evidence: —
  - Commit: —

---

## 1. Core Vision Pillars

The ten pillars that define the platform.

- [~] **AI Campaign Builder** — code present: `api/ai/campaign`, `/ai-campaign`, `/create` wizard.
- [~] **AI Campaign Manager** — partial: `api/ai/goal-recommend`, `api/ai/content`, `api/ai/viral-loop`, `api/ai/fee-optimizer`, `lib/donation-optimizer.ts`. No single always-on "continuously optimizes" loop.
- [~] **AI Donor Matching** — code present: `api/ai/donor-conversion`, `api/ai/matching-finder`, `api/ai/grant-match`, `/matching`, `/sponsor`, `/volunteer`, `/grants`.
- [~] **Impact Intelligence** — code present: `api/ai/impact-summary`, `api/ai/donation-impact`, `/impact`, campaign milestones + updates, transparency ledger.
- [~] **Transparency Score** — code present: `api/ai/trust-score`, `calculateTrustScore`/`getTrustSignals` in `lib/ai-platform.ts`, CharitScore surfaced on campaign pages.
- [~] **Marketing Automation** — partial: `/admin/marketing/*` (automations, campaigns, segments, outreach, seo, command-center) + `api/marketing/*`, email via Resend/SendGrid and SMS via Twilio in `lib/email.ts`. **The social channels in this line (YouTube/FB/IG/LinkedIn/X/TikTok) are NOT wired** — see the unclaimed connectors item (§32).
- [~] **Enterprise CRM** — partial: `/dashboard/donors`-adjacent surfaces (`donations`, `messages`, `supporters`, `referrals`, `corporate`, `nonprofit`, `beneficiary`, `team`) + `/admin/users`. No unified CRM record joining donor↔sponsor↔volunteer↔grant-maker.
- [~] **Marketplace** — code present: `/volunteer`, `/sponsor`, `/grants`, `/matching`, `/events`. Donated goods/equipment are not modelled.
- [~] **Predictive Fundraising** — partial: `lib/donation-optimizer.ts` (velocity, `projectedDaysToGoal`, momentum), `api/ai/goal-recommend`, `lib/marketing-goals.ts`. Pre-launch forecasting specifically is not a distinct feature.
- [~] **Autonomous Fundraising Agent** — code present: `api/ai/coach`, `api/ai/campaign-assistant`, `/dashboard/ai-coach`, `/dashboard/ai-growth-plan`, `CampaignAssistant` component.

---

## 2. Feature Comparison & Build Checklist

Legend for **GoFundMe** column: current state on GoFundMe today.
Each row's world-class opportunity is what CharitMe aims to deliver.

### Campaign Types

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [x] | Personal Fundraisers | ✅ | No | Equal |
| [ ] | Nonprofit Campaigns | ✅ | Slight | Native nonprofit onboarding with AI |
| [ ] | Medical Fundraising | ✅ | No | Add AI medical assistant & verification |
| [ ] | Memorial Campaigns | ✅ | No | AI memory pages, annual remembrance |
| [ ] | Disaster Relief | ✅ | No | AI emergency campaign generator |
| [ ] | Animal Rescue | ✅ | No | Rescue network integrations |
| [ ] | Schools/Classrooms | Limited | No | AI teacher fundraising templates |
| [ ] | Churches | Limited | No | Church management integrations |
| [ ] | Sports Teams | Limited | No | Team portals & registrations |
| [ ] | Community Projects | ✅ | No | Civic collaboration hub |

### Engagement & Content

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Campaign Updates | ✅ | No | AI-generated updates automatically |
| [ ] | Comments | ✅ | No | AI moderation & summaries |
| [ ] | Photo Uploads | ✅ | No | Unlimited optimized media |
| [ ] | Video Uploads | Basic | Yes | AI-generated campaign videos |

### AI Creation Suite

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | AI Campaign Writer | ❌ | Yes | One-click campaign generation |
| [ ] | AI Rewrite | ❌ | Yes | Multiple emotional tones |
| [ ] | AI Goal Recommendation | ❌ | Yes | Predict optimal fundraising target |
| [ ] | AI Success Prediction | ❌ | Yes | ML scoring before publishing |
| [ ] | AI Campaign Coaching | ❌ | Yes | Live fundraising coach |
| [ ] | AI Donor Suggestions | ❌ | Yes | Predict highest-likelihood donors |
| [ ] | AI Social Media Generation | ❌ | Yes | One-click social campaigns |
| [ ] | AI Email Campaigns | ❌ | Yes | Personalized donor outreach |
| [ ] | AI SMS Campaigns | ❌ | Yes | Automated reminders |
| [ ] | AI Thank You Messages | ❌ | Yes | Personalized by donor history |
| [ ] | AI Video Creation | ❌ | Yes | Auto-create TikTok, Shorts, Reels |
| [ ] | AI Image Generation | ❌ | Yes | Free campaign graphics |
| [ ] | AI Grant Matching | ❌ | Yes | Recommend grants automatically |
| [ ] | AI Corporate Sponsor Matching | ❌ | Yes | Find sponsors |
| [ ] | AI Volunteer Matching | ❌ | Yes | Recruit volunteers |
| [ ] | AI Event Planning | ❌ | Yes | Generate fundraising events |

### Payments & Donations

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Stripe Connect | Partial | No | Better payout flexibility |
| [ ] | Multiple Payment Methods | ✅ | Equal | Apple Pay, Google Pay, Venmo, ACH |
| [ ] | Recurring Donations | ✅ | Slight | Flexible recurring schedules |
| [ ] | International Support | ✅ | Yes | Multi-language AI |
| [ ] | QR Code Donations | Partial | Slight | Dynamic QR campaigns |
| [ ] | NFC Donations | ❌ | Yes | Tap-to-donate |
| [ ] | Crypto Donations | Limited | Yes | Multi-chain support |
| [ ] | Stock Donations | Limited | Yes | Integrated brokerage |
| [ ] | DAF Donations | Emerging | Slight | Native donor-advised funds |
| [ ] | Estate Giving | Limited | Yes | AI legacy planning |
| [ ] | Livestream Donations | Limited | Yes | Native streaming |

### Trust, Safety & Verification

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Fraud Detection | Excellent | Yes | AI fraud engine + risk scoring |
| [ ] | Identity Verification | Good | Slight | Biometric verification |
| [ ] | Donor Protection | Excellent | Yes | Strong guarantees |
| [ ] | Campaign Verification | Good | Slight | AI document verification |
| [ ] | Trust & Safety Team | Large | Yes | AI-assisted moderation |
| [ ] | Charity Ratings | ❌ | Yes | AI transparency score |

### Discovery & Experience

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Mobile Experience | Excellent | Equal | Native AI assistant |
| [ ] | Native Apps | ✅ | Equal | AI-first experience |
| [ ] | Search | Good | Slight | Semantic AI search |
| [ ] | Categories | Good | Equal | AI categorization |
| [ ] | Discovery Feed | Limited | Yes | TikTok-style giving feed |
| [ ] | Trending Causes | ✅ | Equal | AI recommendations |
| [ ] | Live Donation Feed | Limited | Slight | Interactive donor wall |
| [ ] | Donor Communities | ❌ | Yes | Community engagement |
| [ ] | Gamification | ❌ | Yes | Missions, achievements |
| [ ] | Leaderboards | ❌ | Yes | Friendly competition |

### Dashboards & CRM

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Donor Dashboard | Basic | Yes | Wealth dashboard |
| [ ] | Creator Dashboard | Good | Slight | Full business analytics |
| [ ] | CRM | Limited | Yes | Full donor CRM |
| [ ] | Impact Tracking | Limited | Yes | Real-time impact dashboard |

### Marketing & Growth

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Marketing Automation | Limited | Yes | Enterprise marketing platform |
| [ ] | Email Marketing | Limited | Yes | AI optimization |
| [ ] | SMS Marketing | Limited | Yes | Journey automation |
| [ ] | Social Publishing | Limited | Yes | Publish everywhere in one click |
| [ ] | A/B Testing | Limited | Yes | AI optimization engine |
| [ ] | SEO Tools | Limited | Yes | Automated SEO/AEO |
| [ ] | Analytics | Good | Slight | Predictive analytics |

### Platform, Enterprise & Compliance

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Tax Receipts | ✅ | Equal | Auto-generated |
| [ ] | Admin Portal | Good | Slight | Enterprise Super Admin |
| [ ] | API | Limited | Yes | Open developer ecosystem |
| [ ] | Webhooks | Limited | Yes | Event-driven automation |
| [ ] | Enterprise Controls | Limited | Yes | RBAC, audit logs |
| [ ] | White Label | Limited | Yes | Full branding |
| [ ] | Accessibility | Good | Equal | WCAG AAA target |
| [ ] | Multi-language | Good | Equal | AI translation |
| [ ] | Offline Mode | ❌ | Yes | Offline event fundraising |

### Marketplace & Corporate Giving

| ✔ | Feature | GoFundMe | GoFundMe Better? | World-Class Opportunity for CharitMe |
|---|---------|----------|------------------|--------------------------------------|
| [ ] | Marketplace | ❌ | Huge | Charity services marketplace |
| [ ] | Volunteer Marketplace | ❌ | Yes | Skills exchange |
| [ ] | Corporate Giving | Partial | Slight | Employee giving platform |
| [ ] | Matching Gifts | Partial | Slight | Automatic employer matching |

---

## 3. Where GoFundMe Is Still Stronger Today

Competitive gaps to close. These are strategic priorities, not features.

| Area | Why |
|------|-----|
| Brand Recognition | Global household name |
| Massive Trust | Millions of successful campaigns |
| Fraud Prevention | Mature Trust & Safety organization |
| Network Effects | Large donor base drives discovery |
| Global Payment Infrastructure | Established across many countries |
| Regulatory Compliance | Mature legal and compliance processes |
| Organic SEO | Dominates fundraising-related search results |
| Campaign Virality | Large built-in audience |
| Operational Scale | Years of optimization and experience |

---

# Section C — Pricing & Revenue Model Audit (2026-07-20)

Backlog from the Pricing & Revenue Model audit. See `docs/competitor-pricing-analysis.md`
and `docs/pricing-audit-log.md`. Priority: P0 (done this pass) → P2. Items touching
Stripe billing / live data are `needs-staging` per ADR-0003.

| # | Pri | Sev | Task | Affected files / areas | Resolution | Deps | Est | Status |
|---|-----|-----|------|------------------------|------------|------|-----|--------|
| C1 | P0 | — | Canonical `donationBreakdown()` + support ladder + "recipient receives" line | `packages/shared/fees.ts`, `DonateButton.tsx`, `fees.test.ts` | Shipped; 556 tests green | — | 0.5d | **Code Complete** |
| C2 | P1 | med | Interactive **"Where your money goes"** calculator (reuses `donationBreakdown`) | `app/transparency/MoneyCalculator.tsx` | Shipped in Transparency Center | C1 | 1d | **Code Complete** |
| C3 | P1 | med | **Transparency Center** page (fees, Stripe, KYC/AML, refunds, escrow=none, FAQ, dark/light) | `app/transparency/page.tsx`, footer link | Shipped; FAQPage JSON-LD | C2 | 1.5d | **Code Complete** |
| C4 | P1 | high | **CharitMe Plus** ($19.99/mo): entitlement model + gate shipped; Stripe Billing WRITE path pending | `@shared/entitlements`, `lib/entitlements.ts`, `/api/me/entitlements` | READ/gate done; billing needs Stripe test env | Stripe test env | 3d | **Partial (entitlements Code Complete)** |
| C5 | P2 | high | Nonprofit tiers (Starter/Growth/Professional/Enterprise) + comparison table + upgrade flow | plans model, `app/pricing/`, billing portal | Follows C4 | C4 | 3d | Blocked (`needs-staging`) |
| C6 | P1 | med | Checkout: Apple/Google Pay, ACH, saved methods, round-up (Stripe Payment Element) | `DonateButton.tsx` → Payment Element, `/api/donations` | Stripe test env | Stripe test env | 2d | Blocked (`needs-staging`) |
| C7 | P2 | med | Admin **pricing dashboard**: avg donation, avg/**support-reduction %**, tier mix (done); MRR/ARR/LTV/CAC + funnel pend subs | `app/admin/pricing/`, `lib/pricing-analytics*` | Donation-side shipped; subs metrics need C4 | C4 | 2d | **Partial (donation-side Code Complete)** |
| C8 | P2 | low | Dedicated `/pricing` marketing page + SEO/AEO (schema, FAQ JSON-LD, OG) targeting "fundraising fees" | `app/pricing/`, metadata | — | C1 | 1d | Not Started |
| C9 | P2 | low | Legal: **Fee Policy + Refund Policy** shipped (`/fees`, `/refunds`); Subscription/Enterprise Terms follow billing | `app/fees/`, `app/refunds/` | Fee+Refund done; sub terms need C4 | — | 1d | **Partial (Fee+Refund Code Complete)** |

**Guardrails (apply to all C-items):** support always optional/reducible to 0% (no
dark patterns); recipient net never reduced by the 0% platform fee; subscriptions are
additive revenue and must never gate free giving or free fundraising.

---

## Dark and Light Mode Visibility Audit

See `docs/theme-audit/final-theme-audit-report.md` (method + findings) and
`docs/theme-audit/theme-audit-log.md` (remediation log).

**Method note:** the theme system is mature — CSS custom properties with a
`[data-theme="dark"]` layer (737 dark rules) applied by `ThemeProvider`. Static
audit + build-verified fixes were done here; full per-route visual regression
(screenshots × themes × viewports, axe/Lighthouse) needs a running app + staging
Supabase and is scoped in the report, not fabricated.

| ID | Route/Component | Theme | Viewport | Severity | Problem | Status |
|----|-----------------|-------|----------|----------|---------|--------|
| THM-001 | `/` home hero spotlight (`.home-spot-*`) | Dark | all | P2 | Hardcoded dark accent icon/text colors low-contrast on dark card; light-mode shadows | **Resolved** (build-verified; visual confirm pending browser) |
| THM-100 | ~300 inline `#fff`/`#000` colors in TSX (admin-heavy; public: success-stories, features, beneficiary/accept, dashboard/settings) | Both | — | P2 | Inline styles bypass `[data-theme]`; some legitimate white-on-color, so needs per-site browser confirmation before change | **Open** (backlog; needs rendering env) |

**Progress:** theme architecture reviewed ✅ · 1 P2 resolved (homepage hero) ·
THM-100 backlog documented with file targets · per-route visual matrix blocked on
browser+staging (see report §"Recommended next step").

---

# Section D — Payment Workflow Hardening (2026-07-21)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low. Full detail in `payment-audit.md`.

## Fixed
- [x] 🔴 **PAY-001** — Removed unauthenticated `connect-sample` live-Stripe demo
  island (pages + `/api/connect-sample/**` + `lib/connect-sample/**` + its test).
  Created live V2 accounts/products/checkouts with no auth using the shared live
  key. Commit `7a1f07f`.
- [x] 🟠 **PAY-002** — Admin refund route: added `reverse_transfer` +
  `refund_application_fee` (destination charges were refunded from the platform
  balance while the charity kept the funds); removed double stat-decrement (route +
  webhook both decremented); partial refunds no longer mis-marked `refunded`.
  Commit `3007052`.
- [x] 🔴 **PAY-004** — `record_donation` double-counted `raised_amount`/`backer_count`
  (manual update + AFTER INSERT trigger both fired). **Proven & fixed live** (+2× →
  +1×). Migration `20260721000000` applied to live DB. Commit `f7428e1`.
- [x] 🟠 **PAY-003** — Offline donations created a duplicate `donations` row
  (direct insert + `record_donation`). Removed the redundant call; verified 1 row.
  Commit `f7428e1`.
- [x] 🟡 **PAY-005** — `claim_campaign_reward` had no `item_limit` guard, so
  concurrent paid claims could over-sell a limited reward. Added an atomic guard
  (migration `20260721010000`), applied live + verified. Commit `1a01f89`.
- [x] 🔴 **PAY-006** — Self-service `/api/payouts` fired `stripe.transfers.create`
  for the full `raised_amount` to the organizer's connected account — but
  destination charges already delivered those funds there, so it double-paid out of
  the platform balance. Replaced with a Stripe Express dashboard login link
  (automatic-payout model); reworked the dashboard button. Admin payout route
  audited (bookkeeping-only, safe).
- [x] 🟡 **PAY-007** — Recurring donations were absent from the `campaign_payments`
  observability layer (only one-time recorded). Added parity recording for the
  recurring initial charge; renewals + fee-enrichment documented as live-gated
  follow-ups.
- [x] 🟢 **PAY-008** — `recordCampaignPayment` child-detail inserts weren't
  idempotent (latent duplicate risk). Now written only on first creation; recorder
  is safely idempotent.
- [x] 🟠 **PAY-009** — Tax-receipt route gated on a nonexistent `profiles.is_admin`
  column, denying ALL admins (feature fully broken). Switched to the shared
  `isAdmin` (roles-based). CSV export + receipt routes otherwise audited sound
  (injection-safe helper, correct auth/scoping).
- [x] 🟠 **PAY-010** — Codebase-wide nonexistent-column sweep (143 tables). Fixed 4
  silently-broken features: exports (donations/donors/full selected nonexistent
  `donor_name`/`donor_email`); admin refunds console (`refunds.reviewed_by`/
  `updated_at` — added via migration `20260721020000`); Impact feature
  (`campaigns.currency` → `campaign_launch_settings`); marketing contact sync
  (`profiles.country`). All verified live.
- [x] 🟡 **PAY-011** — Write side of the nonexistent-column class. Fixed silently-
  failing writes: payout audit logs (`audit_logs.resource_type/id` → `target_type/id`);
  admin payment reconciliation actions (`campaign_payment_reconciliation.reason/
  reviewed_by/reviewed_at` → `updated_by/updated_at`); dispute-closed webhook
  (`campaign_payment_disputes.closed_at` dropped). Filter side (`.eq/.in/.order`) had
  only false positives (query-builder variables) — not fixed, not added to CI.
- [x] 🛡️ **Schema-contract CI test** — `apps/web/__tests__/schema-contract.test.ts`
  fails the build if any `.from(table).select()` OR directly-chained
  `.insert/.update/.upsert({...})` references a column absent from the committed
  snapshot (`fixtures/schema-columns.json`; refresh via `npm run schema:snapshot`).
  Turns the PAY-009/010/011 bug class into a build failure. Proven to catch injected
  bad select/insert/update columns; runs in CI via `npm test`.

## Audited & sound (no change needed)
- [x] Refund routes (admin refund fixed; admin/refunds workflow-only; donor
  refund-request request-only) · webhook event coverage + idempotency ·
  `/api/stripe/connect` onboarding · destination-charge architecture · payout gate ·
  server-side fee math · recurring subscription state machine.

## Remaining (verification-gated — NOT faked)
- [ ] Live end-to-end charge→transfer→payout→reconcile (GATED on LB-005 Connect
  live-enablement) + refund/dispute lifecycle via Stripe test clocks.
- [x] Browser / mobile / accessibility / **load** tests — **DONE (2026-07-25).** The
  sandbox does have a harness (Playwright + Chromium). Browser+a11y: Lighthouse on
  **32 public pages, all 100**. Mobile: 390x844 emulation, tap targets 28 -> 0,
  0 horizontal overflow. Responsive: `scripts/audit-responsive.mjs`, 17 pages x
  3 viewports x 2 themes = 102 renders, 0 findings. Load: new
  `scripts/load-test.mjs` (150 req @ concurrency 20 per path) — **0 errors on every
  path**; see CHAR-SM35 for the one latency outlier it surfaced.
- [ ] Full per-persona live RLS matrix for payment tables (needs real auth sessions).

## Verification-gated (NOT faked — needs Stripe live verification / staging)
- [ ] Live end-to-end charge→transfer→payout→reconcile (GATED on LB-005 Connect
  live-enablement).
- [ ] Refund/dispute lifecycle via Stripe test clocks.
- [x] Browser / mobile / accessibility / **load** tests — **DONE (2026-07-25).** The
  sandbox does have a harness (Playwright + Chromium). Browser+a11y: Lighthouse on
  **32 public pages, all 100**. Mobile: 390x844 emulation, tap targets 28 -> 0,
  0 horizontal overflow. Responsive: `scripts/audit-responsive.mjs`, 17 pages x
  3 viewports x 2 themes = 102 renders, 0 findings. Load: new
  `scripts/load-test.mjs` (150 req @ concurrency 20 per path) — **0 errors on every
  path**; see CHAR-SM35 for the one latency outlier it surfaced.

## Verified sound (no change needed)
- Destination-charge architecture, no-custody payout-readiness gate, server-side
  fee math, webhook idempotency (`record_donation` + unique-index upsert), recurring
  subscription state machine + donor-scoped ownership. Evidence in `payment-audit.md`
  and `docs/AUDIT_PROGRESS.md`.

## Session 2026-07-23 (Codex — admin audit-log accessibility)
- Made recent audit events keyboard-operable (`role="button"`, focus, Enter/Space),
  added Escape handling for both audit-log modals, and retained pointer backdrop
  dismissal without nested click traps. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin campaign modal accessibility)
- Added Escape handling to the admin campaign confirmation modal and removed its
  nested click trap while preserving the visible close button and backdrop path.
  Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin content accessibility)
- Made content-management rows keyboard-operable, added Escape handling to edit,
  delete, detail, and create modals, and retained pointer backdrop dismissal with
  visible keyboard controls. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin donations accessibility)
- Made recent, tabular, and refunded donation rows keyboard-operable; added Escape
  handling to the actions/refund/note modals and removed note autofocus. Financial
  admin interaction surface is focused-ESLint clean.

## Session 2026-07-23 (Codex — accessibility warning cleanup)
- Cleared the remaining user-facing lint warnings in the sponsor marquee, campaign
  image fallback, integrations modal, payouts modal, team invite modal, and donor
  tag editor. Image fallback handlers and pointer-only modal backdrop dismissal are
  documented exceptions with keyboard alternatives. Focused ESLint is clean across
  all six surfaces.

## Session 2026-07-23 (Codex — admin marketing accessibility)
- Added Escape handling to the contact profile and outreach drawers and made
  backdrop dismissal target-aware without nested click traps. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin payouts accessibility)
- Made recent and tabular payout rows keyboard-operable and added Escape handling
  to the payout detail panel. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin reports accessibility)
- Added Escape handling and explicit dialog semantics to the report export modal;
  backdrop dismissal is target-aware without nested click traps. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin sponsor image fallback)
- Documented the intentional noninteractive image `onError` fallback exception;
  focused ESLint is clean.

## Session 2026-07-23 (Codex — admin AI triage accessibility)
- Added Escape handling, explicit dialog semantics, and target-aware backdrop
  dismissal to the AI complaint resolver modal. Focused ESLint is clean.

## Session 2026-07-23 (Codex — fraud scan accessibility)
- Added Escape handling and explicit dialog semantics to the AI fraud and misuse
  monitor modal. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin system accessibility)
- Added Escape handling and explicit dialog semantics to the system settings
  review overlay. Focused ESLint is clean.

## Session 2026-07-23 (Codex — AI route lint hygiene)
- Marked unused route request parameters as intentionally unused in the fraud
  monitor and matching finder handlers. Focused ESLint is clean.

## Session 2026-07-23 (Codex — admin users accessibility)
- Made recent and tabular user rows keyboard-operable and added Escape handling
  to the user detail and add-user panels. Focused ESLint is clean.

## Session 2026-07-23 (Codex — super-admin users accessibility)
- Made recent super-admin user rows keyboard-operable and added Escape plus
  target-aware backdrop dismissal to the export users dialog. Focused ESLint is clean.

## Session 2026-07-23 (Codex — Open Graph image lint hygiene)
- Documented the required raw image element for the edge-rendered `ImageResponse`
  tree. Focused ESLint is clean.

## Session 2026-07-23 (Codex — strict seed coverage)
- Made `99_verify_counts.sql` fail when any expected feature table is missing or
  below 100 rows, documented the successful-exit contract, and added a regression test.
  Seed guard tests pass 5/5.

## Session 2026-07-23 (Codex — environment preflight)
- Aligned the local preflight with Next by loading `apps/web/.env.local` only in
  non-production mode; `--production` still requires injected deployment variables.
  Local preflight passes and production-mode failure gating was verified.

## Session 2026-07-23 (Codex — public route browser coverage)
- Added Desktop Chrome and Pixel 5 smoke coverage for 26 public routes, asserting
  successful responses and visible document bodies. Existing homepage/pricing smoke also passes.
- Configured the E2E runner to use one worker against the shared local Next server,
  preventing concurrent navigation aborts during the complete smoke run.

## Session 2026-07-23 (Codex — security header browser coverage)
- Added browser assertions for baseline security headers and the intentional
  third-party framing exception on campaign embeds.

## Session 2026-07-23 (Codex — checkout method disclosure)
- Clarified the donation form's payment selector as a processing-fee estimate and
  explained that Stripe Checkout determines the final eligible method by device,
  currency, and account configuration.

## Session 2026-07-23 (Codex — live campaign image audit)
- Live HTTP audit passed for all 45 campaign image URLs; static catalog and SQL
  migration IDs remain unique across 18 categories.

## Session 2026-07-23 (Codex — public mutation error hygiene)
- Public mutation coverage now verifies rate limiting and blocks raw backend
  error text; `/api/share-events` returns a stable generic error contract.

## Session 2026-07-23 (Codex — API error contract)
- Normalized raw Supabase errors across API route responses to stable generic
  500 contracts and added a repository-wide regression test.
- Also sanitized OAuth redirect errors and support-seed batch diagnostics.

## Session 2026-07-23 (Codex — health endpoint privacy)
- Kept `/api/health` publicly liveness-only; exact database counts and
  environment diagnostics now require an admin session plus `?details=1`.
### Session 2026-07-23 (Codex — health diagnostic privacy)
- [x] Removed raw Supabase error messages from admin health diagnostics and schema-reload responses; operators receive stable error codes without exposing backend details.
### Session 2026-07-23 (Codex — profile persistence correctness)
- [x] Fixed silent auth profile-sync failures: Supabase profile lookup/write errors now fail the sync request and OAuth callback instead of reporting a successful login with no `profiles` row.
- [x] Live Supabase verification: `newworldventurellc@gmail.com` exists in `auth.users` and has one linked `profiles` row; the previously reported `@google.com` and misspelled `newwolrdventuresllc@gmail.com` addresses do not exist in Auth.
### Session 2026-07-23 (Codex — tax receipt integrity)
- [x] Removed fabricated receipt numbers from annual donor statements; only official numbers persisted in `tax_receipts` are displayed or exported.
### Session 2026-07-23 (Codex — tax export failure integrity)
- [x] Tax exports now reject unsupported formats and return an explicit unavailable error when Supabase campaign, donation, receipt, or nonprofit queries fail instead of presenting incomplete reports.
### Session 2026-07-23 (Codex — mixed-currency tax integrity)
- [x] Tax statement and fundraiser summary builders now reject mixed-currency totals instead of adding incompatible minor units; APIs return a clear `422 MIXED_CURRENCY` response.
- [x] Added `currency=` filtering and printable statement links so donors can complete separate, accurate reports for each currency.
### Session 2026-07-23 (Codex — nonce CSP hardening)
- [x] Added per-request CSP nonces through middleware, nonce-protected theme/JSON-LD scripts, strict script policy, style-attribute compatibility, and preserved third-party embed framing. Browser header assertions now verify the nonce policy.
- [x] Playwright now starts the production server itself, making the CSP browser verification reproducible without manual process setup.
### Session 2026-07-23 (Codex — public route quality gate)
- [x] Added desktop and mobile browser coverage for all 26 public routes, checking document language, named buttons/links, image alt text, and horizontal overflow.
- [x] Expanded the same audit to 35 verified public product routes, including AI, events, matching, sponsor, leaderboard, feature detail, and campaign embed surfaces; desktop and mobile runs pass.

## Session 2026-07-23 (Codex - SEO/AEO Supabase integration)
- [x] Wired public marketing event capture to Supabase contacts, identities, events, consent, and UTM attribution with stable failure responses.
- [x] Added route-aware AEO and SEO migrations, public metadata endpoints, sitemap/robots coverage, privacy preferences, and the public impact route.
- [x] Verified production build, typecheck, lint, 936 Vitest tests, campaign image audit, and seed guard.

## Session 2026-07-24 (Marketing OS — goal-based marketing foundation)

Full detail in `docs/marketing-os/` (MASTER_SPEC, ARCHITECTURE, DATA_MODEL,
IMPLEMENTATION_STATUS, KNOWN_LIMITATIONS, CHANGELOG).

### ✅ Shipped (PR #59)
- [x] Audited the existing marketing subsystem (contacts/segments/campaigns/
      automations/copilot/SEO-AEO/outreach on `marketing_*` tables, service-role RLS).
- [x] **Goal-Based Marketing vertical slice** — the "tell CharitMe the outcome you want"
      entry point, wired UI → API → Supabase → audit log:
  - `marketing_goals` table (migration `20260729000000`), CHECK-enums, indexes,
    `updated_at` trigger, RLS service-role only.
  - `lib/marketing-goals.ts`: deterministic NL→structured-draft parser +
    **live** progress measurement (campaigns / donations).
  - `/api/admin/marketing/goals` GET/POST/PATCH (verifyAdmin + zod + audit).
  - `/admin/marketing/goals` UI (NL composer, editable draft, progress bars,
    lifecycle controls; loading/empty/error/retry; mobile).
  - 6 unit tests; RLS/schema suites green; typecheck + lint clean; `next build` compiles.

### ⬜ Remaining Marketing OS backlog (ordered by dependency/value)
- [x] **Command Center dashboard** (brief §4, top priority) — **SHIPPED & VERIFIED
      (Claude, 2026-07-26).** The checkbox was stale: `app/admin/marketing/command-center/`
      + `lib/marketing-command-center.ts` were already built. Audited against the
      spec rather than taken on trust — it reads **7 live tables** (`marketing_goals`,
      `marketing_campaigns`, `marketing_contacts`, `marketing_events`,
      `marketing_audit_logs`, `campaigns`, `donations`), covering every element the
      item asked for: live goals, marketing + campaign/donation metrics, recent
      human/autonomous actions from the audit log, and data freshness.
      **It is also honest about missing data** — `pct()` returns `null` when the
      prior 7d baseline is 0 and the card prints "no prior-week baseline" in grey
      instead of inventing a percentage (growth from zero is infinite). Same rule
      the public pages now follow.
      Gap closed: it had **no tests**. Added 12 in `__tests__/marketing-command-center.test.ts`
      pinning the no-baseline rule (including the tempting-but-wrong "0% = no change"
      case, which would claim a measurement that never happened) and the audit-label
      fallbacks. **Mutation-tested — 2 fail if the zero-baseline guard is removed.**
- [x] **Opportunity engine** (§20) — SHIPPED: live-data generator + deterministic scoring + convert-to-goal — scored opportunity feed → convert to goal/campaign.
- [x] **Goal → multichannel campaign generation** (§15) — SHIPPED: one goal generates a connected landing page + email + social + SEO + FAQ, editable & approvable, all linked to the goal.
      connected campaign (landing page, email, social, SEO/AEO) linked to the goal.
- [~] **Multi-tenant `organizations`/`brands` (§7)** — **FOUNDATION SHIPPED
      (Claude, 2026-07-26): `20260807000000_organizations_multitenancy.sql`.**
      `organizations`, `organization_members`, `brands`, all with RLS, plus an
      `is_org_member(org, min_role)` helper. Validated against a real Postgres —
      all 90 migrations replayed, `schema.sql` regenerated (152 → **155 tables**).
      Entirely additive: no existing table altered, so it cannot break a deploy.

      Design notes worth keeping:
      - **Org roles are deliberately separate from platform roles.** A platform
        `admin` is staff; an org `owner` runs one tenant. Conflating them is how a
        tenant admin ends up with platform reach.
      - `is_org_member` is `security definer` (so RLS on `organization_members`
        cannot recurse while policies evaluate membership) and **returns FALSE, not
        NULL, when `auth.uid()` is null**. Every comparison is `coalesce`d — the
        direct lesson from `20260806010000`, where three-valued logic made a strict
        guard silently permissive under the service role.
      - No public read on organizations: an org's existence is not marketing
        material, and a public directory is a product decision, not a default.
      - `brands` carries `voice`/`palette` so the Brand Constitution (§10) has
        somewhere to attach without another migration.

      **Follow-up shipped:** `lib/organizations-core.ts` + 15 tests. The role
      ladder previously existed only inside the SQL `case min_role` branches,
      which cannot be unit-tested here. The TS mirror pins it, so a future API
      route gates on the same answer RLS will give — a route that disagrees
      either 500s where it meant 403, or implies access the DB refuses. It fails
      closed on any unrecognised role (same instinct as `coalesce(..., false)`),
      and `viewer`/`member` deliberately share a rank because the SQL `else true`
      branch admits both; ranking them apart would invent a tier the database
      does not enforce. Explicitly NOT a security boundary — RLS remains the
      enforcement point.

      ⬜ **Not done, and deliberately not started:** adding `org_id` to the ~14
      live `marketing_*` tables. That needs a decision about rows predating
      tenancy, and a half-applied scoping migration would leave marketing data
      reachable ACROSS tenants — worse than not starting. That is the next slice,
      and it should be done in one migration with a backfill, not incrementally.
- [ ] Expanded marketing roles (Brand/Legal/Finance reviewers, analyst, viewer) (§9).
- [ ] Approval engine (`approval_requests`/`_steps`/`_decisions`) (§30).
- [ ] Brand Constitution ingestion + per-asset scoring (§10).
- [ ] AI agent framework + orchestrator + governance (§12–13, §38).
- [ ] External connectors: GA4, Search Console, then Ads/social/email (§32) — read-only first.
- [ ] Experiments, attribution models, forecasting, automation-rule builder UI,
      cost governance, monitoring dashboard (§19, §28, §29, §31, §39, §40).

### Guardrails held
- No autonomous spend/publish exists; `autonomy_level` stored but not yet enforced by any executor.
- No faked metrics — non-live metrics are labelled "measurement pending".
- No new external integrations faked; RLS unchanged (service-role only).



### 🔧 Sandbox capability note (2026-07-23) — what CAN and cannot be checked from here

Correcting a wrong assumption that cost several cycles: **"no database in the sandbox"
is not a blanket blocker.** `www.charitme.com` is public, so read-only verification
against the real production DB works and has already settled real questions
(the soft-404 above, Supabase wiring, cover-image uniqueness).

- ✅ **`curl` against production works.** Use it for status codes, headers, rendered
  HTML, record counts, metadata, robots/sitemap.
- ❌ **Playwright/Chromium against external hosts does NOT work** — every navigation
  dies with `net::ERR_CONNECTION_RESET` through the agent proxy, with or without
  `proxy:{server:HTTPS_PROXY}`, `--ignore-certificate-errors`, or QUIC/HTTP2 disabled.
  So axe/CWV/overflow sweeps must run against a **local prod build**, not production.
- ❌ The **Vercel preview** URL is behind deployment protection (302), so it is not a
  substitute for production.
- ❌ Genuinely blocked (needs writes or secrets): running the seed suite, placing a
  real charge across payment methods, rotating the exposed keys.


### 🔓 CLAIM RELEASED (Claude/tbaz3i — builder inline field errors, finding #3) ✅

> **DONE — area is FREE.** Finding #3's remaining half is implemented: per-field
> `aria-invalid` + `aria-describedby` and **focus moves to the first invalid field**.
> Touched `app/create/page.tsx`, new `lib/builder-validation.ts`, new test. Did not
> touch step structure, drafts, the guest gate, the publish gate, or any API.

## 🔓 CLAIM RELEASED — beneficiary role now has a dashboard ✅

> **DONE — area is FREE.** `beneficiary` is one of six roles in `lib/roles.ts`, has a
> full invite flow (`beneficiary_invites` → `/beneficiary/accept`), and
> `campaigns.beneficiary_profile_id` links a campaign to the person it benefits — but
> **nothing read that column**, and `/beneficiary/accept` sent the accepted user to
> `/dashboard/payouts`, which scopes every query by `.eq('user_id', …)` (the campaign
> **owner**). So accepting an invite landed on an **empty dashboard**: no campaigns, no
> payouts, no explanation. A modelled, invitable role dead-ended at onboarding.
>
> **Shipped:** `/dashboard/beneficiary` — the campaigns you're the named beneficiary
> of, with raised/goal progress, organizer, supporter count, and **payout state split
> into "paid out" (delivered) vs "on the way" (requested/approved)**. Deliberately
> read-only: these campaigns belong to someone else, so it answers "how is the
> fundraiser for me doing, and has money actually reached me?" without owner-only
> controls. Plus a plain-language explainer of how payouts reach them.
> `/beneficiary/accept` now points here instead of the owner dashboard.
>
> **Wiring:** `lib/beneficiary-data.ts` — one query for campaigns by
> `beneficiary_profile_id`, then **batched** payout + organizer lookups (no N+1).
> **Verification:** the page is auth-gated and there's no DB here, so the shaping and
> money math are unit-tested (9 tests) — including that `failed` payouts inflate
> neither bucket, that another campaign's payouts aren't attributed, and that null
> money columns become 0 rather than NaN. Telling a beneficiary money arrived when it
> bounced would be worse than showing nothing.
>
> _1101/1101 tests, lint clean, build green._

## 🔓 CLAIM RELEASED — nonprofit role now has a dashboard ✅

> **DONE — area is FREE.** `nonprofit_profiles` (620 rows) was read by the admin
> console, the Stripe webhook and `lib/tax-server.ts` — **but by no user-facing page**,
> so the organization owning the record could not see it.
>
> The sharp edge was **tax receipts**: `tax-server.ts` issues a donor a deductible
> receipt only when `(verified || verification_status === 'verified')` **AND**
> `tax_receipt_enabled`. A nonprofit had no way to know whether its donors were
> getting receipts — or which of the two conditions was missing.
>
> **Shipped `/dashboard/nonprofit`:** organization details (legal name, EIN, country,
> address, website, mission), verification state with plain-language copy per status,
> the org's campaigns — and a dedicated **"Are your donors getting tax receipts?"**
> card that answers yes/no and, when no, names *which* condition is unmet.
>
> **`lib/nonprofit-data.ts` mirrors tax-server's rule exactly** (`isNonprofitVerified`
> handles the legacy `verified` bool OR the `verification_status` column — both exist
> because the bool predates the column). **14 tests** pin it, including the dangerous
> direction: receipts switched on while *unverified* must still read "no", because
> tax-server refuses. Showing "yes" there would be a tax-consequential lie.
>
> **Three signature bugs caught before merge** (worth noting — I guessed APIs instead
> of checking): `kf-btn-primary` **does not exist** (no `.kf-btn*` class in the CSS at
> all) so both buttons would have rendered unstyled — the real pattern is
> `<Link><Btn>…</Btn></Link>`; `EmptyState` takes `body` not `message`; and `shield`
> is not a valid `KFIcon` name.
>
> _1115/1115 tests, lint clean, build green._

### Role → dashboard → landing coverage (2026-07-23)

| role | dashboard | landing |
|---|---|---|
| donor | `/donor` ✓ | `/for-donors` ✓ |
| organizer | `/dashboard` ✓ | `/for-individuals` ✓ |
| **beneficiary** | **`/dashboard/beneficiary` ✓ (new, #68)** | none — *and that's correct*: beneficiaries arrive by invite link, never by search, so a marketing page would serve no one |
| **nonprofit** | **`/dashboard/nonprofit` ✓ (new)** | `/for-nonprofits` ✓ |
| admin / super_admin | `/admin` ✓ | n/a (internal) |

**Every modelled role now has a dashboard.** Remaining nonprofit gap, not built here:
`nonprofit_profiles` has `slug` + `public_profile_enabled` columns that imply a
**public** org page (`/nonprofits/[slug]`) which does not exist — a separate feature
(SEO surface, indexing, RLS review), not a role-dashboard gap.





### ✅ Static a11y guard — covers the auth-gated surface axe cannot reach (Claude, 2026-07-26)

`e2e/accessibility.spec.ts` runs axe against real pages and is the stronger check, but it
can only reach routes that render **without a database** — so the entire authenticated
surface (dashboard, admin, donor) is invisible to it both in CI and in this sandbox.
Two defect classes are detectable in source, so they now have a guard that does cover it:
`__tests__/a11y-static.test.ts` (`<img>` missing `alt`, icon-only `<button>` with no
accessible name), scanning all of `app/` + `components/`.

**Correction on those 2 defects:** while rebasing, master had **deleted both** — the whole
`DataTable` component and `KindFundApp.tsx` were removed as dead code by another agent. So
the buttons I labelled were unreachable UI, and my "fix" is moot. Took master's deletions.
**The guard itself stands and is the durable part** — it now watches all of `app/` +
`components/` and will catch the same defect class in live code. Recorded so the entry
isn't read as "fixed two live bugs".

**It found 2 defects on its first run** — the "sliders" filter buttons in the admin
card header (`KindFundApp.tsx:222`, `CharitMeApp.tsx:321`) were icon-only with no label,
so a screen reader announced each as just *"button"*. Both fixed with `aria-label="Filter"`.
`<img alt>` was already clean app-wide (0 offenders), which is worth knowing.

Non-vacuity verified: removing one `aria-label` fails the guard with the exact file:line.

**Two further checks were prototyped and deliberately NOT shipped — read before rebuilding them:**

- **Icon-only links (`<a>`/`<Link>` with no text, no `aria-label`) — DROPPED, too noisy.**
  Its single hit, `app/SponsorsBar.tsx:67`, is a **false positive**: the link wraps
  `<SponsorImg>`, which renders `<img alt={name}>`, so it already has an accessible name.
  A regex cannot see through an opaque child component, and "fixing" it would have added a
  redundant label to correct markup. A guard that cries wolf gets ignored, which is worse
  than no guard — so this one stays out until it can resolve child components.

- **`<div>`/`<span>` with `onClick` — I reported "28 real hits". That was WRONG. All 28 are
  fine; do not chase them.** Correcting it here rather than leaving a false lead in the
  backlog. Breakdown after actually looking:
  - **23** carry a documented `eslint-disable` with a rationale — they are modal
    **backdrops** (`onClick={e => { if (e.target === e.currentTarget) close(); }}`) where
    backdrop-dismiss is supplementary and **Escape + a visible close button are the
    keyboard path**. That is the correct, standard pattern, already reviewed by another
    agent.
  - **5** were **false positives of my regex**. `eslint.config.mjs` explicitly enables
    `jsx-a11y/click-events-have-key-events` and `no-static-element-interactions` (another
    agent widened the ruleset beyond next's default 6), and eslint reports **zero warnings**
    on those files. Its AST analysis is simply more accurate than pattern-matching JSX.
  **Lesson worth keeping:** before reporting a defect class, check whether the linter
  already covers it. `eslint .` was green the whole time I was "finding" these.

_1284/1284 tests, typecheck clean, build green._

## 📌 HANDOFF — Claude/tbaz3i session end (2026-07-26)

**Read the CI entry above first.** It is the highest-leverage item in this file and it
is not something the next agent can fix from a sandbox either.

### Shipped and merged this session
| PR | what |
|---|---|
| #49 | mobile horizontal-overflow + first a11y pass (~15 public routes) |
| #52 | dark-mode contrast on 5 more routes + mobile CLS 0.124 → 0 |
| #63 | soft-404 root cause + 4 routes, robots.txt exposure, skip link, focus-visible |
| #66 | `/campaigns/[slug]` soft-404 — layout gate + `(list)` group, skeleton kept |
| #67 | builder inline field errors (aria-invalid/describedby + focus move) |

### Open PR
**#91 — fabricated "Verified" badge suppression.** Verified good locally by every
check (tsc, eslint 0 errors, 1281 tests, image audit, build, **30/30 e2e**). Its red
checks are the repo-wide failure, not the PR.

### What I could NOT do, and why — so nobody re-derives it
- **CI cause** — logs 404 (both lookups, 3 runs), check-run output empty, `npm ci`
  clean, all steps pass locally. Needs GitHub UI access.
- **Homepage dynamic rendering** — 3 candidates eliminated (CSP nonce, `unstable_cache`
  on fetchers, `seoMetadata`). Puzzle to respect: 26 *other* routes DO go static when
  `headers()` is removed, and they share the same root layout — so "the layout is
  dynamic" does not explain it.
- **Anything needing writes or secrets** — seed execution, real payment flows, key
  rotation, the demo-row cleanup SQL below.

### Genuinely next, ranked
1. **Get CI green.** Everything else is guesswork until a red check means something.
2. **Owner: run the demo cleanup SQL** — `/grants` still publicly attributes fabricated
   programs to *real* orgs (52 "Ford Foundation", 44 "City of Austin"). #91 hides the
   false badge; only SQL removes the false attribution.
3. **The 3 real parity gaps** (audited, specific): social connectors (6 channels),
   unified CRM record joining donor↔sponsor↔volunteer↔grant-maker, goods/equipment
   modelling. Each is a feature, not a fix.

### Method note worth keeping
Production is readable from the sandbox and settled several questions that were being
treated as blocked — the soft-404 confirmation, seed counts for six domains, the live
trust-badge count, sitemap health, TTFB. `curl` works; **Playwright cannot reach
external hosts** (`ERR_CONNECTION_RESET` through the proxy), so browser sweeps must run
against a local prod build.

## 🔴 CI HAS BEEN RED ON MASTER FOR AT LEAST 8 CONSECUTIVE COMMITS

**Nobody currently has CI signal.** Every recent `master` run of `ci.yml` reports
`failure` — checked via the Actions API, newest first:

| head | title | conclusion |
|---|---|---|
| `18516d03` | docs(todo): close the seeded-but-unread sweep | **failure** |
| `14a338e8` | fix(links): 120 events offered a Join link… | **failure** |
| `a7ce188d` | Merge remote-tracking branch 'origin/master' | **failure** |
| `e175b592` | test(a11y): enforce zero contrast failures | **failure** |
| `01043879` | docs(todo): claim the scrollable-region audit | **failure** |
| `032408ff` | docs(todo): API authorization audit | **failure** |
| `59fabebb` | fix(seeds): guard the SQL seeds | **failure** |
| `a7326bf2` | docs(todo): audit the 10 parity boxes | **failure** |

Both jobs fail — `typecheck · lint · test · audit · build` **and** `e2e (playwright)`.
Note several of those are **docs-only commits**, which is a strong hint the cause is
environmental/config rather than any one change.

**This matters more than any single feature in this file:** PRs are being merged into a
permanently-red master, so a real regression would look exactly like the current noise
and sail straight through.

**What I could and could not establish** (from PR #91, which inherits the same failure):
- ✅ Every CI step passes **locally** on the same tree: `tsc --noEmit` clean,
  `eslint` **0 errors**, **1281/1281** unit tests, `audit:campaign-images` PASSED,
  `next build` exit 0, and **30/30 Playwright e2e** (run with
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`, the opt-in override added in
  `24ab30d`).
- ❌ **CI logs cannot be read from here** — `get_job_logs` returns HTTP 404 for every
  job, by `job_id` and by `run_id`+`failed_only`, on two separate runs. So the
  CI-specific cause is not visible to an agent in this sandbox.
- ⚠️ First local e2e attempt failed on a missing `chrome-headless-shell` binary — that
  is a **sandbox artifact**, not the CI failure (CI runs `playwright install --with-deps
  chromium`). Don't chase it.

**Also eliminated since (so nobody repeats them):**
- **`npm ci` lockfile mismatch — ruled out.** `npm ci --dry-run` succeeds locally
  (exit 0, lockfile in sync with `package.json`). This was the best hypothesis for
  "docs-only commits fail too", and it is wrong.
- **Check-run output carries nothing.** `get_check_run` on the failing job returns
  empty `title`/`summary`/`text`, so the webhook payload has no diagnostic either.

### ✅ ROOT CAUSE FOUND — the jobs never run. This is an ACCOUNT issue, not a code issue.

**Every run fails in 3–5 seconds.** Measured from the Actions API (`run_started_at` →
`updated_at`) across the last 8 master runs: 3s, 3s, 4s, 5s, 4s, 4s, 4s, 3s. PR #91's
latest: `18:14:25` → `18:14:27` = **2s**, both jobs.

A real run does `npm ci`, a Next production build, 1281 unit tests and a Playwright
suite — **minutes**, not seconds. So the workflow is failing *before executing a single
step*.

**This retro-explains every dead end above, and they were dead ends for a reason:**
- **Logs 404** on both lookup paths — there are no logs, because nothing ran.
- **`get_check_run` output empty** — nothing produced output.
- **Docs-only commits fail** — content is irrelevant when no step executes.
- **Both jobs fail identically** — they share only the *start*, which is where it dies.
- **Every local reproduction passes** — correctly, the code is fine.

**Most likely cause: GitHub Actions minutes/billing exhausted on the free tier.** The
account is demonstrably hitting free-tier ceilings elsewhere *right now* — Vercel returns
`api-deployments-free-per-day` ("more than 100") on every push. An Actions quota
exhaustion produces exactly this signature: instant failure, no logs, no output.

**Owner action (2 minutes, nothing to code):** check
**Settings → Billing → Actions** for used minutes / spending limit, and the repo's
Actions tab for a banner. Other candidates if the quota is fine: a self-hosted/unavailable
runner label, or org-level Actions permissions.

**Consequence while it lasts:** a red check carries **zero information** — it is not
evidence that a PR is broken. Verify locally: `tsc --noEmit`, `eslint .`,
`vitest run`, `audit:campaign-images`, `next build`, and
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test`.

### ⚠️ SUPERSEDED LEAD (kept — the fix shipped anyway, on its own merits)

Objective, checkable without CI logs:

| fact | value |
|---|---|
| `.node-version` (repo pin, used by Vercel) | **20.11.0** |
| `rolldown` engines (vitest 4's bundler, installed) | **`^20.19.0 \|\| >=22.12.0`** |
| `vitest` in `apps/web/package.json` | **`^4.1.7`** |
| `apps/web` own `engines` field | **`{}` — empty, so nothing enforces a floor** |

**20.11.0 does not satisfy `^20.19.0`.** Vitest 4 pulls in rolldown, so a Node below
20.19 cannot run the unit-test step — and both CI jobs run Node tooling after
`npm ci`, which fits *both* failing, and fits **docs-only commits failing too**
(environmental, not code). It also fits the timing: vitest 4 is a recent upgrade, and
master went red around then.

**This was NOT the CI cause** — the 3-second failures above rule it out; nothing ran, so
no Node ever executed. The fix below still shipped because it is a genuine latent bug
independent of CI. Original caveat kept for the record: `ci.yml` sets `node-version: 20.x` (the comment there even
says the `.node-version` pin "is too old"), and `20.x` *should* resolve to the newest
20.x, which would satisfy rolldown. So this is a strong lead, **not a confirmed cause** —
it depends on what `setup-node` actually resolves in this repo, which is exactly what
the logs would show and I cannot read.

**✅ SHIPPED (this change), on its own merits — not as a blind CI guess:**
- `.node-version` **20.11.0 → 20.19.0** (still Node 20 LTS; the workflow comment already
  called the old pin "too old", so this matches existing intent rather than changing it).
- `apps/web/package.json` now declares **`engines: { node: "^20.19.0 || >=22.12.0" }`** —
  previously empty, which is *why* this drifted silently. npm now warns (`EBADENGINE`) on
  an unsupported Node instead of failing opaquely somewhere downstream later.

Justification does **not** depend on this being the CI cause: a repo pinning a Node below
an installed dependency's stated minimum is a bug either way, and the missing `engines`
floor is what let it happen unnoticed. Verified locally after the change — **1281/1281
tests, typecheck clean, build exit 0**. If CI goes green, that confirms the lead; if not,
the latent bug is still fixed and the search narrows.

**Next step for whoever can read the logs:** open the run in the GitHub UI. Likely
candidates given docs-only commits also fail: a required secret/env missing from the
workflow, an `npm ci` lockfile mismatch, or a runner/Node version change. Until then,
**a red check on a PR does not mean that PR is broken** — verify locally with the six
commands above.

## 🔓 CLAIM RELEASED — fabricated trust badges suppressed at the READ layer ✅

> **DONE — area is FREE.** Complements the seed-source fix below, which governs
> *future* runs only. Re-confirmed live before starting: `/grants` served **52
> "Ford Foundation"**, **44 "City of Austin"**, **48 "Verified"** and **96 "Seed
> Grant"** rows, with none of the new fictional funder names — seeds don't rewrite
> existing data.
>
> **What shipped:** `lib/demo-trust.ts` — public reads force `verified=false` for
> demo rows. No writes, no schema, no seed changes; the fabricated trust signal
> stops rendering **on deploy**, without waiting for the owner's SQL cleanup.
> Wired into `getPublicGrants`, `getGrantBySlug`, `GET /api/grants`,
> `getPublicOpportunities` and `getOpportunityBySlug`.
>
> **Two mistakes caught by testing rather than shipped** — worth recording:
> 1. **The marker.** A `source === 'seed'` check looked obviously right (grants
>    carry it, and the suggested cleanup SQL keys on it) — but
>    `volunteer_opportunities` **has no `source` column at all**, so that check was
>    a silent no-op for every volunteer row. The one marker common to all three
>    seeded tables is the `seed-…` slug prefix, so `isDemoRow` checks both.
> 2. **The detail read.** The first pass imported the helper into
>    `volunteers-server.ts` and never called it on `getOpportunityBySlug`, so a
>    seeded opportunity's own page kept its badge. Lint's unused-import warning is
>    what surfaced it.
>
> Both are pinned by tests. Non-vacuity verified both directions: reverting to a
> source-only check fails **5** tests; making it downgrade *real* verified orgs
> fails **2**. _1270/1270 tests, lint clean, build green._
>
> **Still needs the owner:** the rows themselves, and the real-organization names
> (`Ford Foundation`, `City of Austin`) already attributed to fabricated programs —
> suppression hides the false *badge*, not the false *attribution*. Cleanup SQL is
> below.

## 🔴 SEED-DATA — fabricated "Verified" badges, and real foundations named on fake grants (ONE IS LIVE)

**Found while scoping a public `/nonprofits/[slug]` page (2026-07-23). Not currently
harmful — but it gates that feature, and one plausible admin action makes it harmful.**

`supabase/seeds/02_marketplaces.sql` inserts 120 nonprofit_profiles per run as:

```sql
'Seed Nonprofit ' || g,  'seed-nonprofit-' || v_suffix || '-' || g,
'00-' || lpad(g::text, 7, '0'),          -- fabricated EIN, e.g. 00-0000001
'https://example.org/np/' || g,          -- fake website
(g % 2 = 0)                              -- verified = TRUE for half of them
```

So roughly **half the ~620 nonprofit_profiles rows are marked `verified = true`, each
carrying an invented tax ID** and an example.org URL.

**Why it is safe today:** `lib/tax-server.ts` issues a deductible receipt only when
the org is verified **AND** `tax_receipt_enabled`. The seed does not set that column,
so it takes the schema default `false`. **No fabricated org is issuing tax receipts.**

**Two ways it stops being safe:**
1. **A public nonprofit page.** `nonprofit_profiles` has `slug` +
   `public_profile_enabled` (default **true**), which clearly anticipate
   `/nonprofits/[slug]`. Shipping that against current data would publish **hundreds
   of fabricated charities showing fake EINs and "Verified" badges**, indexed by
   search engines. Seeded *campaigns* are already public, but a fake **charity with an
   invented tax ID presented as verified** is a different risk class — that is the
   kind of claim people rely on when giving.
2. **Bulk-enabling receipts.** Any admin action that switches `tax_receipt_enabled` on
   across orgs would immediately have fake charities issuing "official tax receipts".

**Recommended before either:** clear `verified`/`verification_status` on seeded rows
(or scope the public page to `verified AND NOT seeded`), and add a `is_demo` marker —
this is the same "production seed guard" already tracked as CHAR-1402. **The public
`/nonprofits/[slug]` page is deliberately NOT built until then**; the missing page is a
smaller problem than a directory of fabricated verified charities.

_Verified: seed SQL read directly; `tax_receipt_enabled` default confirmed `false` in
`supabase/schema.sql`; receipt rule confirmed in `lib/tax-server.ts`._

### 🔴 The same pattern IS already live on `/grants` — and it names real organizations

Scanning the rest of `02_marketplaces.sql` found the nonprofit case was not isolated.
Seeded **grants** and **volunteer opportunities** also set `verified = (g % 2 = 0)`, and
grants attributed fabricated programs to a hardcoded list of **real** funders.

**Confirmed live on production** (`curl https://www.charitme.com/grants`):

| appearing on the live page | count |
|---|---|
| "Ford Foundation" | **52** |
| "City of Austin" | **44** |
| "Verified" badges | **48** |
| listings titled "Seed Grant *N*" | many |

`/grants` is public **and in `sitemap.ts` (181 URLs)**, so these are being indexed.
Unlike the nonprofit case — which is latent because no public page exists yet — this
one is **already shipped**: fabricated grant programs are publicly attributed to real,
named third-party organizations, roughly half wearing a "Verified" badge.

**Fixed at the source (this change):** funder list → clearly fictional
(`Cedar Grove Foundation`, `Northwind Charitable Trust`, `City of Springfield`,
`Acme Corp Giving`), and **`verified` is now hardcoded `false`** for seeded grants,
volunteer opportunities and nonprofits. `verified` renders as a public trust badge, and
a fabricated trust signal is the one field demo data must never invent.

**Still needs the owner — the live rows are already there.** Seeds only govern future
runs; this does not touch existing production data, and per ADR-0003 I can't and
shouldn't. Suggested cleanup, owner to review before running:

```sql
-- Drop the fabricated trust badges from demo rows.
update public.grants                  set verified = false where source = 'seed';
update public.volunteer_opportunities set verified = false where title like 'Seed %';
update public.nonprofit_profiles      set verified = false, verification_status = 'unverified'
  where slug like 'seed-nonprofit-%';

-- Re-name grants that credit real organizations.
update public.grants set funder_name = 'Cedar Grove Foundation'   where funder_name = 'Ford Foundation'   and source = 'seed';
update public.grants set funder_name = 'Northwind Charitable Trust' where funder_name = 'Gates Foundation'  and source = 'seed';
update public.grants set funder_name = 'City of Springfield'      where funder_name = 'City of Austin'    and source = 'seed';
```
_(Verify the `source`/`slug` predicates match real seeded rows before running.)_



### ✅ Broken-link audit extended to the AUTH-GATED surfaces (2026-07-23)

The earlier crawl ("464 distinct internal links across 31 public pages, 0 broken") could
only reach **public** pages — everything behind auth was unverified, which is exactly the
surface "build the dashboards out completely" refers to.

Audited statically instead of by crawling: enumerated **354 real routes** from the
filesystem (normalising `(group)` segments, which don't affect URLs, and accepting
`[param]` matches), then extracted every internal `href` in `app/dashboard/**`,
`app/admin/**`, `app/donor/**` and `components/**` and checked each against that set.

**Result: 0 broken internal links.** Navigation across the logged-in surface is sound.

_Confirmed non-vacuous:_ planting `href="/this-route-does-not-exist"` in a dashboard page
made the audit report exactly 1 broken link; restoring returned it to 0. Script kept at
`scratchpad/links.py` — re-runnable in seconds, worth repeating after any route rename,
since this class of breakage is invisible until a user clicks.


### 🔴→✅ Both new role dashboards shipped ORPHANED — caught and fixed (2026-07-23)

Self-audit after #68/#69: `dashboardNav` in `components/CharitMeApp.tsx` had 18 entries
and **neither `/dashboard/beneficiary` nor `/dashboard/nonprofit` was among them**. Both
pages were complete, wired and tested — and reachable only by typing the URL. The
nonprofit one had **no entry point at all**, so the organizations it was built for would
never have found their own verification and tax-receipt status.

Nothing catches this: the build is green, the routes exist, the tests pass. A page can be
perfectly correct and still be invisible.

**Fix — role-scoped nav.** `profiles.roles` was already being fetched by the shell but
collapsed into a display label (`Admin`/`Moderator`/`Organizer`), discarding
`beneficiary`/`nonprofit`. Now passed through as `navRoles` and used to append entries
only for users holding that role — so an organizer's sidebar is unchanged, while a
beneficiary sees "Campaigns for you" and a nonprofit sees "Your organization".

**Guarded** by `__tests__/dashboard-nav-reachable.test.ts` (4 tests), including that the
role entries are *spread into the rendered list* rather than merely declared — verified
non-vacuous by removing the spread, which fails the suite.

_1119/1119 tests, lint clean, build green._


### 🟠 Three AI endpoints are fully built and reachable by nobody (2026-07-23)

Same failure mode as the orphaned dashboards in #71, one layer down. Audited every
`/api/ai/*` route for callers — **not just `.tsx`, but any file in `app/`, `lib/` or
`components/`**:

| route | size | reads | callers |
|---|---|---|---|
| `ai/impact-summary` | 216 lines | `campaigns`, `transparency_ledger_items`, `risk_flags`, `ai_generations` | **0** |
| `ai/viral-loop` | 173 lines | `campaigns`, `share_events`, `team_members`, `ai_generations` | **0** |
| `ai/grant-match` | 73 lines | `grants`, `grant_matches` | ✅ **now wired** (below) |

All three are **real implementations**, not stubs — auth-guarded, Supabase-wired,
writing to `ai_generations`. Roughly **460 lines of working feature code that no user
can invoke**. (The other 13 AI routes all have callers; verified individually.)

**`impact-summary` is worse than unused — it's promised.** `/for-nonprofits` advertises
"Generate personalized thank-you emails, **impact summaries**, and re-engagement
sequences automatically." The endpoint exists and works; there is no path to it.

**Why this is documented rather than built:** each needs a placement decision (which
dashboard, what trigger, what the output looks like) that is a product call, not a
guess — and dashboard UI can't be verified in this sandbox anyway (auth-gated, no DB).
Plausible homes, for whoever picks it up: `impact-summary` → the campaign's impact/
transparency tab; `viral-loop` → the share/referrals surface; `grant-match` →
`/dashboard/grants`, which already exists and lists applications.

**✅ One closed: `grant-match` is now reachable.** Added `GrantMatchClient` to
`/dashboard/grants` — a small form (category / amount needed / free-text purpose) that
posts to the endpoint and lists ranked matches. It shows **each match's `reasons`**, not
just the score, which the endpoint already returns: the ranking is `rankGrantMatches`,
a **deterministic rule-based model rather than an LLM**, so the explanation is real and
stable. Field names were checked against `lib/grants.ts` (`grantId` / `score` 0..100 /
`reasons`, and the `GRANT_PUBLIC_COLUMNS` set) rather than guessed — the mistake that
produced an unstyled `kf-btn-primary` button earlier in this session.

**Still orphaned: `impact-summary`, `viral-loop`** — both need a placement decision
(which surface, what trigger) that is a product call. `impact-summary` remains the
priority since `/for-nonprofits` advertises it.

_Method: `grep -rn "ai/<route>" app/ lib/ components/` excluding the route's own
directory; a re-runnable version is at `scratchpad/reach.py`. Worth running when adding
an endpoint — a route with zero callers is invisible, and nothing in the build or test
suite objects._

## 📊 Sitemap health + independent seed-count evidence (production, 2026-07-23)

Checked the live `sitemap.xml` because the soft-404 fix makes stale entries *visible*
to crawlers (a listed URL that 404s is now a real 404, not a silent 200).

**Sitemap is healthy — 1258 URLs, no stale entries found.** 12 randomly sampled campaign
URLs all returned 200, and one URL from each other section resolved too (volunteer,
grants, events, sponsor, matching, impact). Nothing listed is dead.

**Useful side effect — the sitemap is generated from the database, so its per-section
counts are independent evidence for the "≥100 seed records" goal item** (these are *live,
public* rows, which is the meaningful bar for "enough data to exercise every feature" —
drafts and deleted rows are excluded, so true table counts are ≥ these):

| section | live rows in sitemap | ≥100? |
|---|---|---|
| campaigns | **351** | ✅ |
| volunteer | **181** | ✅ |
| grants | **181** | ✅ |
| events | **181** | ✅ |
| sponsor | **145** | ✅ |
| matching | **121** | ✅ |
| impact | 58 | n/a — see below, **not a gap** |
| blog / features | 9 / 7 | n/a — static catalogues, not seeded tables |

So six feature domains are confirmed ≥100 **from production**, without needing DB access.

**Correction — `impact` at 58 is NOT a seed gap; I initially flagged it as one and was
wrong.** `/impact/[slug]` takes a **campaign slug**, not an impact-table id
(`getImpactBundle(slug)`; the sitemap entry is `/impact/campaign-351-b7e076c5` and the
title renders as "Impact — {campaign.title}"). So those 58 URLs are *campaigns that have
a published impact plan* — a derived product metric, not a row count. The underlying
tables are seeded properly: `04_impact_gamification.sql` loads **120 rows**
(`generate_series(1, 120)`) into `impact_plans`, `impact_metrics`, `impact_evidence`,
`impact_updates` and `impact_plan_items`, all five covered by `99_verify_counts.sql`.
**No top-up needed.**

_Method, for reuse: `curl -s https://www.charitme.com/sitemap.xml | grep -oE '<loc>[^<]+</loc>'`
then bucket by path segment._


## 🟠 PARTLY DIAGNOSED — HTML is never CDN-cached (homepage cause still unknown)

**Symptom (production):** the homepage answers **`x-vercel-cache: MISS`, `age: 0` on
every single request** — 6/6 consecutive runs — so its `export const revalidate = 120`
never takes effect and each visit re-runs the page's ~8 Supabase queries. TTFB is
**~800–1500ms vs 229–572ms** for every other public page (proxy overhead is in all of
these equally, so the ~5× gap is the real signal, not the absolute numbers).

**Blast radius — it is not just the homepage.** In the build, **353 routes are `ƒ`
(per-request)**; only 2 are SSG (`/blog/[slug]`, `/features/[slug]`, via
`generateStaticParams`) and the 4 "static" entries are `icon.png`, `apple-icon.png`,
`manifest.webmanifest` and `robots.txt` — not pages. **No page in the app is
statically cached.** Even pure marketing pages with no per-user content re-render on
every hit.

**Cause — PARTIAL, and my first write-up of this overstated it. Corrected by experiment:**

`app/layout.tsx:77` — `const nonce = (await headers()).get('x-nonce')` — is *a* cause but
**not the whole story**. Measured by removing that line and rebuilding:

| build | static | dynamic |
|---|---|---|
| as-is | 4 (all non-pages: icons/manifest/robots) | **353** |
| without `headers()` | **26** | 331 |

So the nonce accounts for **22 routes** — and they are exactly the pure marketing pages
(`/how-it-works`, `/fees`, `/for-donors`, `/trust-safety`, `/terms`, `/privacy`, …), which
is a real and worthwhile win. **But `/` stays `ƒ` without it**, so the nonce does *not*
explain the homepage MISS I measured — the very page the investigation started from.

**Also disproven (don't repeat):** wrapping the homepage's three Supabase fetchers
(`getHomeData`, `getCategoryStats`, `getRecentDonations`) in `unstable_cache` — the same
pattern that works for announcements/banner-settings — changed **nothing**: still `ƒ`,
static count still 26 with the nonce also removed. The theory was that Next 15's uncached
`fetch` default was opting the route in; that is not it, or not only it.

**Third candidate also eliminated:** stubbing `generateMetadata` to a literal
(`return { title: 'CharitMe' }`, removing the `seoMetadata('/')` DB read) *with*
`headers()` also removed — homepage **still `ƒ`**. So it is not the SEO-override lookup.

**Homepage dynamic cause: still unidentified after 3 eliminations** (`headers()` nonce,
`unstable_cache` on the data fetchers, `seoMetadata`). Remaining untested: the
`AppShell`/provider tree in the root layout (it may read auth/cookies), or something in
the page body itself. Note the puzzle for whoever continues — **26 other routes DID go
static** once `headers()` was removed, and they render the same root layout and AppShell,
so a blanket "the layout is dynamic" explanation does not fit either.

**Three further candidates eliminated (2026-07-23), by inspection rather than rebuilds:**
4. ~~`searchParams`~~ — `HomePage()` takes **no props** and calls `getHomeData({})`. It
   never reads searchParams, so the classic dynamic opt-in doesn't apply.
5. ~~the Unsplash cover fetch~~ — `lib/unsplash.ts:106` uses
   `fetch(url, { next: { revalidate: SEARCH_TTL_SECONDS } })`, i.e. **explicitly
   cached**. It was a good suspect (the 26 routes that go static make no network calls;
   the homepage does) but it is not an uncached fetch.
6. ~~`unstable_noStore()` / `connection()`~~ — absent from the entire homepage import
   tree (`home-data`, `covers`, `unsplash`, `photo-catalog`, `seo`, `supabase`,
   `CampaignImage`, `home-parts`, `HeroSpotlightCarousel`).

**Six eliminated; cause still unknown.** The one structural difference left between the
homepage and the 26 pages that DO go static is that the homepage makes **Supabase reads
in the page body** — but wrapping those in `unstable_cache` (candidate 2) changed
nothing, so if that is the mechanism it is not fixed the obvious way. A likely next step
is checking whether supabase-js issues its fetches with `cache: 'no-store'` internally
and whether `unstable_cache` actually isolates that.

**I stopped here deliberately.** Six wrong hypotheses on one question is well past the
point where I was guessing rather than converging, and each *rebuild-based* cut costs a
full build.
Everything above is measured, and every experiment was reverted — the tree carries none
of it. The eliminations are the deliverable: they are the expensive part, and they narrow
the search for whoever picks it up. The nonce comes from `middleware.ts:47` and protects exactly two
inline scripts (layout.tsx:81–82): the theme script and the JSON-LD blob.

This is a genuine tension, not a mistake: a CSP nonce is per-request **by design** (that
is what makes it unguessable), and static generation requires no per-request input. The
CSP work (see the nonce entry earlier in this file) is a real security improvement — it
just silently cost the entire site's caching. Note this also **regressed the PR #52
finding** that the root layout "stays statically generated (verified `○ /` in the build)";
that is no longer true.

**Not fixed here — it is a security/perf trade-off in someone else's lane.** Options,
best first:
1. **Hash-based CSP for the two inline scripts.** Both are effectively static per deploy,
   so `'sha256-…'` source expressions can replace `'nonce-…'`, `headers()` leaves the
   root layout, and static/ISR is restored **with the same CSP strictness**. Caveat:
   `'strict-dynamic'` currently pairs with the nonce and would need re-checking, and the
   theme script's hash must be regenerated whenever its content changes (a build step).
2. **Keep the nonce, scope the dynamic read.** Move the nonce-consuming scripts out of the
   root layout so only the subtree that needs them is dynamic.
3. **Accept it** — if per-request CSP is judged worth ~5× TTFB on every page.

**Corroborating detail — there is only ONE cause here, not two.** Every HTML response
carries `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, which
would defeat CDN caching even for a static page. That header is **not set anywhere in the
codebase** (no `no-store` in `middleware.ts` or `next.config`) — it is Next's *default for
dynamically-rendered routes*. So it is a symptom of the same root cause and will clear
itself once routes render statically again; do not go hunting for a separate
header-setting bug.

**Also verified healthy while measuring, so these need no work:** brotli (`content-encoding: br`)
is on for HTML and JS, hashed static assets carry `public,max-age=31536000,immutable`
(correct), and HSTS is present. Asset delivery is fine — **HTML caching is the whole
problem.**

**Verify after any change** with `curl -sI https://www.charitme.com/ | grep -i x-vercel-cache`
(want `HIT`) and by confirming `○ /` reappears in the build output.

## ✅ FULLY RESOLVED — soft-404 (4 in #63, /campaigns/[slug] here, /donors a non-issue)

**Root cause (proven):** a `loading.tsx` at or above a detail route creates an implicit
Suspense boundary; Next streams the shell and **commits HTTP 200 before the page body
runs**, so the later `notFound()` renders the right UI but can't change the status.
Perfect correlation across all 7 routes — `/grants`, the only one without a
`loading.tsx`, was the only one returning 404. Proven by removing *only*
`app/matching/loading.tsx`: `/matching/missing` flipped 200 → 404, all controls unchanged.
*(Five earlier hypotheses — `generateMetadata`, React `cache()`, the data helpers,
middleware, `force-dynamic` — were each tested and disproven. Don't repeat them.)*

**Fixed in #63:** `/matching`, `/sponsor`, `/volunteer`, `/events` — list page moved into
a `(list)` route group so its skeleton stops wrapping the sibling detail route. URLs and
skeletons unchanged, detail routes now 404.

### Correcting an earlier over-escalation

I previously logged the remaining two as one blocked "product decision". That was wrong —
they are not equivalent:

- **`/donors/[id]` — NOT AN ISSUE, no action needed.** `robots.ts` disallows `/donors/`
  **and** the page emits `robots: {index:false, follow:false}` for private profiles. No
  crawler ever sees it, so its 200 has **zero SEO impact**. Its skeleton should stay.
- **`/campaigns/[slug]` — the only one that genuinely matters.** Campaign pages are in
  `sitemap.ts` and are the primary indexed content, so soft-404s here really do let search
  engines index unlimited non-existent campaign URLs.

### ✅ `/campaigns/[slug]` — FIXED (2026-07-23), skeleton kept

**Solved with a third option neither of the two written up here considered.** A
segment `layout.tsx` renders *outside* the Suspense boundary that `loading.tsx`
creates for the page, so an existence check there runs **before the response
commits** — correct 404s **and** the donation-path skeleton survives.

**Two parts, both required** (verified — neither works alone):
1. `app/campaigns/[slug]/layout.tsx` awaits `getCampaign(slug)` → `notFound()`.
   *On its own this still returned 200*, because the parent
   `app/campaigns/loading.tsx` wraps the whole subtree including the layout.
2. List page moved to `app/campaigns/(list)/` (page + loading), removing that
   outer boundary from the detail route. URL unchanged.

**Verified on a local prod build:** `/campaigns/missing` → **404** (was 200);
`/campaigns` and `?category=` filters → 200; `/grants` → 404 (control);
`[slug]/loading.tsx` **still present**. 1075/1075 tests, lint clean, build green.

**Safety (it is the donation path):** `getCampaign` extracted to a shared React
`cache()`d module imported by layout + `generateMetadata` + page → still **one
query per request**, no added round-trip. The page keeps its own
`if (!campaign) notFound()`, so real campaigns are untouched — the layout only
changes *when* the identical check runs, never what it decides.

**Bonus — a 7th route nobody had catalogued.** `/campaigns/[slug]/embed` was also
soft-404ing in production (200 for a missing campaign); it was never in the original
sweep. It inherits the same parent `app/campaigns/loading.tsx` boundary, and
`[slug]/layout.tsx` wraps `embed/` too — so this fix resolves it as a side effect,
**verified 200 → 404 on the local prod build**. Correct behaviour: an embed iframe for
a deleted campaign should 404, not render an empty widget.

Also checked and clean: `/impact/[slug]` → 404 already (no `loading.tsx`, consistent
with the root cause).

### Complete soft-404 sweep — all 12 public dynamic routes, checked on production

Enumerated every public dynamic route (`find app -name page.tsx -path "*[*"`, minus
dashboard/admin/api) rather than sampling, because the embed route showed the original
sweep had missed nested ones. Status against `www.charitme.com`:

| verdict | routes |
|---|---|
| ✅ correct 404 (8) | `/blog/[slug]`, `/events/[slug]`, `/features/[slug]`, `/grants/[slug]`, `/impact/[slug]`, `/matching/[id]`, `/sponsor/[id]`, `/volunteer/[slug]` |
| 🔧 200 → fixed in #66 (2) | `/campaigns/[slug]`, `/campaigns/[slug]/embed` |
| ⚪ 200, not a bug (2) | `/donors/[id]`, `/donor/tax-statement/[year]` |

**#63's fixes are confirmed live:** `/events`, `/matching`, `/sponsor`, `/volunteer` now
404 in production — they returned 200 before that merge. The root-cause theory also holds
on a route that wasn't used to derive it: `/impact/[slug]` has no `loading.tsx` and 404s.

**Why the two remaining 200s are not bugs:**
- `/donors/[id]` — `robots.ts` disallows `/donors/` *and* the page emits `noindex`. No
  crawler sees it, so no SEO impact; its skeleton should stay.
- `/donor/tax-statement/[year]` — not a missing resource but an **auth state**: it serves
  a *sign-in prompt* (verified: no tax data in the unauthenticated response), and `/donor`
  is robots-disallowed. A 200 for "route exists, you're signed out" is correct. An
  authenticated year with no donations legitimately renders an empty statement.

**So the soft-404 topic is closed** — nothing outstanding once #66 merges.

**All 7 soft-404 routes are now resolved** (4 in #63, this one here, `/donors/[id]`
a documented non-issue — crawler-blocked by `robots.ts` + `noindex`).

## 🔓 CLAIM RELEASED 2026-07-23 (Claude/tbaz3i — dynamic `[slug]` public-page audit)

> **✅ DONE — area is FREE.** Audited the last unaudited public surface: the
> dynamic `[slug]`/`[id]` routes that the "~30 public routes audited" line
> excluded. No API/schema/create/dashboard/admin files touched.
>
> **Split by what the sandbox can actually verify:**
> - **SSG routes (no Supabase) — browser-audited, now clean.** `/features/[slug]`
>   ×4 and `/blog/[slug]` ×4: axe-core WCAG 2.0/2.1 A/AA + 320/390px overflow →
>   **0 violations, 0 overflow**. Found + fixed **1 real bug**: the dark-mode
>   `.mktg-page` remap `text-slate-950 → var(--t1)` also flipped the *emerald CTA*
>   on every `/features/[slug]` page, putting light `#e2e8f8` ink on `#10b981`
>   at **2.06:1**. Added a guard so dark ink ON a saturated brand background stays
>   dark (slate-950 on emerald-500 ≈ **7.9:1**) — the remap still applies on page
>   surfaces, where it's correct.
> - **Supabase-backed routes — cannot be browser-audited here** (no DB in sandbox,
>   per the hard-limits note above), so they got the *static* equivalent: the
>   **theme regression guard now covers** `campaigns`, `donors`, `matching`,
>   `sponsor`, `volunteer`, `events`, `grants`, `impact` (was dashboard/donor/
>   profile only). Verified non-vacuous by planting a violation — the guard fails
>   on it. These dirs were otherwise already literal-free; the one hit,
>   `/campaigns/[slug]/embed`, is a **standalone iframe widget** that renders its
>   own `<html>`/`<body>` and never inherits `data-theme`, so its fixed light
>   palette is intentional → marked `theme-keep` with a rationale comment.
>
> _Evidence: 1028/1028 tests, `next build` green, browser audit 0/0._

## 🔒 CLAIM — Session 2026-07-24 (Claude — campaign creation journey friction audit)

> **✅ CLAIM RELEASED 2026-07-24 — all work merged to `master`. Area is FREE.**
> Was: the public fundraiser creation journey (`apps/web/app/create/**`,
> `lib/campaign-draft.ts`, `lib/campaign-readiness.ts`, `lib/wizard-steps.ts`,
> `app/api/campaigns` create-path handlers).
> Nothing is in flight; no open branches or PRs from this session. Anyone may
> pick up the remaining F8/F10 items below.
>
> ⚠️ **Collision worth learning from:** a parallel agent independently shipped
> the same story/goal step-validation fix (`a42c8b0`) that this session shipped
> in PR #61 — duplicated effort despite the claim. The two turned out to
> *compose* rather than conflict (early friendly validation in `goNext` + a
> jump-to-the-owning-step backstop in `submitCampaign`), and master is green,
> but the claim was clearly not seen. **Claim earlier and louder, or check
> `git log origin/master` before starting.**
> Findings + fixes are appended under this heading as they land.

### Deep-dive findings (in progress)

**Method:** read the full journey end-to-end — `/create/choose-path` → `/create`
wizard (9 steps: type → category → location → story → title → goal → media →
payout → summary → live) → `/api/campaigns` publish, plus draft autosave,
funnel analytics, guest gate, and payout linkage.

**What is already strong (do NOT regress):**
- Co-equal AI vs guided entry (`/create/choose-path`) with honest time estimates.
- localStorage autosave + "resume your draft" banner with age label + 7-day TTL.
- Builder funnel analytics (`enter`/`advance`/`abandon`/`publish` → `campaign_builder_events`).
- Payout is **optional to publish** — removes the historically biggest drop-off.
- Title is AI-seeded (never an empty field) and editable.
- Upload validation (type/size/count), blob-URL cleanup, escape-to-close modals.

#### 🔴 FIXED THIS SESSION
1. **DATA LOSS — Google sign-in mid-wizard destroyed uploaded images.**
   The OAuth bounce parked only `{savedForm, savedStep}` in sessionStorage, so on
   return `uploadedImages` was empty; the `[uploadedImages]` effect then *wiped*
   `form.coverImageUrl` to `''`. The localStorage draft (which had the images)
   was also suppressed because `cm_wizard` takes precedence. Double loss.
   → Bounce payload now carries `savedImages` + `savedStoryMode`; restore is a
   single shared `restoreBounce()` used by both the guest and authed branches.
2. **Drafts were device-local only — no cross-device resume.** (100%-Supabase gap)
   → New `campaign_wizard_drafts` table (owner-scoped RLS, anon+cookies client so
   Postgres enforces ownership — *not* service role). Draft mirrors to Supabase on
   autosave for signed-in users; on load the **newer** of local/remote wins
   (`pickFreshestDraft`, ties break toward the copy that still has images).
   Cleared on publish so a live campaign never resurfaces as "resume draft".
3. **Publish-time-only validation bounced users backwards.** Story ≥20 chars and
   goal ≥$1 were only enforced on the final Publish click, several steps away
   from where they're entered.
   → Now validated at the step that owns them, phrased as guidance not failure
   ("…or leave it empty for now and finish it later"), preserving the
   skip-and-return-later flow.

#### ✅ F4–F7, F9 SHIPPED (second pass — PR #62)
- [x] **F4 — SHIPPED (PR #62).** `type`/`category`/`location` were 3 near-empty
  taps before the organizer wrote a word; merged into one **Basics** screen →
  guided path is now **7 steps, not 9**, with "about N min left" in the header.
  Step model extracted to `lib/wizard-steps.ts` (pure + tested).
  `normalizeStep()` maps retired keys forward so **drafts saved mid-flight before
  the merge still resume** instead of landing on an empty screen.
  `ReadinessStep` deep-links updated to match.
- **F5 — goal set with no reference point.** New `/api/campaigns/goal-guidance`
  derives an honest suggested range from **real comparable campaigns** in the
  category (interquartile band of live goals + actual goal-hit rate), read
  through the anon+cookies client so RLS decides visibility. Withheld entirely
  below 5 comparables — no invented ranges. Goal step shows the band, the hit
  rate, and one-tap "Use $X" chips.
- **F6 — guest gate was unexplained.** Mid-wizard the modal now reads "Save your
  progress" and names the benefit (kept across devices, stays private until you
  publish, free) instead of the wrong "Continue to your dashboard".
- **F7 — `abandon` over-counted.** `beforeunload` also fires on ordinary
  same-origin navigation, inflating the abandon rate; in-app link clicks now mark
  the unload intentional. **Funnel abandon numbers before this fix are overstated.**
- **F9 — raw API/database strings shown mid-publish.** `describePublishFailure`
  maps failures to plain language + a next action, flags retryable vs terminal,
  and always reassures that work is saved.

#### ✅ F8 + F10 SHIPPED — the friction backlog is now COMPLETE
- [x] **F8 — multi-draft.** `campaign_wizard_drafts` was keyed on `user_id`, so
  starting a second campaign silently overwrote the first. Re-keyed onto a
  surrogate `id` (existing rows preserved and backfilled with a title), giving
  each organizer up to `MAX_DRAFTS_PER_USER` (20) in flight. New picker lists
  every draft with its step/photo count/age and offers Continue, Delete, and
  "Start another campaign". Autosave now targets the active draft id, and
  publishing deletes **only that draft** — the others survive. RLS unchanged and
  still owner-scoped; the API also filters on `user_id` explicitly so a wrong id
  can never touch another user's row.
- [x] **F10 — donor-view preview.** The old preview was desktop-only and told
  organizers nothing about whether the page was *convincing*. Now defaults to a
  **phone frame** (where most donors actually land), the donate button is
  visibly disabled and labelled, and a "How this looks to a donor" panel scores
  six things donors really evaluate (cover photo, specific title, complete
  story, set goal, named beneficiary, more than one photo) — each failing item
  explains *why a donor cares* and deep-links to the step that fixes it.



### 📌 STATUS as of 2026-07-24 end of session (Claude)

**All work merged to `master` and deployed to production.** Four PRs:

| PR | Shipped | Merge |
|----|---------|-------|
| #59 | Marketing OS: goal-based marketing, Command Center, Opportunity engine | `ac385e0` |
| #60 | Goal → multichannel campaign generation | `34aacfd` |
| #61 | Sign-in image data-loss fix, Supabase cross-device drafts, per-step validation | `dfe069e` |
| #62 | 7-step wizard (F4), goal guidance (F5), gate copy (F6), funnel accuracy (F7), publish copy (F9) | `b86cf55` |

**Master health at handoff:** typecheck clean · lint clean ·
**1022 tests / 85 files passing** · `next build` compiles · CI green on every merge.

**New Supabase tables this session** (all with migrations + RLS):
`marketing_goals`, `marketing_opportunities`, `marketing_campaign_plans`,
`marketing_campaign_plan_assets` (service-role only — admin data);
`campaign_wizard_drafts` (**owner-scoped policies** — user data, read/written via
the anon+cookies client so Postgres enforces ownership).

#### ⚠️ Two things the next person must know
1. **Funnel discontinuity.** Builder `abandon` counts recorded *before* F7 are
   inflated by ordinary in-app navigation. Do **not** compare pre/post F7 numbers
   as a like-for-like baseline — some of the improvement is the bug fix.
2. **F4 changed what organizers see** (9→7 steps) and shipped without human
   review of the preview. It is an isolated commit in PR #62 and can be reverted
   cleanly if the reshaped flow is not wanted.

#### Remaining, unclaimed
- **F8** — multi-draft support (one wizard draft per user by design today).
- **F10** — donor-view preview before publish (**higher value of the two**: it is
  the last confidence gap before an organizer commits).
- Marketing OS backlog is untouched and still ranked in
  `docs/marketing-os/MASTER_SPEC.md` (multi-tenant scoping, approval engine,
  brand constitution, AI agents, external connectors, experiments/attribution).

## Session 2026-07-26 (Codex - global banner recovery and dynamic copy)
- [x] Reproduced the production save failure: Supabase returned `PGRST205` because `banner_settings` had not been applied, while the existing announcement feed remained available.
- [x] Added an idempotent recovery migration plus rollback script, service-role-only access, editable title/message/link fields, and a content revision trigger so new copy is not hidden by stale visitor dismissals.
- [x] Added the Banner text editor immediately after Live preview and wired its validated values through the super-admin API, Supabase row, cached root layout, and public banner renderer.
- [x] Ran the migration against the live schema inside a rollback-only transaction: show/hide, copy persistence, safe link, and revision increments passed; a post-rollback REST probe confirmed no production change remained.
- [x] Verified focused banner tests 15/15, zero-warning lint, typecheck, all 1,163 tests, and the 149-page production build.
- [ ] Merge through the protected-main PR, apply the verified migration in the release workflow, and confirm the production Save/show/hide/text flow.

## Session 2026-07-26 (Codex - full SQL/live Supabase reconciliation)
- [x] Inventoried all 104 SQL files: 87 migrations, 2 rollbacks, 11 seed files, and 4 schema/recovery/generator artifacts.
- [x] Compared live Supabase tables, columns, functions, RPCs, indexes, triggers, policies, RLS, seed targets, and migration history with the repository.
- [x] Found and corrected 12 duplicate migration versions plus one invalid eight-digit migration version.
- [x] Added migration coverage for six live tables that previously existed only out of band.
- [x] Added a test that rejects duplicate/invalid migration versions and PostgREST table usage without migration coverage.
- [x] Verified the exact nine-migration pending set against live Supabase in a rollback-only transaction with postcondition checks.
- [ ] Merge PR #74, baseline the 78 verified historical versions, apply the nine pending versions, and rerun the live 150-table/catalog audit.

## 🔒 CLAIM — Session 2026-07-25 (Claude — production-readiness sweep)

> **AREA CLAIMED:** `.github/workflows/ci.yml`, `apps/web/e2e/**`, `middleware.ts`.
> Branch `claude/prod-readiness-sweep`. Other bots: please avoid these files.
> Free for others: `app/create/**` (F4–F10 all shipped), marketing OS, payments, tax.

### 🔴 FINDING 1 — the e2e suite gated nothing (FIXED)
`playwright.config.ts` + 4 spec files exist and work, but **no CI workflow ran
them**, so nothing verified the public surface before a production deploy.
Root causes found by actually running the suite (not by reading it):
1. **Two sweeps depended on seeded data.** `/campaigns/security-header-fixture/embed`
   resolves a real `campaigns` row → 404s on a placeholder DB → failed the whole
   sweep. Now probed once and skipped when absent (`e2e/data-routes.ts`), so a
   seeded env still gets full coverage and CI gates on everything else.
2. **Per-test timeout was far too tight.** Each sweep walks ~36 routes in ONE
   test; Supabase-backed pages cost ~7s each against a placeholder host, so the
   30s cap tripped on slowness, not on defects. Raised to 600s for the sweeps only.
→ New `e2e` job in `ci.yml`: installs Chromium, builds with the same placeholder
  Supabase env as the build job, runs both projects (chromium + mobile), and
  uploads the Playwright report as an artifact on failure.

### 🟡 FINDING 2 — page-level Supabase queries have no timeout
Measured on a production build with an unreachable Supabase host:
`/pricing` 89ms, `/security` 73ms, `/terms` 726ms (no DB) vs **`/faq` 7108ms**
and **`/grants` 7106ms** (DB-backed). The stall is per-page data fetching, and it
scales with how many DB-backed pages a visitor touches.
**Severity: conditional.** With a healthy Supabase this never fires — it is not a
live outage. But there is no ceiling, so a degraded Supabase degrades page loads
without bound instead of falling back to an empty/error state.
**Not fixed here** — a real fix means auditing every server-component query and
deciding per-page fallback behaviour, which is its own reviewable change.

### ⚠️ CORRECTION — recorded so nobody repeats the wrong diagnosis
I first attributed the ~7s to `middleware.ts` awaiting `supabase.auth.getUser()`
on every non-API request. **That was wrong.** Evidence: `/pricing` returns in
89ms through the same middleware, and the `X-Auth-Refresh: timeout` header never
appeared — middleware resolves fast even against a placeholder host.
The `AUTH_REFRESH_TIMEOUT_MS` (3s) guard added to `middleware.ts` is **kept on its
own merits** — an unbounded auth round-trip in the hot path of every page is worth
capping, and it fails SAFE (a timeout is treated as "not signed in", so protected
routes redirect to login rather than being served). It is **not** the fix for
Finding 2 and must not be described as such.


### ⚠️ Collision #2 (2026-07-25/26) — e2e-in-CI was solved twice, concurrently
A parallel agent wired e2e into CI at the same time as this session, choosing a
**narrower** scope: smoke + security-headers only, chromium only, as steps inside
the `verify` job — on the stated assumption that `public-routes` and
`public-quality` "hit Supabase-backed pages and need real credentials, so they'd
be flaky against the placeholders."

**That assumption was tested and is false.** Those sweeps failed for two fixable
reasons, both now fixed: one route needed seeded data (probed and skipped via
`e2e/data-routes.ts`) and each sweep walks ~36 routes inside ONE test so the 30s
cap tripped on slowness, not defects (now 600s for the sweeps only).
**All four specs pass against the placeholder env on chromium AND mobile: 16/16
verified locally.** The merge keeps the superset as its own `e2e` job and removes
the duplicated in-`verify` steps so the suite does not run twice.
Please don't re-narrow it without re-running it first.

**Process note:** master moved from `4a4b536` → `d51208ed` during a single
session's work (agents pushing straight to master), and the resulting conflict
left PR #73 `mergeable_state: dirty` — GitHub then ran **no** workflow at all,
which looks exactly like "CI is slow". Check `mergeable_state` before assuming a
queue delay.

### ✅ FINDING 3 — auth-gated surfaces had zero e2e coverage (FIXED)
The entire dashboard + admin surface — the whole security boundary in
`middleware.ts` — had **no browser coverage**. A regression that opened up
`/admin` or `/dashboard` to an unauthenticated visitor would have shipped
silently, because unit tests do not exercise middleware.

New `e2e/auth-gates.spec.ts` (5 tests, verified passing) covers:
- every `PROTECTED` prefix **and deeper paths** under it redirect an
  unauthenticated visitor to `/login`;
- the `next` param preserves where they were heading (otherwise every gated
  visit dumps the user somewhere generic);
- `next` can never be an open redirect (relative, not protocol-relative, no `http`);
- `PUBLIC_EXCEPTIONS` (`/create/choose-path`) stay reachable pre-sign-in;
- protected **API** routes return 401/403 rather than redirecting — API paths are
  excluded from the middleware matcher, so each handler owns its own check, and a
  200 there is the exact class of bug that leaks data.

**Signing IN is still not covered** — that needs real Supabase credentials
(owner-gated, same list as the GoFundMe blockers). What is covered is the half
that matters for safety: no session ⇒ never served a protected page.

**The spec was mutation-tested, not just run green.** Removing `/admin` from
`PROTECTED` made it fail, so the gate has teeth.
*Bonus finding from that mutation:* the redirect assertion still passed with
middleware protection removed, because `/admin` pages **also** call
`requireAdmin()` server-side, which redirects to `/dashboard` → `/login`.
That is real defense-in-depth (two independent layers), and worth knowing: the
middleware is not the only thing standing between a visitor and `/admin`.

### ✅ FINDING 2 — page-level Supabase reads now have a ceiling (PARTIALLY FIXED)
Follow-up to Finding 2 above (the unbounded ~7s stall on DB-backed pages).

New `lib/query-timeout.ts` — `withQueryTimeout(work, fallback, ms)` gives a read
an explicit deadline and an explicit fallback, returning `{ data, degraded }`.
Deliberately scoped: it is for **reads with a sensible empty state** (a feed, a
list, a category strip) and explicitly **not** for writes, money totals, receipts
or auth decisions, where silently returning "nothing" would read as a real answer.
Rejections are treated like timeouts (an unreachable DB is not worth crashing a
render over) and the abandoned promise's later rejection is swallowed so it cannot
surface as an unhandled rejection — covered by a test, since a naive
implementation leaks exactly that.

Applied to the two homepage social-proof reads (`getRecentDonations`,
`getCategoryStats` in `lib/home-data.ts`): the highest-traffic page now renders
without its feed instead of stalling on it.

**Still open — the rest of the surface.** Every other DB-backed server component
remains unbounded. Each one needs a per-page judgement about what "degraded"
should look like, so it is deliberately not a blanket search-and-replace. Tracked
here rather than claimed as done. `lib/query-timeout.ts` (7 tests) is the tool to
finish it with.


### ✅ FINDING 2 (continued) — query ceiling rolled out to the public list reads
Added `boundedQuery(query)` to `lib/query-timeout.ts`: returns the query's own
resolved `{ data, error }` shape, synthesising supabase-js's failure shape on
timeout so a call site's **existing** error branch runs and no downstream code
changes. 10 tests.

Applied to **15 list reads** that already degrade to `[]`:
`leaderboard` (2), `events` (3), `grants-server` (1), `matching` (4),
`sponsorships` (4), `volunteers-server` (1).

**Deliberately NOT applied to 6 single-row reads** (`getEventBySlug` and
siblings in events/grants/matching/sponsorships/volunteers). Those return `null`
on error, and callers turn `null` into a **404** — so a transient timeout would
tell a visitor that a campaign/event/grant *does not exist*. That is worse than a
slow page, and it is cacheable/indexable. A first pass wrapped them by regex; the
audit caught it and they were reverted. **If you extend this rollout, check what
the caller does with the empty result before wrapping anything.**

Still unbounded beyond these: admin/dashboard reads and anything where empty
would be mistaken for a real answer (money totals, receipts, auth).

### 🔴 BLOCKER — GitHub Actions is not allocating runners (owner action needed)
As of 2026-07-26 ~13:05Z, **every** CI run fails in 2–5 seconds with no logs and
`runner_id: 0`, `runner_name: ""` — i.e. no runner is ever assigned, so the jobs
never execute. This is **repo-wide, not branch-specific**: master runs
`b615e539` (3s), `fc5852b5` (5s), `0a0b5040` (3s) all died the same way.
Today's run counter is already #458.

**Not a code failure.** Most likely an Actions spending limit / minutes quota, or
Actions disabled at account level. Check GitHub → Settings → Billing → Actions,
and Settings → Actions → permissions.

**Consequence:** the e2e gate added in #73 currently cannot run, and master's own
state is unverified by CI. Everything merged up to `fc5852b` (#73, #75) *did* pass
full CI first.

#### Workarounds attempted, and what they proved
- **Point the suite at a Vercel preview** — blocked: previews sit behind Vercel
  Deployment Protection and redirect to `vercel.com/sso-api`, so the suite sees the
  SSO wall, not the app. Needs protection disabled or a bypass token (owner).
- **Point the suite at production** (`www.charitme.com`, publicly reachable, 200) —
  6 specs "failed", but all 6 are **sandbox-proxy artifacts, not real defects**,
  verified directly:
  - auth gates are **correct in production**: `/admin`, `/dashboard`, `/create`
    each 307 → `/login?next=…`, and `/create/choose-path` is 200. ✅
  - all three smoke strings (`CharitMe`, `0%`, `Create My Fundraiser Now!`) **are
    present** in live HTML. ✅
  Conclusion: remote e2e from this sandbox is unreliable (the outbound HTTPS proxy
  breaks Playwright navigation); direct `curl` assertions are trustworthy.
- **`playwright.config.ts` improvement (kept):** the local `webServer` is now
  skipped when `PLAYWRIGHT_BASE_URL` names an external target. Previously it always
  booted a local server — and failed without a full Supabase env — so the suite
  could not be pointed at a deployment at all. That capability is now available for
  whenever protection/proxy constraints lift.

---

# 📊 CONSOLIDATED STATUS — 2026-07-26 (Claude, session handoff)

Written against the 20-point goal checklist. **Verified** = I ran it this session.
**Claimed** = an earlier doc/session asserts it; I did not re-verify. Treat the
difference as real: two audit ✅s turned out to be stale when I spot-checked them.

| # | Goal item | State | Basis |
|---|-----------|-------|-------|
| 1 | Every page audited | 🟡 partial | ~36 public routes swept by e2e (render + a11y + headers). **Auth-gated dashboard/admin pages are still unaudited** — signed-in e2e needs real Supabase creds (owner-gated) |
| 2 | Every feature works | 🟡 unproven | 1191 unit tests + 16 e2e pass, but neither exercises a signed-in journey or a real payment |
| 3 | Everything wired to Supabase | 🟢 mostly | All features I touched are wired. `donation_receipts` is **dead schema** (superseded by `tax_receipts`, which is wired) — see Finding below |
| 4 | ≥100 seed records per feature | ⚪ claimed | Earlier session: "73 non-empty tables, every feature ≥100". **Cannot verify from sandbox** — no Supabase creds, no Docker |
| 5 | Every image unique, 0 duplicates | 🔴 **CLAIM IS FALSE** | Re-verified 2026-07-26: **10 photos are shared across categories**, one across **15 of 18**. See finding below |
| 6 | Frictionless UX | 🟢 improved | F1–F10 all shipped (see the friction backlog): 9→7-step wizard, cross-device drafts, multi-draft, donor preview, goal guidance, honest gate copy, real publish errors, image data-loss fix |
| 7 | Dark/light mode everywhere | ✅ **now verified + guarded** | Re-verified 2026-07-26: guard covered only 12 of ~37 user-facing dirs; `create` and `features` had drifted. 6 values fixed, guard widened to every dir |
| 8 | Mobile responsive | ✅ **verified** | Re-verified 2026-07-26 across **36 pages × 3 viewports × 2 themes = 216 loads, 0 findings** (audit previously covered only 17 pages) |
| 9 | Pages load FAST | 🟡 improved | **Real finding:** DB-backed pages had NO timeout — measured ~7.1s (`/faq`, `/grants`) vs 73–726ms without DB. 15 public list reads now bounded (`lib/query-timeout.ts`). **Dashboard/admin reads still unbounded** |
| 10 | Roles clearly mapped | 🟡 **mapped, but only 2 of 6 are enforced** | `lib/role-capabilities.ts` is wired into 3 surfaces. But `donor`/`organizer`/`beneficiary`/`nonprofit` have **0 enforced capabilities** — see finding |
| 11 | 100% GoFundMe parity | 🟢 claimed-closed | `docs/charitme-gofundme-audit.md` matrix is all ✅. Its 4 remaining blockers are **owner-gated credentials**, not code |
| 12 | Better than GoFundMe | 🟢 | 0% platform fee, AI builder, Marketing OS (goals→opportunities→campaigns), grants, matching, volunteers, events, gamification, impact tracking — none of which GoFundMe has |
| 13 | Accessibility passes | 🟡 **34 of 36 routes clean, enforced** | axe A+AA over 36 routes × both themes. **2 branded marketing pages have real contrast failures** (`/features`, `/ai-fundraising`), baselined + visible. Was **no axe dependency at all** before |
| 14 | All payment methods work | 🔴 owner-gated | Needs Stripe **live** keys + a real charge. ADR-0003. Cannot be done from sandbox |
| 15 | Performance optimized | 🟡 | Earlier: query-waterfall + N+1 audits, `getUser()` memoised, home 63→88. Plus item 9 above |
| 16 | Security resolved | 🟢 improved | **New this session:** auth-gate e2e (mutation-tested), middleware auth-refresh ceiling that fails safe, owner-scoped RLS on 2 new tables. Production gates verified live by curl |
| 17 | Tests pass | ✅ verified | **1191 unit tests / 108 files green on master.** 16/16 e2e green (last successful CI run) |
| 18 | Build succeeds | ✅ verified | `next build` compiles on master; Vercel production deploys succeeded all session |
| 19 | todo.md updated | ✅ | This document |
| 20 | Commit after each feature | ✅ | 5 PRs merged to production this session: #73, #75, #76 (+#59/#60/#61/#62 earlier) |

## 🔴 THE ONE THING BLOCKING EVERYTHING ELSE
**GitHub Actions is allocating no runners, repo-wide** (since ~13:05Z). Every run —
master included — dies in 2–5s, no logs, `runner_name: ""`. Almost certainly an
Actions minutes/spending limit; today's counter passed #458 with several agents
pushing. **Owner action: GitHub → Settings → Billing → Actions.**
Until it clears, the e2e gate added in #73 cannot run and nothing can be
CI-verified. PR #76 was merged on local + Vercel evidence with that stated in the
merge commit.

## Owner-gated items no amount of bot looping can close
1. Stripe **live** keys → real payment verification (item 14)
2. **Resend** API key → email delivery verification
3. **Supabase production** URL/keys → apply migrations, verify seed counts (item 4), signed-in e2e (items 1, 2)
4. **Stripe KYC** → identity verification
5. **Vercel Deployment Protection** → blocks pointing e2e at preview URLs (previews redirect to `vercel.com/sso-api`)
6. **GitHub Actions quota** → the blocker above

## Next highest-value work (unclaimed, in order)
1. [x] **Degraded-state UI — /dashboard/campaigns DONE.** The bug was worse than
   predicted: `fetchCampaigns` returned `[]` on error, so a failed load showed an
   organizer **"no campaigns" AND $0 raised / 0 donors** — i.e. "your money is
   gone" — for someone whose fundraiser is live. Now returns
   `{ campaigns, failed }`, the query is bounded, metrics render `—`/"unavailable"
   instead of a confident zero we do not know, and a `role="alert"` banner says
   nothing happened to their campaigns or funds.
   **[x] Remaining pages DONE (Claude, 2026-07-26) — the sweep found the anti-pattern
   was broader than a `catch`.** The grep-for-`return []`-in-a-catch hint only finds
   half of it: **supabase-js resolves rather than throws on a query error**, so a
   timeout / RLS denial / dropped column never reaches the `catch` at all — it
   arrives as `data: null` and silently reduces to 0. Every fix below therefore had
   to check the `error` field, not just wrap in try/catch.
   - **`/dashboard` (organizer home — the worst instance, higher traffic than
     /dashboard/campaigns).** `getDashboardData` destructured only `data` from the
     campaigns query and had a `fallback` of all-zeros, so a failed read greeted a
     funded organizer with **$0 Total Raised, 0 Donations, 0 Supporters, no
     campaigns, and the "Create your first campaign" onboarding checklist**. Now
     carries `failed`, checks `campaignError`, renders `—`/"unavailable" across all
     4 metric cards + all 4 performance numbers, swaps the misleading task list, and
     shows the same role="alert" banner.
   - **`/admin/super` (owner console).** `count()` and `countAdmins()` returned 0 on
     failure → "Total users 0 / Campaigns 0 / Donations 0", which during an incident
     reads as total data loss on the one screen an owner checks first. Now
     `number | null` → `—` per stat + an alert saying `—` means unknown, not zero.
   - **`/dashboard/settings`.** Active-campaign count fed the plan-limit meter; 0 on
     failure understated usage. Now nullable through `PlanFeaturesCard` and
     `SettingsClient` (bar renders empty, `atCampaignLimit` cannot fire on unknown).
   - **`/dashboard/integrations`.** Empty-on-error invited a user to reconnect a
     provider they were **already** connected to. Now reports the failure instead.
   - **Regression guard:** `__tests__/degraded-reads.test.ts` (8 tests) pins the
     contract for all 3 totals pages — error field checked, no bare
     `const { data } = await supabaseAdmin`, `—` present, `role="alert"` present.
   - **Found en route — real user-visible bug, unrelated to the above.** The
     dashboard greeting rendered the literal text **`&var(--green-dark);`**: the
     CHAR-0015 theme sweep (`5c30b8a`) mistook the digits in the entity `&#128075;`
     (👋) for a hex colour and rewrote them into a CSS `var()`, producing an invalid
     entity that JSX passes through verbatim. Restored, and the test file guards the
     whole class (`&var(--` anywhere in app/components/lib) — verified non-vacuous,
     it caught my own comment on the first run.
   - Verified: typecheck 0, **1206 tests / 110 files pass**, `next build` green.

   **Duplicated work — three of these pages were fixed twice, in parallel, by two
   bots** (`/dashboard`, `/dashboard/donations`, `/dashboard/analytics`,
   `/dashboard/donor`). The implementations were functionally identical and differed
   only in flag name (`failed` vs `loadFailed`); resolved by hand to the shared
   `DegradedReadNotice` version. **Root cause: this list said "unclaimed" and named
   the exact files, but nobody marked them in-progress before starting.** Claim a
   line here *before* you write code, not after.

   **Two bots fixed `/dashboard` concurrently** (this note and the one above were
   written in parallel); the implementations were merged by hand into a single
   required `failed` flag. **Also corrected:** the anti-pattern is mostly expressed
   as `(data ?? [])`, **not** `catch → return []`, so grepping for `catch` misses
   it — grep for `?? []` on any page that derives totals.
   - [x] `app/dashboard/donations/page.tsx` — DONE. It *did* check `campError`, but
     collapsed it into `campError || !campData || campData.length === 0` — i.e. a
     failed read was indistinguishable from "no campaigns". Split apart: an error
     returns `failed: true`, a genuinely empty list still returns honest zeros.
   - [x] `app/dashboard/analytics/page.tsx` — DONE. Neither read checked `error`.
     All 4 metric cards now render `—`/"unavailable".
   - [x] `app/dashboard/donor/page.tsx` — DONE. Same conflation as donations
     (`campError || !campData || campData.length === 0`), plus `catch → empty`.
   - **Shared `components/DegradedReadNotice.tsx`** extracted rather than a 6th copy
     of the banner JSX. **Gotcha it encodes:** `title="…&apos;…"` does NOT decode —
     entities are only decoded in JSX *children*, not in string attributes, so the
     title must be an expression or the apostrophe renders as literal `&apos;`.
   - Guard extended: `__tests__/degraded-reads.test.ts` now pins all **6** totals
     pages (16 tests) and accepts either an inline `role="alert"` or the component.
   - Verified: typecheck 0, lint clean, **1214 tests / 110 files**, `next build` green.

   **Gotcha, now fixed:** `__tests__/migration-integrity.test.ts` scanned for
   `.from('<literal>')` **including inside comments**, so the JSDoc example in
   `lib/query-timeout.ts` failed the suite. The scanner now strips block comments
   (commit `7719702`) — JSDoc examples are safe again.
2. [x] **Re-verify the ⚪ claimed rows — `donation_receipts` half DONE (Claude,
   2026-07-26). The "assume rot" instinct was right, and the rot was worse than
   "dead table".**
   - **`donation_receipts` confirmed dead:** defined in
     `20260609000000_gofundme_audit_gaps.sql` with `receipt_number`,
     `email_sent_at`, `resent_at` — purpose-built to record issued receipts — and
     **0 rows in production**, referenced by no application code.
   - **🔴 The admin "Send receipt" button sent no email at all.**
     `/api/admin/donations/[id]/receipt` stamped `receipt_sent_at`, inserted an
     audit-log entry `donation.receipt_sent`, and returned ok — with **no send in
     the route**. The console then displayed *"A donation receipt has been sent to
     {donorName}."* So a **tax document the donor never received was recorded as
     delivered, in the audit log that exists to evidence delivery.** Worse than a
     no-op: it manufactured false compliance evidence.
   - **🔴 The donor-facing route emailed the wrong person.**
     `/api/donations/receipt` loaded `profiles` for `user.id` — the *requester* —
     not `don.donor_id`. On the admin path the receipt went **to the admin, under
     the admin's name**, and the donor got nothing.
   - **Root enabler:** `sendReceiptEmail` returned `void` and `return`ed early when
     `RESEND_API_KEY` was unset, so **no caller could tell a delivered receipt from
     a dropped one**. Now returns `{ sent: boolean }`; both routes bail with 502
     `EMAIL_UNAVAILABLE` instead of claiming success (the admin client already
     surfaces the server's message, so no client change was needed).
   - **Now:** send first → only then stamp `receipt_sent_at`, write the audit log,
     and **write the `donation_receipts` ledger** (insert with `email_sent_at`,
     `resent_at` on a resend). Offline donations use `offline_donor_email`;
     a donation with no contact detail returns 422 `NO_RECIPIENT` rather than
     recording an undeliverable receipt. Authorization moved from a raw
     `roles.includes('admin')` to `isAdmin()` — the raw check missed hardcoded owner
     emails, `ADMIN_EMAILS`, and super admins without `admin`.
   - **All 17 ledger columns + `campaigns.nonprofit_verified` +
     `donations.receipt_sent_at` verified to exist in the LIVE schema** (read-only
     PostgREST probes) before shipping the insert.
   - `is_tax_deductible` is taken from `campaigns.nonprofit_verified`, never the
     donor's `nonprofit` role — consistent with `lib/role-capabilities.ts`.
   - Guard: `__tests__/donation-receipts.test.ts` (10 tests) — including a real
     behavioural one (`sendReceiptEmail` returns `{sent:false}` with no transport,
     with a non-vacuity check that `resend` is actually null) plus ordering asserts
     that the send precedes the stamp and the audit write.
   - Verified: typecheck 0, lint clean, **1229 tests / 111 files**, build green.
   - **Second stale ✅ — *"e2e wired but running in no workflow"* — now CLOSED
     (Claude, 2026-07-26).** A teammate had already added the `e2e (playwright)`
     job to `.github/workflows/ci.yml`, so the workflow gap itself is fixed — but
     **no one had seen it pass**, because GitHub allocates no runners right now
     (see the pipeline block at the end of this file). Ran it locally against a
     production build instead: **26/26 passed in 48s — chromium AND mobile (Pixel 5)
     across auth-gates, public-quality, public-routes, security-headers, smoke.**
     Command: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright
     test` from `apps/web` (the config's `webServer` boots `npm start` itself).
     **Caveat, stated rather than papered over:** the sandbox has no database, so
     DB-backed routes render their empty state — this proves the suite is green and
     the security/auth/header behaviour holds, not that seeded data renders.
3. **Signed-in e2e** the moment test credentials exist.

### 🔴 MASTER IS FAILING THE NEW a11y E2E — Claude, 2026-07-26 (my half FIXED, **contrast half is Codex's lane**)
The `e2e/accessibility.spec.ts` spec added to master (axe, WCAG A/AA, light+dark ×
chromium+mobile) **fails on master**. Nobody had seen it because GitHub allocates
no runners — I only found it by running the suite locally. **Run it before assuming
master is green:** `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx
playwright test e2e/accessibility.spec.ts` from `apps/web`.

**FIXED by me (roles/ARIA — my lane): all 3 `aria-prohibited-attr` violations.**
`aria-label` was set on bare `<div>`s, whose implicit `generic` role does not
support an accessible name, so the label was **discarded by assistive tech** — the
loading skeletons announced nothing at all. Added the roles that permit naming:
`role="status"` on the 7 loading skeletons (`components/ListPageSkeleton.tsx` +
`donor`/`admin`/`dashboard`/`donors[id]`/`campaigns`/`leaderboard` `loading.tsx`),
`role="group"` on the home example-search chips, `role="region"` on the home
stories track. Verified: those violations are gone from the axe run.

**ALSO FIXED by me (keyboard, not colour): `scrollable-region-focusable` on
`/fast-payouts`.** `.fp-table-wrap` scrolls horizontally on narrow screens but had
no `tabIndex`, so a keyboard-only user could not scroll it — the right-hand columns
were simply unreachable (WCAG 2.1.1). Now `tabIndex={0}` + `role="region"` + a name.
**Codex fixed this same element concurrently** (third collision today) — resolved to
their copy, with one change: their suppression was **file-level**
(`/* eslint-disable ... */` at line 1), which would also hide a future `tabIndex` on
a genuinely non-scrolling element in that file. Narrowed to a single
`eslint-disable-next-line`. **Two gotchas if you hit this elsewhere:**
1. `jsx-a11y/no-noninteractive-tabindex` and axe genuinely conflict here — axe wins,
   because the element really does scroll. Suppress the rule, don't drop `tabIndex`.
2. **`eslint-disable-next-line` does NOT work on a multi-line JSX element** — ESLint
   reports the `tabIndex` *attribute's* line, not the opening tag's, so the directive
   misses. Keep the element on one line (verified: rule fires again if you don't).
(11 other `overflow-x: auto` rules exist in globals.css — each of those wrappers may
need the same treatment; **not yet audited**.)

**🔵 HANDOFF TO CODEX — the ONLY remaining failures are `color-contrast`, the theme
lane you own. I have not touched them (lane split).** Re-run after your latest
contrast work narrowed it from 4 failing projects to 2 — `/features`, `/pricing` and
the dark-mode home stat have **cleared**. Still failing, light mode only:
- `/` — `.home-hero-cta > .home-btn-ghost.home-btn[href$="campaigns"]`
  (**`.home-btn-ghost` is the component**; it moves with scroll-reveal so the exact
  selector varies between runs — it has also reported as `.home-head-cta`)
- `/transparency` — `div[role="group"] > .mc-choice[type="button"]:nth-child(1)`
Current score: **e2e 28 passed / 2 failed** (was 26/4). Until these two clear, the
e2e job cannot pass regardless of the runner situation.

### ✅ DONE — Claude, 2026-07-26 — **volunteer applications went into a black hole** (was CLAIM)
Tracing why `volunteer_profiles` (1131 live rows) is read by nothing turned up a
broken end-to-end feature, not just an unused table:
- A volunteer **can** apply — `/api/volunteers/opportunities/[id]/apply` is sound
  (accepts UUID *or* slug, idempotent, capacity-checked) and the apply button works.
- The volunteer **can** track/withdraw their own applications at
  `/dashboard/volunteer`.
- **The organizer has no way to see who applied, or to accept/decline.**
  `/api/volunteers/applications/[id]/decision` exists and is implemented — and
  **nothing in the entire UI calls it** (grepped `app/` + `components/`). So every
  application submitted sits unread and unanswerable through the product.
- And the **1131 `volunteer_profiles`** (headline, bio, skills, interests,
  availability, remote_ok) that would tell an organizer whether an applicant fits
  are displayed nowhere.
**Shipped:** organizer-facing applicant review.
- **`GET /api/volunteers/applicants`** — applications made TO your opportunities.
  Authorization is by ownership applied to the *opportunity* query first, so the
  applications query is filtered by ids you own and cannot leak another org's
  applicants even if that filter were wrong. Batched profile lookups (no N+1),
  bounded `.limit(500)`.
- **`VolunteerApplicantsClient`** on `/dashboard/volunteer`, under a new
  "Applicants to your opportunities" section: pending vs decided, applicant skills
  and availability, their message, and Accept / Decline / Mark-completed wired to
  the previously-uncalled decision endpoint.
- **Privacy call made explicitly:** `volunteer_profiles.is_public` is the
  volunteer's choice about being *discoverable*. An organizer they applied to still
  needs skills/availability to judge the application, so those show either way —
  but a private profile's free-text **bio is withheld**, since that is the part
  written for a public audience.
- Degrades honestly (a failed load says so and states no applications were lost)
  rather than rendering "no applicants".
- 11 tests in `__tests__/volunteer-applicants.test.ts` — including a guard that
  **the decision endpoint has at least one UI caller**, which is precisely the
  regression that made this feature dead.
- Live shapes verified read-only first: **240 applications, 1131 volunteer
  profiles**, all column names matched before shipping.
- Verified: typecheck 0, lint clean, **1258 tests / 113 files**, build green.

**Seed-quality note for whoever owns seeding:** every `volunteer_profiles` row I
sampled is identical — headline "Passionate volunteer", skills
`['communication','logistics']`, availability "Weekends". 1131 identical rows
satisfy "≥100 seed records" numerically but exercise nothing (no filtering, no
matching, no ranking). Same likely applies to other bulk-seeded tables.

### 🔴 FINDING — Claude, 2026-07-26 — **4 tables are SEEDED but read by NO code**
This one undercuts a goal criterion, so read it before ticking "≥100 seed records
per feature" again. Cross-referenced all **150 tables declared in migrations**
against every `.ts/.tsx/.mjs` file, then took live row counts:

| Table | Live rows | Read by app code |
|---|---|---|
| `volunteer_profiles` | **1131** | ❌ nothing |
| `coach_sessions` | **500** | ❌ nothing (only a DDL string in apply-schema) |
| `event_tickets` | **240** | ✅ **now wired — see below** |
| `grant_documents` | **240** | ⛔ deliberately not wired — see below |

**SWEEP CLOSED (Claude, 2026-07-26) — every one resolved, with a reason:**
- `event_tickets` → **wired** (paid tiers now shown on every event page).
- `volunteer_profiles` → **wired** (shown to organizers reviewing applicants).
- `grant_documents` → **deliberately left unwired.** Every `file_url` is
  `https://example.org/docs/N.pdf`. Wiring it would ship 240 broken downloads and
  let us tick "wired to Supabase" for a feature that fails on click. Needs real
  files first.
- `coach_sessions` → **not worth wiring as designed.** The table stores only
  `user_id, campaign_id, message_count` — a usage *counter*, not a conversation
  store, so reading it gives a user nothing and its 500 seeded rows are meaningless
  counters. Either extend it to hold messages (real feature: coach memory across
  sessions) or drop it. Recorded rather than half-wired.
- The other 18 unreferenced tables are empty *and* unread — unbuilt features, not
  broken ones.

**Placeholder-data sweep (read-only, 11 public-facing tables, up to 300 rows each):**
only `fundraising_events.virtual_url` (120) and `grants.application_url` (240) leaked
RFC 2606 domains into the UI — both now guarded. `campaigns`, `volunteer_opportunities`,
`sponsorship_opportunities`, `matching_programs`, `nonprofit_profiles`,
`campaign_updates` are **clean**. `profiles.email` has 7 `example.com` seed accounts,
which is normal for test users and is not rendered publicly.

The seed suite counted these rows as coverage, but **no page or API queries them**,
so they prove nothing about the features working. 18 further tables are unreferenced
*and* empty (`auction_items`, `auction_bids`, `livestreams`, `giving_days`,
`donor_segments`, `api_keys`, `platform_fees`, …) — those are unbuilt features
rather than broken ones, which is a different problem.

### ✅ DONE — Claude, 2026-07-26 — **paid event tickets were invisible on every event**
`event_tickets` (title, price_cents, quantity_limit, sold_count) was seeded and
never read, while `RsvpPanel` hard-coded the CTA **"RSVP — it's free"**. Live check:
**120 of 120 published events have a PAID tier — and all 120 advertised themselves
as free, with no price shown anywhere.** For a fundraising platform that is a false
price claim on the whole events surface.
- `listEventTickets()` in `lib/events.ts` returns `{ tickets, failed }` — deliberately
  **not** `[]`-on-error, because an empty list renders as FREE and a timeout would
  silently re-create the original bug.
- Pure helpers in `lib/events-core.ts` (`ticketsRemaining`, `isTicketSoldOut`,
  `isEventFree`, `lowestTicketPriceCents`) — oversold tiers clamp to 0 rather than
  going negative.
- Event page now lists each tier with price, "N left" / "Sold out"; the CTA says
  "it's free" **only** when every tier is zero-priced, and a failed read shows a
  `role="alert"` warning instead of implying free entry.
- 14 tests in `__tests__/event-tickets.test.ts`.
- **NOT done, deliberately: buying a ticket.** Registration still takes no payment,
  so the panel now says so explicitly ("reserves a general-admission spot only")
  rather than pretending. A real purchase flow needs Stripe work on the live keys
  and owner sign-off per ADR-0003 — **next-best item on this line.**

### ✅ DONE — Claude, 2026-07-26 — **swept the whole "records success without doing the work" class**
The receipt bug above was not a one-off, so I checked every email path. **All nine
senders in `lib/email.ts` returned `Promise<void>` and `return`ed early when
`RESEND_API_KEY` is unset** — the shape that makes a dropped email
indistinguishable from a delivered one. All nine now return `{ sent: boolean }`.
Callers audited and fixed by what the record actually claims:
- **`/api/admin/donations/tax-receipt` — same defect as the donation receipt, on
  the IRS-facing document.** It upserted `tax_receipts` with `emailed_at` and wrote
  a `donation.tax_receipt_sent` audit entry regardless of delivery. Now returns 502
  before recording anything.
- **`/api/beneficiaries/invites/resend`** exists *only* to deliver an email and
  returned `ok` after `.catch(() => {})` swallowed the failure. Now 502.
- **`/api/beneficiaries/invites`** (create) keeps its 200 — the invite row and its
  token are the real artifact and stay valid — but now returns `emailed: boolean`
  so the UI can offer the link instead of claiming someone was contacted.
- **Checked and sound:** `/api/admin/donations/[id]/refund` really calls
  `stripe.refunds.create`; payout/refund/organizer-alert emails are notifications
  *after* the real action, so a failed send does not falsify the record.
- Guard: `__tests__/donation-receipts.test.ts` grew to 14 tests, including
  behavioural ones for `sendTaxReceiptEmail`/`sendBeneficiaryInviteEmail` and a
  blanket assert that **no sender in `lib/email.ts` declares `Promise<void>`**.
- Verified: typecheck 0, **1233 tests / 111 files**, build green.

### ✅ DONE — Claude, 2026-07-26 — **user-role mapping audit** (was CLAIM)
Claiming *before* writing code, per the duplicated-work incident above. Scope: the
goal's new criterion "each user role is clearly mapped out and different from the
others" — audit `lib/roles.ts` + every role gate, prove the roles are actually
distinct in what they can reach, and fix/document what isn't. **Touching:
`lib/roles.ts`, role-gated route guards, `docs/`, `__tests__/`.** Codex: please
take a different line.

**Result.** The descriptive half was already done by a teammate — `lib/role-capabilities.ts`
maps all six roles and, importantly, records honestly that **only `admin` and
`super_admin` gate anything**; `donor`/`organizer`/`beneficiary`/`nonprofit` are
labels, with real authorization coming from session+row-ownership,
`campaigns.nonprofit_verified`, and `profiles.status`. Not duplicated.

**Live role census (all 1,133 profiles, service-role read):** `donor` 1132,
`organizer` 58, `admin` 5, `super_admin` 1 — and **`beneficiary`, `nonprofit`,
`user`, `suspended`, `inactive` = 0**. So two of the six roles are held by nobody,
and the legacy status-in-roles markers the admin page still parses are unused live.

**What was actually broken — the admin console did not reflect that catalog:**
- **The role summary was computed, passed to the client as `_roles`, and never
  rendered.** The console had no answer to "who holds power here?" while still
  paying to compute it. Now rendered as a Roles table in the Users overview.
- That dead summary was also **wrong**: it labelled the `admin` row **"Super
  Admin"** (conflating 5 trust-and-safety accounts with the 1 account that can
  grant roles and change platform settings), gave `super_admin` and `beneficiary`
  no row at all, and counted the phantom `'user'` role. Now derived from
  `ROLE_ORDER`/`ROLE_DEFINITIONS`, so it cannot drift again.
- **`primaryRole` had no `super_admin` case** — an account granted *only*
  `super_admin` would render as **"Donor"**, the inverse of its power. Latent, not
  live (today's super admin also holds `admin`), but reachable: `isSuperAdmin()`
  honours the role alone and the roles console can grant it alone. Replaced with
  the shared catalog scan.
- **`rolePillColor` normalised `'Super Admin'` → `'Super admin'`**, missing its map
  entry, so the most privileged role fell through to the same grey as an unknown
  one. Keyed lowercase; Admin and Super Admin now read as visibly different.
- Guards added to `__tests__/role-capabilities.test.ts` (5 tests, verified
  non-vacuous): no phantom `'user'`, no non-super row labelled "Super Admin",
  summary+pills sourced from the catalog, distinct admin-tier colours, and the
  summary is actually rendered.
- Verified: typecheck 0, **1219 tests / 110 files**, `next build` green.

**Still open on this criterion (not defects, product decisions for the owner):**
`beneficiary` and `nonprofit` are held by nobody and enforce nothing — either give
them real gates (e.g. beneficiary confirmation flow, nonprofit-only campaign types)
or retire them. Recorded rather than guessed, because inventing restrictions on
roles nobody holds is the fastest way to lock a real user out.

### ✅ DONE — Claude, 2026-07-26 — **the admin donations export was broken four ways**
Extended the dead-control lens from `<button>` to `<select>/<input>` (22 hits, most
of them legitimate uncontrolled inputs inside GET forms). Two real defects fell out,
one of them a genuine data-correctness bug:

**1. `/admin/donations` Export downloaded an error message as a CSV.** The handler
POSTed `{ format, type: 'donations' }`, but the endpoint **requires `reportId` and
400s without it** — and the response went straight into a Blob download. So an admin
clicking Export received a file named `donations.csv` whose contents were
`{"error":"reportId is required"}`. **The export had never worked.** Alongside that:
- A *second* Export button did `window.open()` on a **GET** URL against a route that
  only implements **POST** → a tab showing 405, not a download.
- **"Data Type" and "Date Range" were unbound `<select>`s.** Selecting "Refunded
  Only / Last 30 days" was silently dropped. Live proof the choice matters:
  all statuses **740** rows · completed **592** · refunded **98** · completed-last-30d
  **233** — four very different answers to the same button.
- **"Format" offered Excel and PDF**, but the route emits `text/csv`
  unconditionally, so picking PDF downloaded a CSV named `.pdf`.
**Fixed:** the route now accepts `status` (allow-listed against
`{completed,refunded,pending,failed}` + `all`, so a caller cannot inject a filter)
and `since`; the client binds all three selects, sends a valid `reportId`
(`donation-summary`, or `top-donors` when Data Type = Donors), **checks `res.ok`
before downloading** and surfaces the error in a `role="alert"`, and Format now
offers only CSV. 9 tests in `__tests__/admin-export.test.ts`.

**2. The organizer dashboard's "Your Tasks" checkboxes stored nothing.** Ticking one
did nothing and reset on the next render. The tasks are **computed from real state**
(`contentCreated === 0` → "post your first update"), so they resolve themselves when
the organizer acts — a manual checkbox was conceptually wrong. Each row is now a
**link to where the task is actually done** (`/dashboard/updates/new`,
`/dashboard/ai-growth-plan`, the campaign page, `/create/choose-path`), keeping the
original bullet styling via `.task-row-dot`.

Verified: typecheck 0, lint 0 errors, **1316 tests / 122 files**, build green.

### ✅ DONE — Claude, 2026-07-26 — **admin dead controls cleared; guard now covers the WHOLE app**
Finished the half I had deliberately deferred. The 12 remaining dead buttons in
`app/admin/**` are resolved, each by what it actually needed:
- **Wired to real behaviour (3):** "View Public Profile" now links to the user's
  existing `/donors/[id]` page; both "View all activity →" buttons now link to
  `/admin/audit-log` (the user one filtered to that user).
- **Wired with one line (1):** "Edit ✏️" on the user detail now switches to the
  **Settings tab, which already edits that user** — the capability existed, the
  button just wasn't connected to it.
- **Removed as fake (1 group):** the user Activity panel's *"Login History /
  Actions / Sessions"* sub-tabs — **the same single list rendered under whichever
  one you clicked.** Three tabs pretending to be filters; deleted rather than faked.
- **Honestly disabled (4):** payouts "Configure" / "+ Add Method" / "Generate", and
  system "Verify Now" have no backend at all. Now `disabled` with a `title` saying
  so — visibly unavailable beats silently inert.
- **Deleted (623 lines):** `app/admin/users/_components/UsersClient.tsx` was another
  rename leftover superseded by `AdminUsersClient` and referenced by nothing.
- **`__tests__/no-dead-controls.test.ts` now covers `app/admin/**` too** (the
  exclusion is gone). It also strips comments before scanning — it was flagging its
  own documentation, since a comment explaining a removed `<button>` contains the
  literal text. **Verified non-vacuous** by planting a real dead button and watching
  it fail.
- Verified: typecheck 0, lint 0 errors, **1299 tests / 120 files**, build green.

### ✅ DONE — Claude, 2026-07-26 — **dead controls: buttons that do nothing when clicked**
Applied the "looks live but isn't" lens to controls. Parsed every `<button>` in
`app/` + `components/` (brace-aware, so `disabled={page > 1}` doesn't truncate the
tag) and checked for a handler, submit, or disabled state.
- **🔴 Live bug: the campaign builder's "Suggested for your story" panel had ‹ › nav
  buttons that did nothing.** All three suggestions render at once, so there was
  nothing to page through — leftover carousel chrome in the *create* funnel, the one
  the team is actively de-frictioning. **Removed** rather than given fake paging.
- `/dashboard/ai-growth-plan` rendered an **enabled "Start"/"Continue" button when a
  roadmap step had no `href`** — clickable, inert. All 7 steps set an href today so it
  never fires in practice; hardened anyway to render the same non-interactive
  treatment as a completed step.
- **~724 lines of dead demo scaffolding deleted.** `KindFundApp.tsx` (382 lines) and
  `KindFundShellServer.tsx` (125) were referenced from **nowhere in the repo** —
  rename leftovers. In `CharitMeApp.tsx`, `PageScaffold`/`DataTable`/`LineChart`/
  `DonutCard`/`SidePanel`/`FlowPage`/`Journey`/`MiniScreen`/`SuccessCard`/`Sparkline`/
  `MetricCard`/`sampleImages`/`baseMetrics` were re-exported but rendered by **no
  page** — including a comment claiming "Used by admin pages that call PageScaffold
  directly", which was **stale: zero pages call it**. That chain contained 16 of the
  19 dead buttons. Verify before assuming something is used — `Journey`'s only two
  hits in `app/` were `{/* Journey bar */}` **comments**.
- Guard: `__tests__/no-dead-controls.test.ts`. **`app/admin/**` is excluded on
  purpose** — internal tooling with its own placeholder backlog (12 remaining there);
  gating it would freeze that cleanup rather than help it. Real users never see it.
- Verified: typecheck 0, lint 0 errors, **1270 tests / 115 files**, build green,
  shared JS unchanged at 103 kB (the dead chain was already tree-shaken out of the
  bundle — the win is repo clarity and 16 fewer traps, not bytes).

### ✅ DONE — Claude, 2026-07-26 — **dead "Join link" on 120 events and "Apply" link on 240 grants**
Chasing why `grant_documents` was seeded-but-unread turned up something worse than an
unused table: **the seeded URLs are RFC 2606 documentation domains, and two of them
are rendered to the public as live links.**
- `fundraising_events.virtual_url` — **120 rows** point at `example.org`. The event
  page rendered it as **"🔗 Join link"**, so every virtual event handed attendees a
  dead link at the exact moment they tried to join.
- `grants.application_url` — **240 rows** point at `example.org`. The grant page
  rendered it as **"View funder's official page ↗"**.
- (`grant_documents.file_url` is the same — `https://example.org/docs/N.pdf`. **I did
  NOT wire that table to the UI**, because doing so would have shipped 240 broken
  download links and called it "wired to Supabase". It stays unwired until the seed
  carries real files.)

**Fix:** `lib/placeholder-url.ts` — `isPlaceholderUrl()` / `realUrlOrNull()`, grounded
in **RFC 2606**, which reserves `.test`/`.example`/`.invalid`/`.localhost` and
`example.com|net|org` precisely so they can be recognised as non-real. Both render
sites now degrade to *no link* instead of a guaranteed 404. **Deliberately narrow —
anything not positively recognised stays visible**, because hiding a real
fundraiser's link would be a worse bug than the one being fixed (tests cover
`my-example.org`, `exampleorg.com`, `notexample.com`, relative paths).
11 tests in `__tests__/placeholder-url.test.ts`. Verified: typecheck 0, **1269 tests /
114 files**, build green.

**Open for whoever owns seeding:** the underlying data is still placeholder. A
`virtual_url` of `null` would be more honest than `example.org` — the UI already
handles null correctly. Same for `grants.application_url` and
`grant_documents.file_url`. Scanned the other user-visible URL columns while I was
there: `volunteer_opportunities.contact_url`, `campaigns.cover_image_url` and
`profiles.avatar_url` are **clean**.

### ✅ DONE — Claude, 2026-07-26 — **scrollable-region keyboard audit** (was CLAIM)
Following up my own note: 11 `overflow-x: auto` wrappers exist in globals.css and
only `.fp-table-wrap` has been checked. Auditing all of them for
`scrollable-region-focusable`. **Nuance I'll respect:** axe only requires `tabIndex`
when the region has **no focusable children** — a scroller full of links/buttons is
already keyboard-reachable, and adding a tab stop there would be a regression, not a
fix. So this is measured per element, not applied blanket.
**Result — measured, not guessed.** New `npm run audit:scroll-keyboard`
(`scripts/audit-scroll-keyboard.mjs`) walks 22 public routes × mobile+desktop, finds
every element that *actually* overflows (`scrollWidth > clientWidth`) with a computed
`overflow` of auto/scroll, and classifies it by whether it is focusable itself or
holds focusable children — exactly axe's rule. Exits 1 on a real violation so it can
gate CI. **Public routes: 1 scrolling region, 0 unreachable.**

**The "11 wrappers" in my earlier note was a bad proxy** — 11 CSS *rules* is not 11
scrolling elements. Corrected findings:
- `.pc-carousel-thumbs` holds `<button>`s → already reachable. **Adding tabIndex here
  would be a regression** (a pointless extra tab stop), which is why this was
  measured per element rather than applied blanket.
- `.fp-table-wrap` — already fixed.
- **`.users-role-table` (the Roles table I added earlier today) was a real one** and is
  fixed: plain text cells, no focusable content, `overflow-x: auto` under 640px.
  **The fix is on a new wrapper, not the `<table>`** — `role="region"` on a table
  overrides its implicit `table` role and strips row/column semantics from screen
  readers, and `display:block` on a table does the same. Overflow moved to
  `.users-role-scroll`; the table keeps `min-width` so it still scrolls.
- The remaining classes (`.kf-table-scroll` ×11 files, `.cr2-track-wrap`,
  `.kf-step-track`, `.kind-pills`, `.pc-story nav`) live on **auth-gated
  admin/dashboard/create pages the probe cannot reach without a session.** Sampled
  statically: `.kf-table-scroll` wraps plain data tables with no focusable cells, so
  it is **likely the same defect in up to 11 files** — but I am not editing 11
  dashboard files on an unverified guess, especially with another bot active in
  them today. **This is now a concrete, high-value task for the signed-in e2e work
  (open item #3): run `audit:scroll-keyboard` against an authenticated session and
  fix what it reports.**
Verified: typecheck 0, lint 0 errors, 1258 tests, build green, audit exits 0.

## ⚠️ Process note for the bot team
Three separate incidents this session where master churn from parallel agents cost
real time: PR #73 went `mergeable_state: dirty` (GitHub then ran **zero**
workflows — looks exactly like a slow queue), #76's run was cancelled outright,
and the **same feature was built twice** twice over (step validation, and e2e-in-CI
with a narrower scope built on an assumption I had already disproved by running it).
**Before starting: `git log origin/master -20` and read the CLAIM blocks here.**

---

# 🛑 CRITICAL — BOTH deploy/verify pipelines are rate-limited (2026-07-26 ~13:30Z)

**Merging to master no longer reaches production.** Two independent limits are
exhausted, both caused by the volume of automated pushes today:

### 1. Vercel — free-tier deployment cap hit
Verbatim from the deploy attempt on PR #77:
> `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")`

**Consequence: production deploys are blocked for ~24 hours.** Commits merged to
master will sit in git undeployed. "Push to main and make Production" is currently
*impossible* regardless of code quality.
**Fix:** upgrade to Vercel Pro (the error links to it), or wait out the 24h window.

### 2. GitHub Actions — no runners allocated
Every run, on every branch including master, completes in 2–5s with no logs and
`runner_id: 0`, `runner_name: ""` — no runner is ever assigned. Today's run
counter passed #458.
**Consequence: nothing can be CI-verified**, including master's own state.
**Fix:** check GitHub → Settings → Billing → Actions (minutes / spending limit).

### What this means for the bot team — STOP THE PUSH CADENCE
Each merge currently consumes a Vercel deployment slot **and** produces no
verification. Continuing to push at this rate actively makes things worse: it
burns the next 24h of quota on unverified commits.

**Recommended until an owner clears the limits:**
- **Batch work.** One reviewed PR per meaningful feature, not per commit.
- **Verify locally** — `npm run typecheck`, `npm run lint`, `npx vitest run`, and
  `npm run build` all work fine in-sandbox and are currently the *only* real gate.
- **Do not** re-push to retrigger CI. It cannot pass, and each push costs a deploy slot.

### Verified-good state at the time of writing
- master `c9ccd5a`
- **1191 unit tests / 108 files passing**
- `next build` compiles
- Production (`www.charitme.com`) is **live and healthy** — auth gates return
  307 → `/login?next=…`, homepage copy correct (verified by direct curl, since
  Playwright through the sandbox proxy is unreliable)
- Last fully CI-verified commit: `fc5852b` (#75)


### 🔴 FINDING — "every image unique, 0 duplicates" was NOT true (re-verified)
The earlier ✅ rested on `audit:campaign-images`, which passed — but the audit only
checked (a) duplicates *within* a single category pool and (b) uniqueness of each
category's **cover** (`pool[0]`). A photo reused deeper in two different pools was
invisible to it, even though a visitor browsing both categories sees the same image.

**Measured reality: 10 shared photos**, worst offenders:

| photo id | categories |
|----------|-----------|
| `1469571486292-0ba58a3f068b` | **15 of 18** |
| `1488521787991-ed7bbaae773c` | 13 |
| `1593113598332-cd288d649433` | 12 |
| `1532629345422-7515f3d16bb6` | 10 |
| `1509099836639-18ba1795216d` | 10 |
| `1503454537195-1dcabb73ffb9` | 8 |
| 4 × Competition ↔ Sports | 2 each |

**What I fixed:** the audit now detects cross-category duplicates anywhere in the
pools. The 10 existing ones are a recorded **baseline that warns**; any **new**
duplicate **fails**. So the problem is visible and cannot grow, and the audit no
longer certifies something untrue.

**What I could NOT fix, and why:** it needs ~10 curated replacement photos.
I only have 45 catalog IDs total for 18 categories, and no spare pool to draw from.

**Correction to a previous session's note:** it recorded that Unsplash IDs
"can't be HTTP-200-verified from the sandbox". **That is wrong** — I verified two
IDs return 200 from here, and the audit's `--live` flag works. So candidate photo
IDs *can* be safely validated before being committed. The actual blocker is only
*finding* replacements, which needs `UNSPLASH_ACCESS_KEY` (search API) or a human
picking photos.

**Why it cannot be fixed in code — the arithmetic is decisive.**
The audit requires `MIN_POOL = 4` distinct photos per category, and there are **18
categories**, so zero sharing needs **≥ 72 distinct photos**. The catalog contains
**45**. The shortfall is **at least 27 photos**. No amount of redistribution helps:
you cannot fill 72 unique slots from 45 assets. Sharing is currently how the pools
are filled at all.

Rejected shortcuts, and why:
- **Swap in Picsum/random ids.** They verify over HTTP, but they are generic stock —
  a *Medical* or *Memorial* category showing a random landscape is a **worse**
  product than a shared-but-appropriate photo. Would satisfy the checkbox and
  damage the page.
- **Shrink `MIN_POOL`.** Makes the audit pass by lowering the bar; category pages
  would visibly repeat the same few images.

**To actually close item 5 (needs a human or an API key):**
1. Set `UNSPLASH_ACCESS_KEY` (search API) or have someone curate photos.
2. Source **≥27** category-appropriate photos — ideally 4+ genuinely distinct per
   category, so ~72 total.
3. Verify every candidate resolves: `node scripts/audit-campaign-images.mjs --live`
   (live HTTP checks **do** work from this sandbox — an earlier note saying they
   don't is wrong).
4. Delete the ids from `DUPLICATE_BASELINE`; the audit then enforces zero
   duplicates by itself.

**Note:** `scripts/audit-image-dupes.mjs` / `fix-image-dupes.mjs` solve a *different*
problem — perceptual duplicates among **per-campaign covers in the database** — and
need Supabase credentials. They do not touch these static category pools.


### ✅ FINDING — dark-mode guard covered only a third of the app (FIXED)
`theme-tokens.test.ts` enforced "no hardcoded light-mode colours", but only across
an **explicit list of 12 directories**. There are ~37 user-facing directories under
`app/`, so ~25 were unguarded — including **`create`** (the campaign wizard) and
**`features`**, both of which had drifted back to hardcoded values without failing
anything.

Scanned every unguarded directory: **6 offending lines** in 2 dirs
(`features` ×5, `create` ×1). Each swapped for the design token with the previous
colour kept as the CSS fallback — so **light mode is pixel-identical** and only dark
mode changes.

The guard now **walks every directory under `app/`** and excludes only `api` (no UI)
and `admin` (intentionally light-only, documented). A new page is therefore covered
the moment it exists, instead of when someone remembers to add it to a list.

Good news for the claim itself: only 6 violations existed, so the underlying
dark-mode work was genuinely broad — it was the *guard* that was narrow.

### 🟡 IN PROGRESS — mobile/responsive re-verification (item 8)
**Guard was narrower than the claim, again.** `scripts/audit-responsive.mjs`
checked a hand-maintained list of **17 pages** while the e2e sweep covered 37, so
~19 public routes had never been checked for horizontal overflow at any viewport
(`/features`, `/fees`, `/security`, `/terms`, `/help`, `/blog`, `/impact`,
`/transparency`, `/privacy-center`, `/prohibited-use`, `/fast-payouts`,
`/for-individuals`, `/ai-campaign`, `/ai-fundraising`, `/offline`, …).
**Fixed:** the page list is now derived from `e2e/public-routes.spec.ts`, so the
two cannot drift. Coverage 17→36 pages × 3 viewports × 2 themes.

**Gotcha that probably kept this audit from being run correctly:** it defaults to
`http://127.0.0.1:**3100**`, not 3000, and it truncates error text at 60 chars — so
pointing it at a normal `next start` on 3000 yields 216 identical
`ERR_CONNECTION_REFUSED` lines that *read* as `http://127.0.0.1:3`, which looks
like a mangled URL rather than a wrong port. Run it as:
`node scripts/audit-responsive.mjs --base http://127.0.0.1:3000`
(and keep the server and the audit inside one shell lifetime — a backgrounded
`npm start` from a separate tool call gets reaped).

**RESULT — clean.** The corrected run reports:
`✅ No responsive/theme regressions across 36 pages × 3 viewports × 2 themes`
(216 page loads, 0 connection errors, exit 0). So the mobile claim **was** true;
it had simply only ever been demonstrated on 17 of 37 routes. **Item 8 verified.**

Bonus: this audit loads every page in **both themes**, so the same run is
independent evidence for item 7 (dark/light) across all 36 public routes — not just
the static-analysis guard.

**Caution against a false alarm:** my first attempt reported "216 finding(s)", which
reads like ~189 real responsive bugs. Every one was the same wrong-port connection
error. Always check whether findings are `ERR_CONNECTION_REFUSED` before believing
a large number.


### 🟡 FINDING — four of the six user roles confer no enforced permissions
`lib/role-capabilities.ts` (another agent's work this session, and commendably
honest — it tracks `enforced` per capability) makes this measurable:

| role | capabilities enforced |
|------|----------------------|
| `admin` | **3 / 3** |
| `super_admin` | **3 / 3** |
| `donor` | 0 / 4 |
| `organizer` | 0 / 4 |
| `beneficiary` | 0 / 2 |
| `nonprofit` | 0 / 3 |

Access for the four user-facing roles is governed by
`'Signed-in session + row ownership (not the role)'` — a signed-in user can act on
rows they own, whatever roles they hold.

**This is not necessarily a defect.** Ownership-based authorisation is a sound fit
here: a donor and an organizer differ by *which rows they own*, not by a role flag,
and users legitimately hold several roles at once (donating to a campaign you also
organise). Adding role gates on top could break those overlaps.

**But it does mean checklist item 10 is only half true.** Roles are clearly
*mapped* and *documented*; they are not *behaviourally different* for the four
user-facing ones. If the intent is that e.g. a `nonprofit` sees different features
or gains different permissions from a `donor`, **that is not implemented** — and no
test would catch it, because nothing enforces it.

**Decision needed from the owner:** is ownership-based access the intended model
(in which case item 10 is done, and the role labels are presentational), or should
these four roles gate real capabilities (in which case it is a feature to build,
per-role)? I have not invented role gates on my own, because doing so would change
the authorisation model and could lock existing users out of their own data.


### ✅ FINDING — accessibility had zero automated enforcement (FIXED, and it passes)
There was **no `axe`, `lighthouse` or `pa11y` dependency in the repo**. The
"axe WCAG 2.0/2.1 A/AA → 0 violations" claim came from ad-hoc browser runs in
earlier sessions, so nothing stopped a regression shipping — the same shape of gap
as the e2e suite that ran in no workflow.

Added `@axe-core/playwright` + `e2e/accessibility.spec.ts`: the real ruleset
(`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) over all 36 public routes.

**Result: 0 violations, light AND dark, 4.1 minutes.** So the claim was true — it
simply had nothing behind it. Now it is enforced on every future change.

Why both themes: colour-contrast rules only evaluate the colours actually
rendered, so a light-only pass says nothing about dark mode. Since dark/light is
its own checklist item (7), a single-theme sweep would have left it half-verified.
This run is therefore **also** independent evidence for item 7 — the third such
confirmation, alongside the static token guard and the responsive audit.

**CI note:** the spec lives in `e2e/`, and the CI `e2e` job runs `npx playwright
test` unfiltered, so it is picked up automatically on both the chromium and mobile
projects. Expect the e2e job to lengthen by roughly 4–8 minutes.

### 🟡 IN PROGRESS — runtime contrast audit (Claude, claimed 2026-07-26 14:2x)

### ✅ DONE — runtime contrast audit (Claude, 2026-07-26)
**Claiming before code, per the duplicated-work lesson above.**

**Gap found:** `scripts/audit-responsive.mjs` loads all 36 pages in **both themes**,
but it only measures **horizontal overflow** and **broken/oversized images**. It
never looks at colour. So the note above ("the same run is independent evidence for
item 7 (dark/light) across all 36 public routes") is **overstated** — a page whose
text is light-on-light renders at the correct width with working images and passes
that sweep silently. Static `theme-tokens.test.ts` has the mirror-image blind spot:
it greps source for hardcoded colours, so it cannot see a pairing that is only
wrong once the cascade resolves (e.g. a themed `var(--t1)` text sitting on a
hardcoded-light container, which is exactly what shipped on the campaign AI card,
success-stories, and the 13 Tailwind-utility pages).

**Doing:** `scripts/audit-contrast.mjs` — renders each public route in both themes
and measures **computed** contrast per visible text node (resolving the effective
background by walking ancestors through transparent fills), reporting anything
under the WCAG AA threshold (4.5:1 normal, 3:1 large). This is the empirical check
neither existing guard performs, and it is the only way to verify the dark-mode
work actually reads — including my own `--bg` (#31) and Tailwind-remap (#78) fixes,
which so far are verified only from the compiled stylesheet, not from a render.

Scope: audit script + whatever real failures it surfaces. Not touching the
responsive audit, the token test, or admin (documented light-only).

**RESULT — 13 real AA failures found that BOTH existing guards missed; all fixed;
sweep now clean.** `scripts/audit-contrast.mjs` renders all 36 public routes in
both themes and measures computed text colour against the resolved effective
background. Final run: **✅ 0 failures across 36 pages × 2 themes.**

What it caught (none of it visible to overflow-sweeps or source greps):
- **`/features` dark — an invisible H2.** "Built different from the ground up" was
  `#0e0520` (near-black) on the dark card: **1.11:1**. Six more on the same page
  (bare `#64748b`/`#475569`/`#5b21b6`/`#4b5563`/`#6c35ff`) between 1.84 and 3.75.
  Root cause: the page mixed `var(--t1, #0e0520)` (correct) with **bare** `#0e0520`
  (theme-blind) in the same file — so a grep for "has a hardcoded colour" sees both
  and a grep for "uses the token" sees both. Only the resolved render separates them.
- **`/ai-fundraising` light — 4 CTA links** at 2.15–3.48:1. The card accent was used
  for *both* the icon and the CTA text; an accent that is fine as a 3:1 graphic fails
  as 13px text. Split into `color` (icon) + `ctaColor` (text, uses the `--*-text`
  tokens added in #78).
- **`/ai-campaign`** `.ai-builder-examples` **2.89:1** — the *light* value was wrong
  while a dark override already existed, i.e. the theme work had been done in only
  one direction.
- **`/pricing`** `.fee-calc-bad` **4.46:1** — a near-miss no human eye would catch.
- **`/features` dark, second pass:** tokenising the text exposed the inverse pairing —
  themed text on a still-hardcoded `#fafafa` card (1.17:1). Fixed the container too.

**Two traps this run hit — worth knowing before trusting any audit number:**
1. **A stale server silently invalidates the whole run.** My second pass reported 18
   failures including impossible ones (white-on-white, and *light* backgrounds in
   **dark** mode, at browser-default 16px). Cause: the new `next start` hit
   `EADDRINUSE` and the audit hammered the **previous** server serving the **old**
   build. The tell is physically-impossible output, not a plausible-looking number.
   The script now defaults to :3000 (not the responsive audit's :3100) and the run
   recipe greps the server log for `EADDRINUSE` before believing any result.
2. **`pkill -f "next-server"` kills the shell running it** — the pattern matches that
   shell's own command line. Use `pkill -f "[n]ext-server"`.

**Known blind spot (documented in the script):** text over a background-image or
gradient is skipped, since contrast against a photo is not a single number. That is
why a hardcoded-light *gradient* card with themed text on `/features` was invisible
to the sweep — found by eye and fixed to `linear-gradient(…, var(--s2), var(--s3))`.
When tokenising a card, check its gradient stops too.

Verified: typecheck 0, **1233 tests / 111 files pass**, `next build` exit 0,
contrast sweep exit 0.


### ✅ DONE — contrast sweep extended to the auth screens (Claude, 2026-07-26)
The 36-route sweep inherited its page list from `e2e/public-routes.spec.ts`, which
omits **`/login` and `/forgot-password`** — pages that render unauthenticated and
that *every* user passes through. Added them (38 routes now).

**Found immediately: `/forgot-password`'s "Send reset link" CTA was 3.77:1** —
white on `bg-emerald-600` (#059669), an AA failure for 14px text, **in both
themes** (so no dark-mode remap would have caught it). This is the button a
locked-out user has to find to get back into their account.

Note this **corrects an explicit assumption in the code**: the `.mktg-page`
dark-mode adapter says "Green buttons (bg-emerald-600 + text-white) … are left
untouched", i.e. they were believed safe. They were not. Fixed by pointing
`.bg-emerald-600` at **`--green-btn`** (#0b7a3e, ~5:1) — the AA-safe fill already
introduced for the shared `Btn` component — so the Tailwind pages and the design
system now agree. Applies in both themes because the failure exists in both.

**Final: ✅ 0 AA contrast failures across 38 pages × 2 themes.**
typecheck 0 · vitest 1258/1258 · `next build` exit 0.

**Still uncovered (needs credentials, not effort):** the authenticated surface —
`/dashboard/*`, `/admin/*`. Both this sweep and the axe sweep stop at the login
wall, so the logged-in experience — where organizers spend nearly all their time —
has never had contrast or a11y measured. This is the single biggest remaining
a11y/theme gap and it unblocks the moment test credentials exist (same blocker as
"Signed-in e2e" in the queue above). `scripts/audit-contrast.mjs` takes `--only`,
so it can be pointed at dashboard routes as soon as a session can be established.

### ⛔ BLOCKER CORRECTED — it is network policy, NOT missing credentials (Claude, 2026-07-26)
Several items are parked on wording like *"the moment test credentials exist"*
(signed-in e2e, dashboard/admin a11y + contrast) or *"can't be HTTP-200-verified
from the sandbox"* (new Unsplash photo IDs for the duplicate-category work).

**The credentials already exist.** `apps/web/.env.local` carries
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_PROJECT_REF`, Stripe keys, OpenAI, Resend/SendGrid, Twilio. Nobody needs
to go find them.

**What actually blocks it is the sandbox's egress policy.** The agent proxy
answers **403 to CONNECT** for any non-allowlisted host. Confirmed directly from
`$HTTPS_PROXY/__agentproxy/status` → `recentRelayFailures`:

```
yanexccimwooursawynm.supabase.co:443   connect_rejected (403 to CONNECT)
images.unsplash.com:443                connect_rejected (403 to CONNECT)
www.google.com:443                     connect_rejected (403 to CONNECT)
```

`curl` to Supabase returns **000** with and without the CA bundle — it never
opens a socket. So:
- **Signed-in audits cannot be unblocked by hunting for credentials.** They need
  either an environment whose network policy allows `*.supabase.co`, or a run on
  infrastructure with egress (CI, a laptop). Framing it as a credentials problem
  will burn time and find nothing.
- **The image-uniqueness residual is correctly parked.** I re-tested rather than
  trusting the note: Unsplash is 403-denied, so new photo IDs genuinely cannot be
  HTTP-verified here, and shipping unverified IDs would risk broken images in
  production. The existing caution is right.

**Practical consequence for whoever picks these up:** `scripts/audit-contrast.mjs`
takes `--only`, and the axe spec can be pointed at dashboard routes; both are ready
to run the instant they execute somewhere with egress. The work left is
environmental, not code.

### ⛔ INFRA CEILING HIT — free-tier quotas exhausted, CI red for everyone (Claude, 2026-07-26)
**Do not chase the red CI as a code defect — it is not one.** Two independent
free-tier ceilings were hit today and they explain every failing check:

1. **GitHub Actions — no runner is being assigned.** Both jobs complete in
   **~2 seconds** with `runner_id: 0` / `runner_name: ""`, i.e. nothing ever ran.
   This is repo-wide, not PR-specific: **30 of the 30 most recent CI runs failed
   this way, including pushes straight to `master`** that touch none of our code.
2. **Vercel — deploy quota gone.** Preview deploys now return
   `Resource is limited - try again in 24 hours (more than 100, code:
   "api-deployments-free-per-day")`.

Two different providers refusing work on the same day, both with quota-shaped
errors, points at **free-tier exhaustion rather than an outage** — plausibly
driven by how frequently we have been pushing (every commit triggers a CI run
*and* a preview deploy).

**How to tell a real failure from this one:** a genuine failure runs for minutes
and produces logs. These produce **no logs at all** (`get_job_logs` → HTTP 404)
and finish in ~2s. If you see that signature, stop debugging your diff.

**What the owner needs to do (nothing here is fixable in code):** check Actions
minutes / billing and the Vercel plan, or wait out the 24h window. Until then
green CI is unobtainable, so local verification is the only real gate —
`npm run typecheck`, `npm test`, `npm run build`, plus the audit scripts, all of
which do pass locally.

**Cheap mitigation worth considering:** batch several changes per push instead of
one commit per push, so a day's work costs a handful of runs rather than dozens.


### ⚠️ CORRECTION to my own earlier result — the "0 violations" pass under-reported
I reported `0 WCAG A/AA violations across 36 routes × both themes`. **That number was
measured before the sweep settled animations**, and axe reads computed styles — so
mid-transition samples masked real failures. With reduced-motion emulation and a
250ms settle, the same sweep finds genuine `color-contrast` (serious) failures:

- `/features` — the "Why CharitMe" `h2` and eyebrow `span` — fails in **both** themes
- `/ai-fundraising` — the tool-card CTA link — fails in **light**

**Not caused by my tokenisation of `/features`.** They fail in light mode too, where
the token fallback is the original colour, so they pre-date this session's change.

Also found and fixed a **real, deterministic mobile bug** while doing this:
`/fast-payouts` `.fp-table-wrap` becomes `overflow-x: auto` under the mobile
breakpoint, and without a tabindex the scrollable region was unreachable by
keyboard — the off-screen speed/fee columns simply could not be read without a
mouse. Now `tabIndex={0}` + `role="region"` + `aria-label`.

**Remaining work on item 13 (needs a design decision, not a mechanical fix):**
`todo.md` records that branded marketing pages deliberately keep their own palette
instead of the app's theme tokens. So resolving these two means adjusting that brand
palette's foreground colours — a design call. "Intentional palette" does **not**
make a serious contrast failure acceptable, so they are baselined and visible in the
test report rather than excluded. Any NEW contrast failure on any route fails CI.

**Method note worth keeping:** injecting a `transition: none` stylesheet is
impossible here — the app ships a strict `style-src 'self'` CSP and
`page.addStyleTag` is refused (the CSP working correctly). Use
`page.emulateMedia({ reducedMotion: 'reduce' })` plus a short settle instead.


### 🔀 Reconciliation — two agents swept contrast concurrently (2026-07-26)
A parallel agent extended a contrast sweep to 38 routes (adding `/login` and
`/forgot-password`) and **fixed a real AA failure**: `/forgot-password`'s
"Send reset link" CTA at 3.77:1, white on `bg-emerald-600`, in both themes — the
button a locked-out user needs. They repointed `.bg-emerald-600` at `--green-btn`
(~5:1). Good catch, and it corrected an explicit "green buttons are safe" comment
in the dark-mode adapter.

**Their sweep reports 0 AA failures across 38 pages × 2 themes. Mine reports 2**
(`/features` h2 + eyebrow span, `/ai-fundraising` CTA link). Both cannot be right,
and the likely difference is **animation settling**: my sweep emulates reduced
motion and waits 250ms before scanning, which surfaces final computed colours;
without that, axe can sample mid-transition and under-report (that is exactly how
my own earlier "0 violations" number was wrong).

**✅ RESOLVED — their number was right, mine was stale.** Re-ran the settling sweep
against master `032408f` (i.e. *after* the `--green-btn` change) on `/features` and
`/ai-fundraising` in both themes: **0 contrast violations on all four renders.** My 2
failures were measured *before* their fix landed, not because of animation sampling —
the settling hypothesis was the wrong explanation for a real difference in tree state.
So the baseline was describing failures that no longer existed.

`KNOWN_CONTRAST_BASELINE` (and the `known` bucket that fed it) is **deleted** — the
gate now enforces **zero** contrast failures on every route, with no exemptions.
Verified non-vacuously: full spec run is **4/4 passing in 8.4 min** (36 routes ×
light/dark × chromium/mobile ≈ 144 scans), and `resolveRoutes` skips only
`/campaigns/…/embed`, which is not in `PUBLIC_ROUTES` — so nothing was silently
excluded to make it pass.

_Sandbox note:_ the pinned Playwright 1.60 wants `chromium_headless_shell-1223`, but
this image ships `-1194`, so a bare `npx playwright test` fails to **launch** (not to
assert). Run it as
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test …` —
the config already honours that env var. Don't read a launch failure as an a11y failure.

_⚠️ Do NOT "verify" a11y against a Vercel preview URL._ The config supports
`PLAYWRIGHT_BASE_URL`, so pointing the sweep at a preview deployment looks like the
obvious way to confirm a result against a real prod build. **It silently produces a
false pass.** Preview deployments have Vercel Deployment Protection enabled — every
route 302s to `https://vercel.com/sso-api` (verified 2026-07-26 on the #90 preview:
`/`, `/features`, `/ai-fundraising` all 302). Playwright follows the redirect, so axe
would scan the **Vercel SSO login page** 36 times and report 0 violations. The run goes
green while testing none of our pages.

Doing this for real needs `VERCEL_AUTOMATION_BYPASS_SECRET` (owner-gated — do not
invent one).

### ✅ The same false-pass was already live in our own spec (Claude, 2026-07-26)
Chasing the preview-URL trap led me to check whether it applied locally. It did.

**`/achievements` and `/privacy-center` were both in `PUBLIC_ROUTES` and neither is
public** — both call `requireUser()` and 307 to `/login`. Playwright follows
redirects silently, so the sweep was **scanning the login page twice under their
names** and counting it as coverage of two marketing pages. It passed while testing
nothing. My own "36 routes scanned" claim was therefore overstated: it was really 34
distinct pages plus `/login` three times.

**Fixed structurally, not by editing the list.** The spec now asserts the landed
pathname equals the requested one *before* scanning, so any route that redirects
**fails** instead of silently measuring the wrong page. Mutation-tested: re-adding
`/achievements` fails with
`/achievements redirected to /login — the scan would have measured that page`.
This also closes the preview-URL trap above, since an SSO redirect trips the same
assertion.

**Coverage corrected while I was in there** — audited all 47 static non-admin
`page.tsx` routes against the list by probing each one's real redirect behaviour:
- **Removed** `/achievements`, `/privacy-center` — auth-gated by design, not public.
- **Added** `/impact`, `/forgot-password` — genuinely public, verified real content,
  and never previously in the enforced gate. Both now axe-clean.
- **Deliberately not added** (would scan something else): `/create`, `/profile`,
  `/*/manage` → `/login`; `/donor` (signed-in dashboard); `/beneficiary/accept`
  (token-gated invite). These need a real session — an auth-gated sweep, not this one.

Full run after the change: **4/4 passing (9.4m)**, 36 genuinely distinct public
routes × light/dark × chromium/mobile.

_Lesson worth keeping: "N routes scanned" is not the same as "N pages scanned."
A green sweep should be asked what it actually loaded._

### ✅ All five route lists consolidated + the sweeps were run against a REAL prod build (Claude, 2026-07-26)

**The same defect was in all five copies**, not just the a11y spec. `/achievements`
and `/privacy-center` were listed as public in `accessibility.spec.ts`,
`public-quality.spec.ts`, `public-routes.spec.ts`, `audit-contrast.mjs` and
`audit-responsive.mjs`. Proven, not inferred:

```
/achievements:   asserted status=200 | landed=/login | h1="Welcome back."
/privacy-center: asserted status=200 | landed=/login | h1="Something went wrong"
```

So `public-quality` was asserting document language, button names, link names and
alt text **about the login page** under two other names, and passing.

**Fixed:** one source of truth (`e2e/public-routes.json`, consumed by
`e2e/public-routes.ts` for specs and by `fs` for `.mjs` scripts) plus a shared
`expectNoRedirect()`. Migrated `accessibility`, `public-quality`, `public-routes`
and `audit-responsive`.

> ⚠️ **`scripts/audit-contrast.mjs` is NOT migrated — left for Codex.** It is
> contrast/theme work per the ownership split at the top of this file, so I did not
> touch it. It still carries its own hardcoded list including the two bad routes,
> which means **its "38 pages × 2 themes, 0 failures" number included two scans of
> the login page.** Point it at `e2e/public-routes.json` and add the same
> landed-path check.

**Bigger methodology correction: every a11y result I reported before this ran against
the DEV server.** `playwright.config.ts` uses `reuseExistingServer: true`, so it
reused the running `next dev` instead of the production server CI builds. Dev-mode
metadata/hydration timing differs materially — that is how the `document-title` rule
behaved differently. Re-ran on a real `next build` + `next start`:

**accessibility.spec.ts: 4/4 passing against a production build** (36 routes ×
light/dark × chromium/mobile). That is a strictly stronger result than any earlier
number in this file. Use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port>` against a
`next start` server to reproduce; don't trust a sweep that reused a dev server.

### ✅ FIXED — SEO override failure silently deleted a page's entire metadata

Found while chasing the above. `getSeoForRoute()` had **no error handling**, despite a
docstring promising it was "Safe to call in any page's generateMetadata." When the
Supabase call threw, `generateMetadata` rejected and **Next.js dropped metadata for the
whole route** — the page still rendered, so there was no error, no log line, no visible
symptom. Just no `<title>`, description, canonical or OG tags.

Measured on a production build with Supabase env unset — `/` served **89KB of correct
homepage markup, h1 "Raise More.", and zero meta tags**: a silent WCAG 2.4.2 (Page
Titled) failure plus total SEO loss on the highest-traffic page on the site. Exactly the
two pages that call `seoMetadata` (`/` and `/impact`) were the two affected, which
confirms the diagnosis.

Fixed with a try/catch returning `null`, so the override degrades to the page's own
metadata. After: `/` → `CharitMe | Raise More Faster With AI`, `/impact` →
`Impact Reports - Donation Transparency | CharitMe`. 6 unit tests in
`__tests__/seo-metadata.test.ts`; **mutation-tested — 4 of 6 fail without the fix.**

_Scope stated honestly:_ the trigger measured here is `supabaseAdmin` throwing on
**construction** when env vars are unset, so this bites misconfigured deploys and every
credential-less build — **including CI, where it would have failed the `document-title`
rule in the a11y spec.** A correctly configured production does not hit that path; there
the guard covers fetch-level exceptions. This is a real fix for credential-less builds
plus hardening — *not* a claim that production is currently losing titles.

### ✅ FIXED — `/ai-fundraising` 500 (below), and a BIGGER one found behind it

`/ai-fundraising` now returns **200** with its content intact; the live-stats strip is
**omitted** when the numbers are unavailable rather than rendered as `0 / $0 / 0`.
Verified on a production build with no credentials: `200`, h1 present,
`aif-live-stats` occurrences `0`.

**The important discovery is what this exposed.** With `/ai-fundraising` fixed, a
COLD production server still 500s on **`/` (the homepage)** and **`/impact`** —
consistently, 3/3 attempts. Earlier those looked like `200` only because the ISR
prerender from build time was being served; a fresh server has to render them and
the loaders throw.

So: **on any credential-less build — which is what CI builds — the homepage returns
500.** The SEO fix above repaired the *metadata* path; the page *body* is a separate
throw (`getHomeData` / `listPublishedImpactSummaries` call `supabaseAdmin` with no
error handling). Same defect class, three pages: `/ai-fundraising` (fixed), `/`,
`/impact`.

### ✅ DONE — every public route now survives a credential-less production build

Swept all 36 public routes on a cold `next build` + `next start` with no Supabase.
**Six returned 500**, not the one I first found: `/`, `/impact`, `/ai-fundraising`,
`/grants`, `/success-stories`, `/supported-countries`. All six now return **200**
with their content intact. Re-scanned: **NON-200: 0**.

**The subtle part — `ok` was not a sufficient signal, and assuming it was shipped the
exact bug I was trying to prevent.** After adding try/catch to the homepage loaders,
`/` rendered **"Raised on CharitMe $0"**. `getHomeData` does not throw when its reads
fail: it coalesces each to `[]` internally and returns a fully-zeroed metrics object,
so a failed load is indistinguishable from real zeros at the call site. The try/catch
turned a 500 into a *false platform statistic in the most prominent place on the
site*, which is worse than the crash.

Fixed with `shouldShowPlatformMetrics()` (`lib/home-utils.ts`): an all-zero reading is
treated as "no data". Deliberately conservative — if the platform really had zero of
everything, "$0 raised / 0 campaigns / 0 donations" is still not a figure to publish.
8 unit tests pin **both** directions, including that real numbers still show (a guard
that always returned false would "fix" the bug by silently deleting the feature).

Applied the same hide-don't-zero rule to `/success-stories` (it prints Total Raised /
Campaigns / Donations / Supporters in **two** places — the whole "By the Numbers"
section is now gated so no dangling heading remains) and `/ai-fundraising`.
`/grants` and `/supported-countries` are lists, where an empty result is honest, so
they just fail safe to `[]`.

Verified with markers on a credential-less prod build — all expect 0, all measured 0:
`Raised on CharitMe`, `Total Raised`, `By the Numbers`, `aif-live-stats`. Pages still
render (94KB / 37KB / 59KB, each with an `<h1>`).

**Result: all three public sweeps pass against a REAL production build — 8/8.**

### ✅ CHAR-0015 — WCAG **2.2** AA now ENFORCED, and it found a sitewide layout bug

CHAR-0015 asks for WCAG **2.2** AA, but the spec only carried
`wcag2a/2aa/21a/21aa`, so the 2.2-only criteria had never run. Enabling them
surfaced `target-size` (2.5.8) — and following it down found a genuine, visible,
sitewide layout bug that no existing audit could see.

**1. Header nav links were a 19.5px tap target on every page.** `.kind-header nav a`
had no vertical padding, so its box was just the 13px line box. Now `min-height: 24px`,
with the active-tab underline offset corrected from `-24px` to `-22px` — the gap
below a link centred in the 68px bar is `(68 - h) / 2`, so the old value was right
at h≈19.5 and 2.25px low at h=24. Verified by measurement: the underline lands at
y=86 before and after, exactly the header's bottom edge.

**2. The desktop nav was rendering ON TOP OF the header controls — at every width
from 1101px to 1800px.** The nav needed 774px of links but never got more than
621px, and `.kind-auth` paints after it in the DOM, so "About Us", "Blog" and
"Contact Us" sat *underneath* the theme toggle, search, bell and "Sign in" —
garbled text over icons, and those links were unclickable because the buttons
took the clicks. Screenshot-confirmed at 1280px.

Why nothing caught it: `audit-responsive.mjs` checks *page* overflow and
elements wider than the viewport, not element-vs-element overlap. Different bug
class. And the container caps at 1280px, so it never resolved on wider screens —
still 136px of overlap at 1800px.

**Fixed by making the header actually fit, not by removing anything:**
- header `.container` `max-width` 1280 → **1380** (scoped to the header; the
  header element is already `min(1380px, 100% - 40px)`, so its inner container was
  the binding constraint), padding 40 → 24
- nav `gap` 20 → 12, logo `margin-right` 28 → 18
- below **1366px** the nav collapses into the existing menu button — the measured
  point where it genuinely fits. `.kind-auth` deliberately stays visible there, so
  the "Start a CharitMe" CTA and "Sign in" remain on a 1280px laptop; hiding them
  too would have traded a layout bug for a conversion regression.
- a separate media query, NOT a widening of the 1100px block — that block also
  carries hero/grid/footer rules that must not apply at 1101–1365px.

Measured overlap by viewport, before → after:
```
1150  208px → menu    1280   78px → menu    1366  none ✓ → none ✓
1200  158px → menu    1320   38px → menu    1440+ none ✓ → none ✓
```

**Result: `WCAG_TAGS` now includes `wcag22a`/`wcag22aa` permanently.** No baseline,
no exemption — the two "unpinned residuals" I had written up were symptoms of this
same overlap, and fixing the root cause cleared both.

_Worth keeping: I nearly shipped those two as an accepted open item because I could
not explain them. They were not noise — they were axe correctly reporting a real bug
that three other audits were structurally blind to._

**Verification** (production build, not the dev server):
- accessibility 2.0/2.1/2.2 A+AA: **4/4**, 37 routes × light/dark × chromium/mobile
- public-routes + public-quality: **4/4**
- responsive: **37 pages × 3 viewports × 2 themes → 0 findings**
- typecheck 0 · lint 0 errors · **1324 tests** · build green

### 🔴→✅ My own verification trigger was permissive in the case I never tested

Shipped in #101, fixed in `20260806010000`. Worth recording because the failure
mode is subtle and I would have missed it by reading the code.

I wrote the guard as:
```sql
if not (is_admin() or owner_id = auth.uid()) then raise ...
```
Every API route in this repo writes through `supabaseAdmin` (service role), where
**`auth.uid()` is NULL**. So `owner_id = auth.uid()` is NULL, and the expression
becomes `not (false or NULL)` = **NULL**. An `IF` only branches on TRUE — so the
guard *silently did not fire*. A guard written to be strict was permissive in
exactly the path the application actually uses. It then stamped
`verified_by := auth.uid()` = NULL, recording a verification by nobody on the very
records that get exported to an employer.

**Found by running it, not reading it** — stubbed `auth.uid()` to NULL against a
real Postgres:
```
RESULT: UPDATE SUCCEEDED
verified_by = NULL
```

The fix makes the server path explicit rather than accidental: service role is
allowed (it bypasses RLS by design and the route authorizes) **but must name the
verifier**, because "verified by nobody" is not a verification. All comparisons are
`coalesce`d so the guard is two-valued and cannot silently evaluate to NULL again.

Proven on a real database, all four branches:
```
server ctx, no verified_by  → REJECTED   ✓
server ctx, verified_by set → ALLOWED, attribution kept ✓
volunteer self-verifying    → REJECTED   ✓   (the whole point)
opportunity owner verifying → ALLOWED, attribution stamped ✓
```

_Lesson: SQL three-valued logic turns a missing value into a silently-skipped
guard. Any security predicate touching a nullable column needs `coalesce` and a
test for the NULL case._

### ✅ Second pass on fabricated statistics — 2 more, incl. a PUBLIC claim about a person

The first sweep's grep was too narrow (see below), so I re-probed with a script that
looks for `await supabaseAdmin` reads in money-rendering pages where **no** `error`
is captured anywhere. Three hits, two genuine:

1. **`/donors/[id]` — a public profile about a named person.** A failed read
   published **"Total donated $0"** *and demoted their giving level*, because the
   level is derived from the total. Not a placeholder — a false public statement
   about someone else. Both the stats banner and the giving-level card are now
   behind one flag, with a visible explanation of why the numbers are absent.
2. **`/profile` — fabricated on BOTH paths.** Its `catch` returned zeros, *and*
   inside the `try` `const { data }` ignored `error`; since supabase-js resolves on
   a query error, a failure silently became `null → [] → 0`. A try/catch that
   returns zeros is not a guard, it is the bug with extra steps. Both stats helpers
   now return `unavailable`, tiles render `—`, and a banner says nothing about the
   account changed.

**⬜ One left, lower stakes:** `app/campaigns/(list)/page.tsx` does
`return { campaigns: data ?? [], total: count ?? 0 }`, so a failed read shows
"no campaigns" — false about the platform, though no money figure is invented.
Worth fixing; not in the same harm class as the five money bugs.

_My probe script's regex was itself wrong twice (`catch\s*\(` misses `catch {`;
`error\s*:` misses `{ data, error }`). Recording that because it is the third time
this session a scoped pattern produced a confident wrong answer — including in the
tooling I wrote to catch the previous instances. **Run the fix, then re-probe, then
read the survivors by hand.**_

### ✅ Swept the "fabricated statistics" class across every money-rendering page

Having fixed `/`, `/ai-fundraising` and `/success-stories` individually, nothing
stopped a fourth page doing the same thing. Audited all non-admin `page.tsx` files
that render money or counts from Supabase.

**Two real instances found and fixed, both on a signed-in user's own money:**

1. **`/dashboard/recurring`** — `const { data: subs } = await …` ignored `error`, so
   a failed read rendered **"Monthly total $0"** and *"No recurring donations yet."*
   Actively dangerous rather than merely wrong: a donor whose giving is live could
   conclude it had stopped and **set up a duplicate subscription, double-charging
   themselves**. The banner now says explicitly "This does not mean they have
   stopped — nothing has been cancelled. Please refresh before setting up a new one."
2. **`/donor`** — none of its three queries checked `error`, so a failure showed a
   donor **"Total Given: $0"** — their own lifetime giving reported back as nothing.
   Tiles are hidden rather than zeroed, and the tax-statement links (same data) sit
   behind the same flag. Notable: an earlier agent had already fixed *undercounting*
   here (100-row cap, unused `count`) — the failure case was simply never considered.

**A false positive in my own audit, worth recording.** My first grep flagged
`/dashboard/analytics` and ~19 others as unguarded. It was wrong: analytics guards
correctly via a local named `unavailable`, and its comment already states the exact
reasoning. My pattern just didn't match that identifier — **the same scoped-grep
overclaim I have caught twice in others' work, in my own audit tooling.** Re-ran with
`unavailable|degraded|loadFailed|statsAvailable|Error|failed|try {|notFound()` and the
list collapsed from ~21 to 2, both genuine.

_Also worth separating: a campaign showing `$0 raised` is CORRECT — new campaigns have
zero. Only **aggregate** figures can lie. Entity-scoped amounts were deliberately left
alone rather than wrapped in guards they do not need._

### ⚠️ `supabase/schema.sql` had drifted by 15 TABLES (Claude, 2026-07-26)
Found while regenerating the mirror for CHAR-1102. `scripts/regen_schema.sh` exists
so "the consolidated schema can never silently drift from the migrations again" —
but the checked-in `schema.sql` was **15 tables behind** the migrations. Regenerating
added 17 `CREATE TABLE`s: 2 mine, **15 pre-existing**, including `announcements`,
`banner_settings`, `campaign_wizard_drafts`, `campaign_faqs`, `campaign_milestones`,
`campaign_builder_events`, `campaign_owner_replies`, `aeo_entries` …

The mirror is only protective if it is regenerated when migrations land. It had not
been, so anything reading `schema.sql` as the source of truth was working from a
schema missing 15 tables.

Also shrank `__tests__/fixtures/schema-migration-drift-baseline.json` from 21 tables
to 20 — the 4 `tax_receipts` columns it was excusing are now covered by migrations.
That guard failed the build until I shrank it, which is exactly what it is for:
it refuses to let a stale baseline hide drift that has since been fixed.

_Note for other agents: run `su postgres -s /bin/bash -c ./scripts/regen_schema.sh`
after adding a migration — `initdb` refuses to run as root, which is likely why the
mirror kept falling behind._

### ✅ Overlap detection added — the header bug's whole class is now caught (Claude, 2026-07-26)

The header nav rendering on top of the action buttons was a **sitewide, user-facing
bug that not one of our audits could see.** The page never overflowed and no element
was wider than the viewport, so `audit-responsive.mjs` stayed green; axe only caught
it indirectly, as two `target-size` "partially obscured" findings I nearly filed away
as unexplained. Nothing stopped it recurring.

`audit-responsive.mjs` now also reports **interactive controls overlapping each
other**. Tuned to avoid false positives — both controls must be visible and ≥8px,
ancestor/descendant pairs are skipped (a button inside a card link is legitimate),
and the shared area must be ≥15% of the smaller control, so a 1px rounding kiss
between neighbours does not fire.

**Proven in both directions, which is the only reason it is worth having:**
- against the pre-fix stylesheet (`f3b2a6e~1`): **74 findings**, naming exactly the
  right elements —
  `a.- ∩ button.theme-toggle-btn 32x24px | a.- ∩ a.kind-search-btn | a.- ∩ a.kind-bell`
  — on 37 pages × 2 themes at 1920px
- against current master: **0 findings** across 222 renders

_Lesson: the audits were all measuring the page against the viewport. None asked
whether the page's own controls were fighting each other._

### ✅ Responsive sweep re-run on the CORRECTED route list (Claude, 2026-07-26)
`audit-responsive.mjs` now reads `e2e/public-routes.json`, so this is the first run
that actually covered the intended pages — the previous "36 pages, 0 overflow"
figure included `/login` twice, under the names `/achievements` and
`/privacy-center`.

Run against a **production** build (`next build` + `next start`, not the dev
server): **37 pages × 3 viewports (320/768/1920) × 2 themes = 222 renders → 0
findings.** Exit 0.

```
✅ No responsive/theme regressions across 37 pages × 3 viewports × 2 themes.
```

This also re-validates the header `min-height: 24px` change above at every
breakpoint — no overflow, no oversized elements, both themes.

**To pick this up:** set `WCAG_TAGS` to include `'wcag22a', 'wcag22aa'`, run against
a **production** build (`PLAYWRIGHT_BASE_URL` at a `next start` server — the dev
server behaves differently), and reproduce with axe's `relatedNodes`. Two nodes,
desktop only. Enforce the tags permanently once they are clean.
Previously they only ever passed against the reused dev server. CI's e2e job should
now genuinely pass once runners return.

<details><summary>original report (kept for context)</summary>

### ⬜ was: `/ai-fundraising` returns a hard 500 on a credential-less build
Surfaced by running the sweeps against a production build (it passed on the dev server,
which is why no one had seen it). `getAIPageData()` calls `supabaseAdmin` with no error
handling, so the whole marketing page 500s. **This blocks `public-routes.spec.ts` and
`public-quality.spec.ts` from passing in CI**, where Supabase is a placeholder.

Deliberately **not** fixed with a fallback-to-zero: the page renders "total raised" and
campaign counts, so defaulting to `0` would publish a false marketing number — the same
mistake the dashboards were fixed to stop making. The correct fix is the dashboard
treatment: hide the stats block when the data is unavailable rather than invent it.
That is a design change, not a one-liner, so it is written up here rather than rushed.
Pre-existing — it was in every route list before this session's consolidation.
</details>

### ✅ DONE — theme guard made luminance-based; reaches /dashboard (Claude, 2026-07-26)
**Why the static guard kept missing things:** `theme-tokens.test.ts` matched an
**enumeration of six near-white hexes** (`fff|ffffff|fefefe|fdfdff|fbfaff|f8f7ff`).
That is whack-a-mole — every fix appends one more literal, so the next unseen
shade sails straight through. Both bugs the runtime sweep had to find were shades
*not on the list*: `#fafafa` (the /features competitor card, 1.17:1) and `#f9f7ff`
(the donate breakdown card). The guard was structurally incapable of catching them.

**Fixed by measuring instead of matching:** any literal background whose relative
**luminance > 0.75** now fails, so an unseen near-white shade is caught the first
time it appears. Proven non-vacuous — injecting `#fafafa` fails the suite at the
exact line, and it passed before the change.

**Why this matters beyond public pages:** this guard walks every dir under `app/`
except `api`/`admin`, so it is the **only** coverage `/dashboard/*` has. Those
routes are Supabase-backed and the sandbox has no DB egress, so they cannot be
browser-audited here at all (see the network-policy note above). Strengthening the
static rule is the one lever that reaches them.

**Found and fixed 12 near-white surfaces** the enumeration missed, across
`/campaigns/[slug]` (+ embed + DonateButton), `/create`, `/dashboard/settings`,
`/dashboard/campaigns/[id]` SharePanel, and `/donor`. Most were **light tint chips**
(`#f0eaff`, `#dcfce7`, `#f0fff8`, `#fff0f3`, `#e8f8ee`, `#f5f3ff`, `#e0faf0`) —
these pass contrast, which is why the runtime sweep never flagged them, but they
stay glaringly bright on a dark page. Converted to **translucent tints**
(`rgba(…, .10–.14)`), the pattern already used elsewhere in this codebase, which
reads correctly on both themes; the two plain neutrals became `--s2`/`--s3`.

**Deliberately NOT extended to text.** The same luminance rule on `color:` fires on
58 lines, but most are legitimate brand accents (`#7c3aed`, `#635bff`, `#4285F4`,
`#059669`) — dark by luminance, correct by intent. Saturation does not separate
them either (`#0e0520`, the invisible headline, is itself highly saturated). A
text-side rule would need the *resolved pairing*, which is exactly what
`audit-contrast.mjs` already does at runtime. Left alone rather than shipping a
guard that cries wolf.

Verified: typecheck 0 · vitest **1258/1258** · `next build` exit 0 · contrast sweep
**0 failures across 38 pages × 2 themes** (re-run after the tint conversions).

### ✅ DONE — contrast sweep wired into npm + CI (Claude, 2026-07-26)
The runtime sweep was manual-only, so it protected nothing between runs. Now:
- **`npm run audit:contrast --workspace=apps/web`** (alongside `audit:campaign-images`).
- **A CI step in the `e2e` job**, which already produces a production build.

`playwright.config.ts` owns and tears down its own webServer, so the step starts
and stops its own. Two hard-won gotchas are encoded in it rather than left as lore:
- **fails fast if :3000 is already serving** — a stale server audits the *old*
  build and emits plausible-looking nonsense (this cost a full debugging cycle
  earlier today: 18 "failures" that included white-on-white and light backgrounds
  in dark mode);
- **`pkill -f "[n]ext-server"`** is bracketed so it cannot match the step's own
  shell, whose command line contains that string.

Verified by running the exact CI invocation locally: **0 failures, 38 pages × 2
themes**. Note the sweep runs against placeholder Supabase env (same as the rest
of CI) and passes — it covers static public routes, so it needs no database.

---

## 🔖 HANDOFF — Claude session 2026-07-26 (theme/a11y lane)

**Shipped (7 PRs, all merged to master):** #78 Tailwind dark remap · #79 runtime
contrast audit + 13 AA fixes · #80 auth screens + password-reset CTA · #81/#82
blocker corrections · #83 luminance-based guard + 12 tint fixes · #84 CI gating.

**Verified state (local — CI cannot run, see the infra ceiling note above):**
`tsc --noEmit` **0** · vitest **1258/1258** · `next build` **exit 0** ·
contrast sweep **0 failures across 38 pages × 2 themes**.

### The one thing to fix first (only the owner can)
Both providers are quota-exhausted: **GitHub Actions assigns no runner** (~2s
failures, `runner_id: 0`, no logs — 30/30 recent runs incl. pushes to `master`)
and **Vercel** returns `api-deployments-free-per-day`. Nothing in the codebase
causes this and nothing in the codebase can fix it. Check billing / wait 24h.
Until then **local runs are the only real gate** — and they are all green.

### What is genuinely left, and why (do not mistake these for "not done")
1. **The authenticated surface is unaudited** — `/dashboard/*`, `/admin/*` have
   never had contrast or a11y measured, because every sweep stops at the login
   wall. This is the **single biggest remaining quality gap**; organizers spend
   nearly all their time there. Blocked on **network egress, not credentials**
   (creds are in `.env.local`; the sandbox proxy 403s `*.supabase.co`).
   `audit-contrast.mjs` takes `--only`, so it is ready to point at dashboard
   routes from anywhere with egress.
2. **Image uniqueness residual** — needs ≥27 new photo IDs; Unsplash is likewise
   403-denied here, and shipping unverified IDs risks broken images in prod.
   Correctly parked, re-tested today.
3. **GoFundMe-parity feature list** (§ "Section B") — product work, untouched by
   this lane.

### Two traps that have each already cost a debugging cycle — read before auditing
- **A stale server invalidates an entire run.** If results look physically
  impossible (white-on-white; *light* backgrounds in *dark* mode; browser-default
  font sizes), you are auditing the previous build on a port you thought was free.
  The CI step now hard-fails on a busy :3000 for this reason.
- **`pkill -f "next-server"` kills the shell running it** (the pattern matches that
  shell's own command line). Always bracket: `pkill -f "[n]ext-server"`.

### Coordination note
Two bots share this repo and **duplicated work earlier today** because a list said
"unclaimed" without anyone marking in-progress. Claim a line here *before* writing
code. This lane stayed on theme/a11y/tooling; the other bot was on
volunteers/events/email/roles.

### 🔴 FINDING — the admin console contradicts itself about dark mode (Claude, 2026-07-26)
**Not fixed on purpose. This needs a product decision, and it cannot be verified
from this sandbox.** Recording it with measurements so it is actionable.

`theme-tokens.test.ts` excludes `app/admin` because admin is *"intentionally
light-only internal tooling (documented decision)"*. The code does not agree:

| Signal | Count | Says |
|---|---|---|
| Hardcoded near-white backgrounds in `app/admin` | **242** | light-only |
| Adaptive `var(--t1..t4)` text usages in `app/admin` | **101** | theme-aware |
| `[data-theme="dark"] …admin…` rules in `globals.css` | **31** | dark-capable |

(89 admin `.tsx` files scanned; 6 contain a light surface *and* adaptive text in
the same file, and the real exposure is larger because a token-text child can sit
inside a white card defined in a shell component.)

**Why it matters:** with dark mode on, `--t1` resolves to near-white (#e2e8f8)
while those cards stay `#fff` → **near-white text on a white card**. That is text
an owner cannot read, on the console they open first during an incident. The 31
dark rules (dark nav `#1e1848`, dark form inputs, `.admin-user-panel` →
`var(--s1)`) mean someone was actively making admin dark-capable, so the
"light-only" exclusion is at best stale.

**Two coherent fixes — pick one, do not half-do both (which is today's state):**
1. **Make light-only true.** Re-declare the light token values on an admin-scoped
   wrapper so every descendant resolves light regardless of `data-theme`. Fixes
   all 101 usages at once without touching 89 files. **Requires also neutralising
   the 31 dark rules**, or the nav/inputs stay dark inside a light console.
2. **Finish the dark theme.** Convert the 242 hardcoded surfaces to tokens and
   drop the guard exclusion. Larger, but consistent with the 31 rules already
   written.

**Why I stopped rather than shipped:** I implemented option 1, then found the 31
dark rules and reverted it. Admin needs auth **and** a database, and this sandbox
has neither (see the network-policy note), so an unverified palette change to the
owner console is not worth the risk. Whoever has a working environment should pick
a direction and verify it renders. `scripts/audit-contrast.mjs --only /admin/...`
will confirm it once a session can be established.

### 🔍 AUDIT — the 10 "vision" parity boxes were stale, not unbuilt (Claude, 2026-07-26)
All ten were unchecked, which read as "none of this exists". **Nine have real
implementations already**; the boxes had simply never been revisited. Audited each
against the codebase and rewrote the lines with **file-level evidence** (above).

**Marked `[~]`, deliberately not `[x]`.** A route file existing is not the same as
a feature working, and none of these can be exercised here — they all need
Supabase, which this sandbox cannot reach (see the network-policy note). `[~]`
records "code present, runtime unverified", which is the honest state. Ticking
them `[x]` would manufacture completeness.

**Three are genuinely partial, and the gap is specific — worth reading before
anyone claims parity:**
- **Marketing Automation** names YouTube/Facebook/Instagram/LinkedIn/X/TikTok in
  one workflow. Email (Resend/SendGrid) and SMS (Twilio) are wired; **the six
  social channels are not** — that is the unclaimed connectors item (§32), not a
  finished feature.
- **Enterprise CRM** has the surfaces (donations, messages, supporters, referrals,
  corporate, nonprofit, beneficiary, team, admin/users) but **no unified record
  joining donor ↔ sponsor ↔ volunteer ↔ grant-maker**, which is what "full
  relationship platform" means.
- **Marketplace** covers volunteers/sponsors/grants/matching/events; **donated
  goods and equipment are not modelled** at all.

**Net effect on the queue:** open `- [ ]` items **31 → 21**. That reduction is
evidence-based, not bookkeeping — each line now points at the code that backs it,
so the next person can verify rather than re-audit from scratch.

### ✅ DONE (half of CHAR-1402) — SQL seeds now carry a demo-seed guard (Claude, 2026-07-26)
**The existing guard was real but guarded the wrong door.** `scripts/seed-guard.mjs`
is correctly wired into both `.mjs` seed runners (verified — it is imported and
called, not dead code). But the **SQL** seeds are pasted straight into the Supabase
SQL editor, which never touches Node, so they bypassed it completely — **and that
is the path that actually loaded demo data into production.**

The exposure is not theoretical: `01_campaigns_core.sql`'s own header says *"Run
once. Re-running appends more rows (not idempotent for child tables)"*, so one
accidental re-run silently duplicates campaigns and donations in a live database.

**Fixed:** all **9** seed files (`seeds/00`–`06`, `super_admin_console_seed.sql`,
`seed_250.sql`) now open with a `do $$ … raise exception … $$` guard requiring an
explicit opt-in in the same session:
```sql
set charitme.allow_demo_seed = 'true';
```
`99_verify_counts.sql` is deliberately left unguarded — it is read-only verification.

**Verified against a real PostgreSQL 16.13**, both directions, on an actual seed
file rather than a snippet:
- without the opt-in → blocks at the guard **before touching any table**, `exit 3`;
- with the opt-in → `SET / DO / DO`, i.e. execution proceeds past the guard into
  the seed body.

The error carries a `HINT` with the exact command, so whoever hits it is not left
guessing.

**Still open (the other half of CHAR-1402): demo-data LABELLING.** Roughly 500
demo campaigns are already live and nothing marks them as demo — no `is_demo`
column exists anywhere in the schema. A donor cannot tell a seeded campaign from a
real one. Mitigating factor found while checking: demo campaigns have no connected
Stripe account, and the campaign page renders *"Donations open soon"* instead of
the donate form when `payoutReady` is false — so they **cannot currently take
money**. That is a safety net, not a label. The labelling half needs a migration
plus a backfill, which requires the DB access this sandbox does not have.

### ✅ VERIFIED — API authorization audit: 153 mutating routes, 0 holes (Claude, 2026-07-26)
Audited **every** `route.ts` under `app/api` exporting POST/PUT/PATCH/DELETE
(**153 routes**) for a missing authorization guard — the classic way a
service-role key gets exposed to the internet. **Result: no unguarded mutating
route.** Recording the method because the naive version of this audit produces
alarming false positives, twice over.

**Guards actually in use** (a grep that does not know these will "find" holes that
do not exist): `verifyAdmin()` ×95, `requireAdmin()` ×10, `guardSuperAdmin()` ×10,
`verifyOwnership()`/`verifyOwner()`/`verifyCampaignOwner()` ×3 each, plus
`canManageCampaign()`, Stripe signature verification, and `CRON_SECRET`.

**False positive #1 — the scary one.** My first pass flagged **6
`admin/super/*` routes using `supabaseAdmin`** as unauthenticated, which reads
like a critical breach of the owner console. It was wrong: they all call
`guardSuperAdmin()`, which my pattern simply did not know about. *Always open the
file before believing an authz grep.*

**False positive #2.** The next pass left 8 routes, including
**`ai/campaign` and `ai/goal-recommend` calling OpenAI while unauthenticated** —
which would let anyone burn the owner's API budget. Also wrong: both are
rate-limited. Verified the limits are real and not merely imported:
- `ai/campaign` — `checkRateLimitDurable('ai:'+ip, 12, 60_000)` → 12 req/min/IP
- `ai/goal-recommend` — 15 req/min/IP

and both are **durable** (not in-process, so they survive serverless cold starts)
and degrade to a deterministic `fallbackAiCampaign()` when no OpenAI key is set.

**The remaining unauthenticated routes are intentionally public and all
rate-limited:** `auth/signout`, `marketing/unsubscribe`, `marketing/capture`,
`contact`, `campaign-reports`, `trust-score`. That is the correct design — an
unsubscribe link cannot require a session.

**Conclusion:** the "Security issues are resolved" criterion holds for API
authorization specifically. Not claimed: RLS-per-persona (needs live auth
sessions — see the network-policy blocker) and dependency CVEs.


## 🔧 CI is DEAD (jobs never run) — but production deploys DO land (Claude/tbaz3i, 2026-07-26)

**Three pipelines, three different states. Conflating them is easy and I got it wrong once
— the correction matters more than the diagnosis:**

| pipeline | state | consequence |
|---|---|---|
| `master` → production | ✅ **working** | **merging DOES reach users** |
| PR → preview deploy | ❌ `api-deployments-free-per-day` | no preview URL for PRs |
| GitHub Actions CI | ❌ **jobs never execute** | **a red check carries no information** |

**CI evidence:** every run — master and PRs — fails in **2–5 seconds**, measured from the
Actions API (`run_started_at` → `updated_at`). A real run (`npm ci` + build + 1300 tests +
Playwright) takes minutes. That retro-explains the dead ends: job logs **404** (nothing
ran), `get_check_run` output is **empty**, and **docs-only commits fail identically**.
Ruled out: `npm ci` lockfile mismatch (`--dry-run` clean) and a Node/engines mismatch
(fixed anyway — `.node-version` was 20.11.0 below rolldown's `^20.19.0`). Almost certainly
**Actions minutes/billing exhausted**; the same account is hitting the Vercel free-tier cap
simultaneously. **Owner: Settings → Billing → Actions.**

**Until then — verify locally before merging, because nothing else will catch a regression:**
```bash
npm run typecheck --workspace=apps/web && npm run lint --workspace=apps/web \
  && npm test --workspace=apps/web && npm run audit:campaign-images --workspace=apps/web \
  && npm run build --workspace=apps/web
cd apps/web && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
```

**`/api/health?details=1` now answers "which build is live?"** (admin-gated; the public
response stays minimal per its contract test). Added because during this outage the only
way to tell a *queued* deploy from a *shipped* one was probing behaviour — which is
exactly how I briefly got it wrong.

### Verified live this session
- **All 96 fabricated "Verified" badges are gone** from `/grants` and `/volunteer`
  (48 each → 0), with all 48 listings each still rendering. #91's read-layer suppression.
- **Accessibility: all 30 public routes → 0 WCAG A/AA violations** against current master.

### ⚠️ Still needs the owner — code cannot fix it
`/grants` still shows **52 × "Ford Foundation"** and **44 × "City of Austin"**: fabricated
grant programs credited to real organizations, indexed via `sitemap.ts`. Suppression hides
a boolean, not a name. **Use the slug-prefix SQL** — the earlier `where source = 'seed'`
version matches **zero rows**, because production rows have `source = NULL`:
```sql
update public.grants set verified = false where slug like 'seed-grant-%';
update public.grants set funder_name = 'Cedar Grove Foundation' where funder_name = 'Ford Foundation' and slug like 'seed-grant-%';
update public.grants set funder_name = 'City of Springfield'    where funder_name = 'City of Austin'   and slug like 'seed-grant-%';
-- verify: select count(*) from public.grants where slug like 'seed-grant-%' and verified;  -- expect 0
```
