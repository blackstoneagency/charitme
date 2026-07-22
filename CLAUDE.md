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
- Platform fee: 5% via `application_fee_amount` on payment_intent (only when fundraiser has connected Stripe)

### Auth flow
1. `middleware.ts` refreshes session on every non-API request; redirects unauthenticated users hitting `/create` or `/dashboard` to `/login?next=<path>`
2. Login/signup call `createClient()` from `lib/supabase-browser.ts`
3. OAuth + email confirm land on `/api/auth/callback`
4. `lib/auth-config.ts`: `safeNextPath()`, `getAppOrigin()`, `getAuthCallbackUrl()`
5. `lib/auth.ts`: `getUser()` / `requireUser()` for server components

### Shared business logic
Import with `@shared/fees`. Contains: `platformFee()`, `netToFundraiser()`, `CAMPAIGN_CATEGORIES`, `MIN_DONATION_CENTS`.

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
```

### Deployment
- Vercel (auto-deploy from protected `master`) — primary
- Render fallback (`render.yaml`, rootDir: apps/web)
- Node 20 pinned via `.node-version`
- Health check: `GET /api/health` → `{"status":"ok","ts":...}`
