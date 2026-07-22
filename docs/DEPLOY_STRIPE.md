# Stripe → Production (Vercel) — setup checklist

Everything the app needs to run payments in production. Set these in **Vercel →
Project → Settings → Environment Variables** (Production scope), then redeploy.
Secret **values** are intentionally not written here — copy them from your Stripe
Dashboard. The price IDs below are **not** secret (they're used client-side).

## 1. Environment variables to set in Vercel

| Variable | Where to get it | Notes |
|----------|-----------------|-------|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → **Secret key** (`sk_live_…`) | Secret. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same page → **Publishable key** (`pk_live_…`) | Public. |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → `www.charitme.com/api/stripe/webhook` → **Signing secret** (`whsec_…`) | Secret. Signs all 20 events. |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | resolved | `price_1TbRHnBrwQtGmNLkGHtm2BrD` ($19/mo) |
| `STRIPE_STARTER_YEARLY_PRICE_ID` | resolved | `price_1TbRI5BrwQtGmNLk6BdLGetC` ($228/yr) |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | resolved | `price_1TbRIKBrwQtGmNLknRFNkTZ5` ($59/mo) |
| `STRIPE_PRO_YEARLY_PRICE_ID` | resolved | `price_1TbRIWBrwQtGmNLkkh0b32KR` ($708/yr) |
| `DEFAULT_DONOR_TIP_PERCENT` | — | `15` |

**`STRIPE_CONNECT_WEBHOOK_SECRET` — leave UNSET.** Verified in the handler
(`app/api/stripe/webhook/route.ts`): it filters out unset secrets and tries
`STRIPE_WEBHOOK_SECRET` first. Your account uses a **single** webhook endpoint that
already receives the Connect events (`account.updated`, `payout.*`, `transfer.*`),
so the main secret verifies everything. Only set a Connect secret if you later add a
**separate** Connect webhook endpoint with its own signing secret.

## 2. Already done (this session)

- ✅ Production webhook `www.charitme.com/api/stripe/webhook` expanded **2 → 20
  events** (the full set the handler processes: checkout, invoice, payment_intent,
  charge/refund/dispute, subscription, account, transfer, application_fee, payout).
- ✅ Unknown endpoint `eli54u.com` **disabled** (was receiving 8 sensitive live
  events).
- ✅ Subscription price IDs resolved from your product IDs (table above).

## 3. Owner action still required

1. Set the variables in **section 1** in Vercel, then redeploy.
2. **Delete** the disabled `eli54u.com` webhook endpoint permanently (Stripe →
   Developers → Webhooks) after confirming it isn't a first-party service.
3. **Rotate** the secret/restricted keys, webhook signing secret, Supabase
   service-role + access token, DB password, Resend, Google OAuth secret, and CRON
   secret — they were shared in chat/a file and must be considered compromised.

## 4. Verifying end-to-end (after deploy)

Do a **real** small donation ($1) with a live card, confirm the donation row is
created (webhook `checkout.session.completed` → `record_donation`), then **refund**
it from the Stripe Dashboard and confirm the refund + ledger update. Same for a
CharitMe Starter subscription checkout. (A live charge can't be exercised from the
dev sandbox — ADR-0003.)
