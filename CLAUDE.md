# CLAUDE.md

## Commands

```bash
# Install
npm install

# Dev (from apps/web)
cd apps/web && npm run dev     # http://localhost:3000

# Build / typecheck
npm run build --workspace=apps/web
npm run typecheck --workspace=apps/web

# Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Architecture

### Monorepo
```
0.RaiseMoney/
├── apps/web/           — Next.js 14 App Router
│   ├── app/            — pages + API routes
│   ├── components/     — AppShell.tsx, ui.tsx
│   └── lib/            — supabase clients, stripe, auth helpers
├── packages/shared/    — fees.ts: platform fee, categories, limits
└── supabase/schema.sql — generated full schema mirror (see scripts/regen_schema.sh); catch_up.sql patches existing DBs
```

### Supabase client pattern — CRITICAL
Three separate clients, never mix them:

| File | Used in | Key |
|------|---------|-----|
| `lib/supabase-browser.ts` | Client components (`'use client'`) | anon key |
| `lib/supabase-server.ts` | Server components, Route Handlers | anon key + `cookies()`, server-only guarded |
| `lib/supabase.ts` | API routes only | `supabaseAdmin` with service role key, bypasses RLS |

### Key tables
- `profiles` — extends auth.users; has `stripe_account_id`, `stripe_onboarded`
- `campaigns` — slug, goal_amount/raised_amount in **cents**, backer_count, status
- `donations` — amount_cents, stripe_payment_intent_id, anonymous flag
- `campaign_updates` — campaign news posts by the fundraiser

### Stripe flows
- **Donations**: POST /api/donations → Stripe Checkout Session → webhook
  `checkout.session.completed` → **`record_donation` RPC**. ⚠️ This previously read
  `increment_campaign_stats`, which **no longer exists as an RPC** — there is no such
  function in the schema, and no code calls it. `record_donation` inserts the donation
  and a DB trigger (`donations_increment_campaign_stats`) moves the campaign totals.
  It is **idempotent on `p_stripe_event_id`**, which is why every caller may safely
  throw and let Stripe retry — and why they all do. The full RPC surface is only
  six functions: `record_donation`, `decrement_campaign_stats`,
  `claim_campaign_reward`, `check_rate_limit`, `get_admin_system_resource_usage`,
  `reload_postgrest_schema_cache`.
- **Payouts**: POST /api/stripe/connect → Stripe Connect Express onboarding → GET /api/stripe/connect?return marks `stripe_onboarded = true`
- **Platform fee is 0%.** `PLATFORM_FEE_PERCENT = 0`. The `application_fee_amount`
  on the payment_intent is `tipCents + processingFeeCents` — the donor's optional
  tip plus the Stripe processing fee — not a percentage cut of the donation
  (`app/api/donations/route.ts`). Set only when the fundraiser has connected Stripe.
  ⚠️ This previously read "5% via application_fee_amount", which no longer matched
  the code. Do not "restore" a percentage platform fee on the strength of the old
  wording, or of the inert helpers noted below.

### Auth flow
1. `middleware.ts` refreshes session on every non-API request; redirects unauthenticated users hitting `/create` or `/dashboard` to `/login?next=<path>`
2. Login/signup call `createClient()` from `lib/supabase-browser.ts`
3. OAuth + email confirm land on `/api/auth/callback`
4. `lib/auth-config.ts`: `safeNextPath()`, `getAppOrigin()`, `getAuthCallbackUrl()`
5. `lib/auth.ts`: `getUser()` / `requireUser()` for server components

### Shared business logic
Import with `@shared/fees`. Contains: `CAMPAIGN_CATEGORIES` (the **single source of
truth** — never re-declare this list locally; three hand-maintained copies had
already drifted), `MIN_DONATION_CENTS`, `PROCESSING_FEE_PERCENT`/`_FIXED_CENTS`,
and the tip tiers.

Also exports `platformFee()` / `netToFundraiser()`, which are **currently inert**:
`platformFee()` returns 0 because `PLATFORM_FEE_PERCENT = 0`, and
`netToFundraiser()` has no callers outside tests. They are the remains of the old
percentage-fee model. Left in place rather than deleted since they are public
exports of a shared package — but the live fee path is the tip + processing
calculation in `app/api/donations/route.ts`, not these.

### UI components (`components/ui.tsx`)
`Btn`, `Input`, `Textarea`, `Select`, `Badge`, `ProgressBar`, `Card`, `Spinner`, `EmptyState` — all inline styles with CSS variables. No Tailwind, no CSS modules.

### CSS variables (defined in `app/globals.css`)
`--bg`, `--s1/s2/s3/s4`, `--b1/b2/b3`, `--green/--green-dark/--green-light`, `--red`, `--blue`, `--t1/t2/t3/t4`, `--font`, `--mono`, `--r/--rl/--rxl`, `--shadow/--shadow-md/--shadow-lg`

### Environment variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
UNSPLASH_ACCESS_KEY   # optional — themed live campaign covers; falls back to Picsum when unset
```

**Beyond the core set above, 18 more are read from `process.env` in app code.** They
were previously undocumented, so a deploy following this file alone would silently
lose payouts, billing and all outbound email. Grouped by what breaks without them:

```
# Payments — payouts and subscriptions break silently if unset
STRIPE_CONNECT_WEBHOOK_SECRET   # Connect webhooks (payout status). Surfaced by /api/health
STRIPE_STARTER_MONTHLY_PRICE_ID # ─┐ subscription checkout cannot resolve a price
STRIPE_STARTER_YEARLY_PRICE_ID  #  │ without these; the plan simply fails to start
STRIPE_PRO_MONTHLY_PRICE_ID     #  │
STRIPE_PRO_YEARLY_PRICE_ID      # ─┘

# Email — without RESEND_API_KEY every email is DROPPED (logs an error in prod only)
RESEND_API_KEY
EMAIL_FROM
SUPPORT_EMAIL
CONTACT_EMAIL                   # falls back to ADMIN_EMAILS, then a hardcoded address

# Access control
ADMIN_EMAILS                    # comma-separated; grants admin (lib/roles.ts)
CRON_SECRET                     # Bearer token for /api/cron/*. Fails SAFE when unset —
                                # the route then demands an admin session, so an unset
                                # value locks cron out rather than opening the endpoint

# AI — features degrade to deterministic fallbacks when unset (never hard-fail)
OPENAI_API_KEY
OPENAI_MODEL

# AI Control Center (/admin/ai) — super-admin only
GITHUB_TOKEN                    # ─┐ repo-scoped PAT + "owner/name". Without BOTH,
GITHUB_REPO                     #  │ the console reports "Not configured" and every
                                # ─┘ GitHub number shows "—" (never 0). GITHUB_PAT and
                                #    GITHUB_REPOSITORY are accepted as aliases.

# Optional integrations / misc
NEXT_PUBLIC_FACEBOOK_APP_ID     # social share
OPENCORPORATES_API_TOKEN        # nonprofit verification enrichment
SUPABASE_ACCESS_TOKEN           # tooling/scripts, not request-path
DEFAULT_DONOR_TIP_PERCENT       # overrides the shared default tip tier
VERCEL_URL                      # provided by Vercel; origin fallback
```

**Unsplash covers**: `lib/unsplash.ts` (API client, day-cached, key-gated) + `lib/covers.ts`
(`resolveCampaignCover`: real uploaded cover → live themed Unsplash → stored/deterministic Picsum
placeholder — Picsum URLs are treated as overridable placeholders so live Unsplash can replace them). Only
the **Access Key** is used (public read) and only from `UNSPLASH_ACCESS_KEY` — set it in Vercel;
never commit it. The Secret Key is not used anywhere. Without the key everything falls back
cleanly, so builds/tests never touch the network.

### AI Control Center (`/admin/ai`) — super-admin only
Phase 1 of the AI Context Manager: an agent roster plus one-click context packs.

- **Gating is doubled.** `app/admin/layout.tsx` requires admin; the page also calls
  `requireSuperAdmin()` (redirects a plain admin to `/admin`), and
  `POST /api/admin/ai/context` calls `guardSuperAdmin()` before any work. The sidebar
  entry lives in `SUPER_ADMIN_NAV` (`components/SuperAdminNav.tsx`), which self-gates
  via `/api/admin/super/whoami` — **do not** add it to `adminNav` in `CharitMeApp.tsx`,
  that list renders for every admin.
- **The roster is `AI/employees/*.md` at the repo root — not a list in TypeScript.**
  `scripts/generate-ai-roster.mjs` compiles those docs (plus `AI/sprints/*.md`) into
  `lib/ai-roster.generated.ts`; `prebuild` runs it and a test fails if the committed
  output drifts. Adding an employee means adding a markdown file. They are **baked in
  at build time, not read with `fs`**: `AI/` sits outside `apps/web`, so Next's output
  file tracing would not ship it into a Vercel function — the roster would be empty in
  production while working fine in dev.
- The **current sprint** comes from the highest-numbered `AI/sprints/sprint-NNN.md`,
  never from a GitHub milestone. One answer to "which sprint is this?", not two.
- `lib/ai-agents-core.ts` is **pure** (status, fact assignment, `buildContextPack`). An
  agent's `requires` is **derived** from the sources of its `facts` — declaring the two
  separately is how QA Engineer ended up reading a Supabase fact while requiring only
  GitHub, which would have shown **Ready** with the database down.
- ⚠️ **`open_issues_count` counts pull requests as issues.** Measured against this repo:
  it reports `1` while the only open item is PR #93 — i.e. 0 issues, 1 PR. The issue
  count is always `deriveOpenIssues(open_issues_count, openPRs)` (`lib/github-core.ts`).
  Never render that field directly.
- **Only repo-scoped `repos/{owner}/{repo}/...` endpoints.** The Search API would give
  issue counts in one call but is refused by gateways that bind a token to specific
  repositories — the agent sandbox returns `403 "sessions are bound to their configured
  repositories"` for it.
- Every count is `number | null`; `null` renders as `—`. On this screen 0 is the
  *reassuring* answer ("no open issues", "no risk flags"), so it must be measured. Do
  not reintroduce `?? 0` anywhere in this path.
- Sandbox note: node's `fetch` ignores `HTTPS_PROXY`, so a direct live call from here
  401s. Verify through `undici`'s `ProxyAgent` with `/root/.ccr/ca-bundle.crt`.

### Deployment
- Vercel (auto-deploy from `master`) — primary. **The branch is `master`, not
  `main`** — no `main` branch exists in this repo, and `vercel.json` sets no
  `git.productionBranch`, so production tracks the branch configured in the Vercel
  dashboard. Don't "fix" this to `main`; that would point production at a branch
  that isn't there.
- Render fallback (`render.yaml`, rootDir: apps/web)
- Node pinned via `.node-version` (**20.19.0** — must stay ≥ the `engines` floor in
  `apps/web/package.json`; rolldown/vitest 4 require `^20.19.0 || >=22.12.0`)
- Health check: `GET /api/health` → `{"status":"ok","ts":...}`


## 🔁 CI FLIPS BETWEEN REAL AND DEAD — run the test, don't trust the last verdict

This section has now been rewritten **three times**, in both directions, because
the runners keep going away and coming back. So it no longer states a verdict.
**Run the check yourself — it takes one call.**

```
mcp__github__actions_get  method=get_workflow_run_usage  resource_id=<run_id>
mcp__github__actions_get  method=get_workflow_job        resource_id=<job_id>
```

| | runners DEAD (ignore the red check) | runners ALIVE (fix the red check) |
|---|---|---|
| `billable.UBUNTU.total_ms` | **0** | thousands |
| `runner_id` | **0** | e.g. `1000001483` |
| `runner_name` | **empty** | e.g. `"GitHub Actions 1000001483"` |
| duration | ~10s, start≈finish | minutes (~3m09s for a full run) |
| steps | **none** | checkout → setup-node → install → typecheck → lint → tests → audit → build |
| logs | 404 | present |

**Also check `master`.** If master's recent runs fail identically, the failure is
not your branch. Both facts together are conclusive.

**Timeline so far:** dead for ~2 weeks → alive 2026-08-01 (run `30704209059`,
`runner_id: 1000001483`, 3m09s) → **dead again 2026-08-02**, verified on run
`30751833105` (`runner_id: 0`, empty `runner_name`, 10s, 0 billable ms) *and* on
master run `30750918547` (same signature; master's last 6 runs all failed).

**Whichever state it is in, verify locally — that is the only signal that never
lies:**

⚠️ **CI can fail where your local run passes, and usually for one reason:**
master has gained tests your branch has not merged. A local run of 2251 against
CI's 2283 is not flakiness — it is 32 tests you do not have yet. **Merge master
before concluding CI is wrong.** That exact gap hid a real nav-orphans failure
on 2026-08-01.

Verify locally anyway — it is faster than a CI round trip:

```bash
npm run typecheck --workspace=apps/web     # tsc --noEmit
npm run lint      --workspace=apps/web     # eslint (0 errors expected)
npm test          --workspace=apps/web     # vitest
npm run audit:campaign-images --workspace=apps/web
npm run build     --workspace=apps/web
# e2e — the env var points Playwright at the sandbox's prebuilt browser:
cd apps/web && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
```

If `npm run typecheck` fails on a missing module, run `npm install` first — the lockfile
moves when other agents add dependencies.

### The `scripts/audit-*.mjs` suite — the strongest signal available, and easy to miss

`apps/web/scripts/` holds a **browser-driven audit suite** that is far more thorough than
any hand-rolled sweep, and it **runs fine locally** (unlike `e2e/*.spec.ts`, which only
runs under the dead Playwright job and is therefore currently *decorative* — a real
light-mode contrast bug reached production underneath a passing-by-default e2e spec).

Start a production build on some port, then point the audits at it:

```bash
npm run build && npx next start -p 4123        # from apps/web
npm run audit:contrast        -- --base http://localhost:4123   # 37 pages × 2 themes
npm run audit:responsive      -- --base http://localhost:4123   # × 3 viewports × 2 themes
npm run audit:image-dupes                                       # 500 covers, perceptual hash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npm run audit:web-vitals    -- --base http://localhost:4123   # LCP / CLS / INP
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npm run audit:scroll-keyboard -- --base http://localhost:4123
npm run audit:focus-order     -- --base http://localhost:4123   # 60 pages × 2 themes
```

`audit:focus-order` tabs through every public route in a real browser. It exists
because **axe cannot press Tab** — it inspects a static snapshot, so it cannot see
a focus trap, a focus stop that is invisible, or a focus order that disagrees with
the visual order. Those are the failures that actually strand a keyboard user, and
all three are invisible to a screenshot.

⚠️ Its first run reported 7 failures and **all 7 were artifacts of the audit
itself** — worth knowing before trusting a future run:
- it compared link TEXT to detect traps, so a list of cards each carrying
  "Try it now"/"Learn more" looked like an A-B-A-B cycle;
- it flagged `opacity: 0` inputs without noticing the focus ring is painted on a
  visible sibling (`.cb-filter-pill input:focus-visible + span`) — the standard
  custom-control pattern, correctly implemented;
- it compared **viewport-relative** `y` between tab stops while tabbing
  auto-scrolls the page, which made the focus-order metric meaningless.

All three are fixed and mutation-tested in both directions: it catches a planted
trap and a planted invisible focus stop, and does *not* flag the delegated-indicator
pattern. It also self-checks that it actually tabbed, and fails if it did not.

**Two traps, both of which look like broken tooling and aren't:**
1. `audit-web-vitals` and `audit-scroll-keyboard` read **`PLAYWRIGHT_CHROMIUM_PATH`**;
   `audit-contrast` and `audit-responsive` hardcode `/opt/pw-browsers/chromium`. Omit the
   env var and the first two abort with *"Please run npx playwright install"*.
2. Default `--base` is `:3000`/`:3100`, so without `--base` they silently audit nothing
   useful.

**Prefer these over writing your own harness.** `audit:contrast` sweeps **both themes** by
default — the site ships **dark**, so a hand-rolled axe run measures dark twice and reports
a false all-clear. That is exactly how a 2.56:1 light-mode failure survived.
