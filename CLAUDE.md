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
- **Donations**: POST /api/donations → Stripe Checkout Session → webhook `checkout.session.completed` → `increment_campaign_stats` RPC
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

**Unsplash covers**: `lib/unsplash.ts` (API client, day-cached, key-gated) + `lib/covers.ts`
(`resolveCampaignCover`: real uploaded cover → live themed Unsplash → stored/deterministic Picsum
placeholder — Picsum URLs are treated as overridable placeholders so live Unsplash can replace them). Only
the **Access Key** is used (public read) and only from `UNSPLASH_ACCESS_KEY` — set it in Vercel;
never commit it. The Secret Key is not used anywhere. Without the key everything falls back
cleanly, so builds/tests never touch the network.

### Deployment
- Vercel (auto-deploy from `main`) — primary
- Render fallback (`render.yaml`, rootDir: apps/web)
- Node 20 pinned via `.node-version`
- Health check: `GET /api/health` → `{"status":"ok","ts":...}`
