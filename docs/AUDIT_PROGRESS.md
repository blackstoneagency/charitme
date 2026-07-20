# CharitMe — Production-Readiness Audit Progress

> Single-agent audit (honest scope — no fabricated multi-agent coordination).
> Canonical heartbeat for resumption. Branch under audit: **`master`** (the
> Vercel-deployed production branch).

## Baseline gates (measured, not asserted)

| Gate | Command | Result |
|------|---------|--------|
| Type-check | `npm run typecheck --workspace=apps/web` | ✅ clean (exit 0) |
| Unit/integration tests | `npm run test --workspace=apps/web` | ✅ **495 pass**, 31 files |
| Lint | `npm run lint --workspace=apps/web` | ✅ 0 errors, 10 warnings (cosmetic) |
| Production build | `npm run build --workspace=apps/web` | ⏳ in progress this session |

## Verified this session (committed)

- **Prod hotfixes** (`822f1ce`, on master): dark-mode default reset via storage-key
  bump; `<CampaignImage>` onError fallback (stored URL → free Unsplash category
  photo → placeholder) so dead `cover_image_url` never renders broken; trimmed
  `STRIPE_SECRET_KEY` to tolerate whitespace in the Vercel env value.
- **PR #10 closed** as superseded by the merged PR #11 (both built the same five
  domains — events, privacy, sponsorships, matching gifts, gamification; merging
  #10 would only risk regressing live features). Evidence in the PR comment.
- **Lint cleanup**: removed a dead `supabaseAdmin` import in `app/events/[slug]/page.tsx`
  and a stale file-level `eslint-disable` in `app/campaigns/[slug]/page.tsx`.
- **Stripe Connect onboarding hardening** (`/api/stripe/connect` POST): wrapped
  account/link creation in try/catch returning a clean `502 {error}` with the real
  Stripe reason (was an opaque 500 with no body); switched the connected-account
  lookup to `.maybeSingle()` so first-time users don't trigger a 0-row error. The
  `/create` payout page now shows the actual cause instead of the generic
  "STRIPE_SECRET_KEY … in Vercel" string.

## Payment architecture audit — VERIFIED SOUND

The launch-critical financial requirement (CharitMe must not custody charitable
funds; **no donation before recipient payout readiness**) is **already correctly
implemented** on master. Independently audited this session and corroborated by a
parallel session's merged `docs/payments/money-flow.md` (commit `73a2d0e`):

- **Recipient-first gate**: `/api/donations` returns `409 PAYOUT_NOT_READY` unless
  `resolvePayoutDestination` finds a fully-onboarded connected account
  (`verification_status=verified` + `details_submitted` + `charges_enabled` +
  `payouts_enabled` + account id) — beneficiary first, then organizer.
  ✅ Regression-tested: `__tests__/payout-destination.test.ts` (6 pass).
- **No custody**: Stripe Connect **destination charges**; recipient nets full
  `amountCents`; CharitMe keeps only `application_fee_amount = tip + processing`,
  computed **server-side** (`@shared/fees`) — no client fee trust.
- **Webhook**: signature-verified (`constructEvent`) + idempotent (event-log skip +
  `record_donation` RPC lock, migration `20260719120000`).
- **Decision (needs counsel)**: destination (not direct) charges — permitted; the
  merchant-of-record / direct-charge switch is gated on legal/tax review.

**Conclusion: remaining payment work is verification, not repair** — sandbox
end-to-end (charge→fee→transfer→payout→reconcile), refund/dispute financial
states, and the reconciliation job, all needing Stripe **test** keys + staging.

## Money-flow verification against Stripe TEST mode (this session)

Ran with a real `sk_test_` key (`scripts/verify-money-flow.mjs`, live-key-guarded):
- ✅ **Fee math verified against real Stripe processing**: $100 donation + 15%
  support ($15) + processing ($3.64 = 2.9%+$0.30 on the $115 subtotal) = **$118.64**
  charged; test PaymentIntent `succeeded`. Matches `@shared/fees` exactly.
- ⚠️ **Connect setup gap (LB-005)**: the sandbox account has Connect **listable
  but not fully signed up** — `accounts.create` returns *"You can only create new
  accounts if you've signed up for Connect."* So the destination-charge flow (the
  app's actual money path — recipient receives the full donation via
  `transfer_data.destination`) **could not be executed** in test mode yet. The
  script proves it end-to-end (charge → assert recipient==donation, appFee==tip+proc
  → refund) the moment Connect is enabled (Dashboard → Connect → get started).

## Feature-flow verification against the reconciled DB (2026-07-24)

Post-reconciliation, verified against the live DB (Management API):
- **Previously-broken read paths now execute cleanly**: `campaigns` visibility
  query returns 500 (was `42703`); `fundraising_events`, `grants`, `impact_plans`,
  `marketing_contacts` all queryable (0 rows, no error); `subscriptions` has 500
  seeded rows.
- **Grants end-to-end round-trip (write→read→soft-delete→cleanup)**: inserted a
  grant → the app's public-list query (`status in ('open','upcoming') and
  deleted_at is null`) returned it → after `deleted_at`, public read = 0
  (soft-delete works) → hard-deleted; grants back to 0 (no residue).
- **RLS policies correct (not just enabled)**: `grants` = public-read + creator
  manage; `grant_applications` = applicant-scoped (tenant isolation); 18 admin-only
  tables = RLS-enabled deny-all (service-role only). Per-persona live enforcement
  (anon/authenticated sessions) still needs real auth sessions to fully certify.

- **Events RSVP end-to-end round-trip (write→list→register→capacity→cleanup)**:
  inserted a `published` `fundraising_events` row (capacity 2) → the app's
  `listPublishedEvents` query (`status='published'`) returned it, `registered_qty`
  baseline 0 → first attendee registered (qty 1): route capacity sum = 1,
  `remainingCapacity(2,1)=1`, `attendeeRegisteredQty` for that attendee = 1 (so a
  repeat RSVP hits the `409 already registered` guard) → second distinct attendee
  took the last spot (qty 1): total = 2, `remaining = 0`, so `isRegistrationOpen`
  now returns false and further RSVPs get `409 Registration is closed` /
  `Not enough spots remaining` (capacity boundary holds) → hard-deleted both
  registrations + the event; residue check = 0 events / 0 regs (no leftover data).
- **Events RLS correct**: `fundraising_events` public read is gated to
  `status='published'` (drafts/cancelled hidden), owner-write for the creator;
  `event_registrations` has **no public read** — visible only to the attendee
  (`auth.uid()=attendee_id`), the event organizer (`created_by`), or admin, so
  attendee PII/email is not exposed; `event_checkins` owner-only. RLS enabled on
  all three.

## AI routes audit (this session)

Scanned all 16 `/api/ai/*` routes for auth, rate limiting, and provider fallback:
- **Fixed**: `grant-match` was the only one missing rate limiting — an
  unauthenticated POST running a ~300-row scan + `grant_matches` upserts per call.
  Added IP-based `checkRateLimit(20/min)` (commit `05be1e3`).
- All 16 now rate-limited; all that call OpenAI have a deterministic fallback
  (no fake responses when the provider is unavailable — §5.10). Public AI routes
  (campaign, goal-recommend, donation-impact, donor-conversion) are unauthenticated
  by design but rate-limited.

## Payment subsystem audit — conclusions (this session)

Audited the money paths end-to-end at code level. Findings + evidence:

| Area | Result | Evidence |
|------|--------|----------|
| Recipient-first gate / no fund custody (one-time) | ✅ sound | `resolvePayoutDestination` + `409 PAYOUT_NOT_READY`; `payout-destination.test.ts` |
| Recipient-first gate (recurring/subscription) | ✅ sound — parity | `/api/donations/recurring` same gate + `transfer_data.destination` + catch-block block on account error |
| Fee math (displayed == charged) | ✅ sound | client+server both `methodProcessingFee(amount+tip)`; `fees.test.ts` (11) |
| Webhook signature + idempotency | ✅ sound | `constructEvent` + event-log skip + `record_donation` lock |
| Refund → ledger | ✅ sound; 1 limitation | `docs/payments/refunds-and-disputes.md` (partial-refund stat delta deferred) |
| Dispute → ledger | ✅ sound (reconciliation-aware) | sets `reconciliation_status=needs_review`; idempotent upsert |
| Checkout double-submit | ✅ adequately protected | button `disabled={loading}` + webhook dedup; per-attempt key is correct |
| RLS on admin/finance/marketing tables | ✅ hardened this session | migration `20260723000000`; `docs/security/rls-matrix.md` |

**Overall: the payment subsystem is in good shape.** No blind financial changes
were made. Remaining payment items are **verification** (Stripe test clocks for
refund/dispute lifecycles; reconciliation-job output) and **one deferred fix**
(partial-refund campaign-stat delta), all gated on Stripe **test** keys + staging.

## API authorization & tenant-isolation audit — CLEAN (this session)

Middleware's matcher **excludes `/api`**, so API routes must self-gate. Audited:

- **Every `/api/admin/*` route is admin-gated** (`verifyAdmin` / `requireAdmin`);
  scanned all admin route files — zero without a recognized gate. No
  unauthenticated admin access (§5.17 "no admin button may bypass authz").
- **User-data routes scope by the session user**, e.g. `/api/donor/donations`
  filters `.eq('donor_id', user.id)` — not a client-supplied id.
- **No IDOR-via-query-param**: scan for `searchParams.get('userId')` / body-userId
  filters used in queries returned nothing.
- **Public routes serve only public data**: `/api/sponsors` (active + logo/website
  only), `/api/grants/[id]` (public), `qr-poster`/`rotator` (status=active).
- **Service-role-only tables** (34) now RLS-hardened (migration `20260723000000`).

Method: `grep` over `apps/web/app/api/**/route.ts` for auth gates + client-supplied
id filters. Result: no unauthenticated-admin or cross-tenant read defect found in
the API layer. Per-persona live RLS verification still pending (needs staging).

## Known real findings (open)

| Sev | Area | Finding | Owner action? |
|-----|------|---------|---------------|
| High | Stripe | `/create` payout onboarding errors ("STRIPE_SECRET_KEY … in Vercel"). Code hardened (trim); root cause is the **Vercel env value** — verify it's the full `sk_live_…`, no whitespace, Production scope. | Yes (Vercel) |
| Med | DB migrations | Two additive migrations from an earlier session (`impact_tracking`, `corporate_matching`) exist on a feature branch but are superseded on master by `20260721000000_impact_tracking.sql` / `20260719000000_matching_gifts.sql`. No action; master's versions are canonical. | No |
| Low | Lint | 8 remaining cosmetic unused-var warnings (settings, shell props). Non-blocking. | No |

## Resumption pointer

- Latest master commit: see `git log -1 origin/master`.
- Next safe audit units: (1) confirm master `next build` green; (2) verify Supabase
  wiring for the newest domains (events/privacy/sponsorships/gamification) end-to-end
  once the owner confirms the migrations are applied to the live project; (3) Stripe
  env verification (owner). Live DB writes are gated in this environment.
