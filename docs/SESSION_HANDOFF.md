# CharitMe — Session Handoff (Homepage · Security · Payments audit · Admin SEO/AEO)

> Standalone pickup guide for the next bot. Everything below is **on `master`**
> (tip `b3e437c` at time of writing) and verified: typecheck ✅, lint 0 errors ✅,
> **576 unit tests** ✅, `next build` ✅ (130 pages). Newest facts first.

## 0. How to orient fast
- `handoff.md` — coordination log (dated entries, newest on top). This file is the deep-dive for this session's workstream.
- `todo.md` — Agent 0's execution tracker (owned by Agent 0; edit sparingly).
- Verify locally: `cd apps/web && npx tsc --noEmit && npx vitest run && npx eslint . && npx next build`.
- `apps/web/.env.local` (gitignored) holds the real Supabase creds for this env.

## 1. Critical operational knowledge (read before touching infra)
- **Raw Postgres (5432/6543) is blocked by the container egress.** Only HTTPS works. `psql` cannot reach Supabase; the Supabase **CLI is not installed**.
- **The write/DDL path is the Supabase Management API over HTTPS:**
  `POST https://api.supabase.com/v1/projects/<ref>/database/query`, header
  `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>` (the `sbp_…` token in `.env.local`), body `{"query":"..."}`. Runs SQL as `postgres`. **Use read-only SELECTs unless the owner approves writes.** Project ref: `yanexccimwooursawynm`.
- **There is NO Supabase-CLI migration history** (`supabase_migrations.schema_migrations` does not exist). Migrations are applied ad-hoc via the Management API. "Applied vs pending" must be determined **empirically from the live schema**, not a history table.
- **Migration reconciliation status (verified read-only):** all 132 tables defined by local `supabase/migrations/**` already exist on the remote (which has ~143 tables — it is *ahead* of local). Previously-missing columns (`campaigns.visibility`, `campaigns.deleted_at`, `campaign_launch_settings.currency`) are now present. **Nothing is pending to apply.** Local migrations contain **no destructive ops** (no DROP/TRUNCATE/DELETE-without-WHERE/RENAME/type-change; NOT NULL adds all use `IF NOT EXISTS … DEFAULT`).
- **A parallel session (Agent 0) is actively pushing to `master` and applying migrations via the Management API.** Always `git fetch origin master && git merge origin/master` and re-verify before `git push origin HEAD:master`. Do **not** force-push master or rewrite shared history.
- **Secrets were pasted in chat (LIVE Stripe/Supabase/Resend/Google/CRON). Owner must ROTATE them.** Nothing secret is committed (`.env*` gitignored, verified).
- **ISR caching gotcha:** several public pages use `export const revalidate = N`. `next start` serves the **build-time** HTML first; new DB rows appear only after the revalidate window. To verify DB-driven content, use `next dev` (renders fresh every request) — see the `/faq` AEO verification below.
- **Stripe keys configured are LIVE.** Do not exercise real donation/payout flows. Payment work needs Stripe **test** keys.
- **Duplicate local migration timestamps** exist (e.g. two `20260719000000`: grants + matching_gifts; also `20260608010000/020000`, `20260610000000`, `20260611000000`). Harmless today (ad-hoc apply) but must be renamed before any CLI-based migration management.

## 2. What this session delivered (all on `master`, verified)

### 2a. Homepage — full rebuild (production-ready)
- `apps/web/app/page.tsx` + `app/home-parts.tsx` (client: `AiSearch`, `CountUp`, `Reveal`) + `lib/home-data.ts` additions (`getCategoryStats`, `getRecentDonations`, `HomeMetrics`).
- Token-driven (dark default + light + system, no hardcoded colors), mobile-first (390→1440 verified), ISR (`revalidate=120`), skeleton image loading, real Supabase data throughout, AI cause search → `/campaigns`, links to `/grants` + `/volunteer`.
- **Lighthouse (real audits): Accessibility 100, SEO 100, Best-Practices 96, Performance 93** (perf capped by egress-blocked hero image; fine behind a CDN).
- Scroll reveals have a **900ms safety fallback** so content can never stay hidden if `IntersectionObserver` doesn't fire.
- **Note:** master later merged a hero variant + `CampaignImage`; git auto-merged both cleanly.

### 2b. Security & correctness fixes (all verified, tests added where logic changed)
- **Donation double-count (high):** `record_donation` was check-then-act → could double-count under concurrent Stripe webhooks. Fixed with a transaction-level `pg_advisory_xact_lock` (migration `20260719120000`, mirrored in `schema.sql`). **Live remote `record_donation` already contains the fix.**
- **Stored XSS (high):** JSON-LD via `JSON.stringify` didn't escape `<>&`. Added `lib/json-ld.ts#safeJsonLd` and applied to all 9 JSON-LD sites.
- **Rate-limit bypass (high):** in-memory limiter was per-lambda. Added `lib/rate-limit-durable.ts` + `check_rate_limit` RPC + `rate_limit_hits` table (migration `20260719130000`, applied) with in-memory fallback; wired the expensive `ai/campaign` endpoint.
- **Framing/CSP:** embed route now `frame-ancestors *`; all other routes `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` (resolved a DENY/SAMEORIGIN conflict). Verified via live headers.
- **CSV formula injection:** `lib/csv.ts#escapeCsvCell` neutralizes `= + - @`-leading cells; applied to all 5 export routes.
- **Privacy:** `/api/campaigns/[id]/donations` no longer exposes private campaigns; anonymous donors redacted.
- **Upload authz:** `POST /api/upload/campaign-image` now verifies `canManageCampaign` before writing to a campaign folder.
- **Webhook:** verifies both `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`.
- **Scalability:** co-organizer invite uses an indexed `profiles` lookup (was loading up to 1000 auth users).
- **Removed fake data:** auto-seeding of 50 fake sponsors + 500 fake support tickets on admin page visit; fabricated homepage/about stats.
- **RLS coverage guard:** `__tests__/rls-coverage.test.ts` parses real SQL and fails if any table lacks RLS (defense against future migrations). All 114 tables covered.

### 2c. Payments money-flow — audited + documented
- The donation flow is **recipient-first and sound**: `POST /api/donations` → `resolvePayoutDestination` → **409 `PAYOUT_NOT_READY`** unless the recipient's connected account is `verified` + `details_submitted` + `charges_enabled` + `payouts_enabled`. Destination charges, `application_fee` = tip only. Funds never sit in the platform balance.
- Added `lib/payout-destination.ts#accountIsPayoutReady` (pure) + `__tests__/payout-destination.test.ts` (money-flow test #1) and **`docs/payments/money-flow.md`** (documents the destination-vs-direct-charge decision + counsel-review items).
- **Open (needs Stripe test keys / owner):** daily reconciliation with incident-on-mismatch, refund fee-allocation, negative-balance recovery, direct-charge feature-flag path per country/recipient.

### 2d. Schema-resilience for public discovery
- `lib/campaign-visibility.ts` (`campaignColumns` probe + `applyLiveFilters`/`applyVisibilityFilters`) so public pages render on a partially-migrated DB. Applied to homepage, `/campaigns`, `/success-stories`, `/leaderboard`, `/ai-fundraising`, `sitemap.ts`. (Remote now has the columns, so this is defense-in-depth.)

### 2e. Super-admin for Daniel
- `daniel.hughen@gmail.com` added to `HARDCODED_ADMIN_EMAILS` in `lib/roles.ts` (durable, highest-priority `isAdmin` path). His DB profile already had `admin`. The admin console is 35 pages, all gated by `app/admin/layout.tsx` (`requireAdmin`).

### 2f. Marketing → SEO & AEO (new, fully wired)
- The `seo_settings` and `aeo_entries` tables existed with **zero** wiring. Built:
  - `app/api/admin/seo/route.ts` (GET/POST/DELETE, per-route SEO overrides, route-keyed upsert).
  - `app/api/admin/aeo/route.ts` (GET/POST/DELETE, Q&A: question/answer/topic/schema_type/priority/published).
  - `app/admin/marketing/seo/page.tsx` + `_components/SeoAeoClient.tsx` (tabbed CRUD, dark/light tokens), linked from the Marketing landing top bar.
  - Verified with a self-cleaning insert→read→delete round-trip against the live tables (0 rows left).
- **Public AEO surfacing:** `lib/aeo.ts#getPublishedFaqs` + `groupFaqsByTopic`; `/faq` is now async + ISR(300s) and renders **published** AEO entries **both visibly and in the FAQPage JSON-LD** (matching content). Verified in `next dev`: published entry in HTML **and** parsed JSON-LD; unpublished entry in **neither**.

## 3. High-value next candidates (for the next bot)
1. **Merge published AEO entries into the homepage FAQ JSON-LD** too (homepage has its own hardcoded FAQ block — parallel session actively edits it, coordinate).
2. **Payments hardening (needs Stripe test keys):** reconciliation job + incident creation, refund fee-allocation, negative-balance recovery. See `docs/payments/money-flow.md` open items.
3. **Per-persona RLS test harness** against a throwaway Postgres (the coverage guard is static-only).
4. **Rename duplicate-timestamp migrations** (repo-only) before any CLI migration management.
5. **Seed real SEO/AEO content** via `/admin/marketing/seo` (currently empty; not seeded to avoid fake prod data).
6. **Data hygiene (owner approval needed for writes):** 508 auth users lack a `profiles` row (bulk/seed users predating the `handle_new_user` trigger) — optional backfill; analytics tables are empty.

## 4. Verification recipe (what "done" means here)
- `npx tsc --noEmit` (0 errors) · `npx vitest run` (all pass) · `npx eslint .` (0 errors) · `npx next build` (all routes emit).
- DB-driven UI: verify with `next dev` (ISR-safe), not `next start`.
- DB reads/writes: Management API SELECT (read) — writes only with owner approval, and prefer self-cleaning test rows (insert→verify→delete) over leaving fake prod data.
