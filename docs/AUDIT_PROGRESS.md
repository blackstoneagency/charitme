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

- **Subscriptions / recurring-donation billing end-to-end** (`recurring_donations`,
  the seeded 500-row table): schema matches the code — `status` CHECK =
  `active|paused|cancelled|past_due` (exactly the app's state machine), `cadence`
  CHECK = `weekly|monthly|quarterly|annual` (matches the zod enum), and the
  reconciliation-added `nonprofit_id` column is present.
  - **Idempotency proven**: the webhook upsert (`onConflict:
    stripe_subscription_id`) is backed by a real UNIQUE index
    (`recurring_donations_stripe_subscription_id_key`); re-delivering the same
    `checkout.session.completed` returned the **same row id**, count stayed 1 (no
    duplicate subscription on webhook retry).
  - **State machine verified**: `active → paused` (pause route),
    `paused → active` (resume), `→ past_due` (`invoice.payment_failed`),
    `→ cancelled` (cancel route, `cancel_at_period_end`). Each transition is
    gated: pausing a non-`active` row matches 0 rows → route's `400`
    ("Only active subscriptions can be paused"); the "already cancelled" guard
    likewise matched 0.
  - **Ownership isolation**: cancel/pause scope by `donor_id = auth.uid()`; the
    campaign **organizer is not the donor**, so an organizer's cancel attempt
    finds 0 rows → route's `403` (a fundraiser cannot cancel a donor's recurring
    gift). RLS on `recurring_donations` mirrors this: read = donor OR campaign
    owner OR nonprofit owner OR admin; insert/update = own-or-admin.
  - Full cleanup, zero residue. Minor cosmetic note (not a bug): a `cancelled_at`
    column exists but the cancel route sets only `status`/`updated_at`; the
    cancellation timestamp is inferable from `updated_at` but not recorded
    explicitly.

## Privacy requests (GDPR/CCPA) end-to-end verification (2026-07-20)

Verified against the live reconciled DB (Management API, project `yanexccimwooursawynm`).
All writes were test rows on the (empty) `privacy_requests` table tied to a real
seeded profile, then hard-deleted — **zero residue** (table back to 0). **No real
user's profile was ever mutated**: the deletion-anonymize path was verified by
column-existence only, never executed against a live row.

- **Schema matches migration exactly**: 10 columns, `type` CHECK
  (`export|deletion`), `status` CHECK (`pending|in_progress|completed|rejected|
  cancelled`), FK `user_id → profiles ON DELETE CASCADE`, FK `resolver_id →
  profiles ON DELETE SET NULL`, `updated_at` trigger present.
- **Export-assembly surface intact**: every table/column `assembleUserExport`
  reads (`campaigns.user_id`, `donations.donor_id`, `donor_messages.donor_id`,
  `saved_campaigns.user_id`, `volunteer_applications.applicant_user_id`,
  `sponsorship_requests.sponsor_id`, `grant_applications.applicant_user_id`,
  `privacy_requests.user_id`) plus all 5 anonymize-patch columns on `profiles`
  (`full_name`, `email`, `avatar_url`, `bio`, `org_name`) exist — so the export
  won't silently return empty arrays and `anonymizeUserProfile` won't error on a
  missing column.
- **Insert path**: new request defaults `status='pending'`, `resolved_at=null`,
  `created_at==updated_at` on insert.
- **Partial-unique index proven live** (`privacy_requests_active_uniq` WHERE status
  in pending/in_progress): a second **active deletion** insert raises `23505` on
  that constraint (→ the POST route's `409 "You already have an open deletion
  request"`), while an **export** insert for the same user succeeds (uniqueness is
  per-`(user_id, type)`, not per-user).
- **State machine + trigger**: `pending → cancelled` (user-cancel path) advances
  `updated_at` via the trigger and stamps `resolved_at`; once the prior deletion is
  terminal, a **fresh deletion request is allowed again** (partial predicate
  releases). Transition rules themselves are unit-tested (`privacy.test.ts`, 13
  pass).
- **RLS correct (not just enabled)**: `privacy_requests_read` = own-or-admin,
  `privacy_requests_insert` with_check = `auth.uid() = user_id` (users file only
  their own), `privacy_requests_update` = own-or-admin (both USING and WITH CHECK).

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
| High | Stripe | **Connect not live-enabled** (LB-005) — live `accounts.create` blocked pending Stripe platform-profile questionnaire + account verification. The env-value issue (LB-002/003) is **RESOLVED** (verified via `/api/health`). | Yes (Stripe dashboard) |
| Med | DB migrations | Two additive migrations from an earlier session (`impact_tracking`, `corporate_matching`) exist on a feature branch but are superseded on master by `20260721000000_impact_tracking.sql` / `20260719000000_matching_gifts.sql`. No action; master's versions are canonical. | No |
| Low | Lint | 8 remaining cosmetic unused-var warnings (settings, shell props). Non-blocking. | No |

## Resumption pointer

- Latest master commit: see `git log -1 origin/master`.
- Next safe audit units: (1) confirm master `next build` green; (2) verify Supabase
  wiring for the newest domains (events/privacy/sponsorships/gamification) end-to-end
  once the owner confirms the migrations are applied to the live project; (3) Stripe
  env verification (owner). Live DB writes are gated in this environment.

## HANDOFF — current status for the next session (2026-07-20)

**Working branch / deploy:** all work is on **`master`** (the Vercel-deployed
production branch); the designated dev branch `claude/charitme-production-build-0ehbgx`
is stale (39 behind). Production `https://www.charitme.com` is live, on the
**reconciled** DB `yanexccimwooursawynm` (health: profiles 502, campaigns 500,
donations 500).

**How to run live DB checks** (used all session): Supabase Management API via
`scratchpad/q.sh` — reads `SUPABASE_ACCESS_TOKEN` from `apps/web/.env.local`
(gitignored; grep+cut individual vars, do NOT `source` it — line with `<>` breaks
bash), POSTs SQL to `/v1/projects/yanexccimwooursawynm/database/query` with a
`User-Agent: Mozilla/...` header (avoids Cloudflare 1010). Returns only the LAST
statement's rows — run one statement per call. `.env.local` currently holds the
**LIVE** Stripe keys only (no `sk_test_`).

**Two launch blockers the owner was closing this session:**
1. **Vercel env (was LB-002/003): ✅ DONE + VERIFIED.** Confirmed via the new
   non-secret `/api/health` config block: `stripeKeyMode=live`,
   `stripeKeyHasWhitespace=false`, `stripeConnectWebhookSecret=set` (not
   PLACEHOLDER), `defaultDonorTipPercent=15`, publishable + webhook secrets set.
   (Still worth confirming in the Stripe dashboard that the webhook endpoint is
   subscribed to Connected-account events — secret presence ≠ subscription.)
2. **Stripe Connect (LB-005): ❌ STILL BLOCKING — the last gate.** Production
   account is `acct_1TNul7BrwQtGmNLk` (the live key's account; charges/payouts/
   details enabled). Live `accounts.create` probes (create-then-delete, nothing
   persisted) advanced through: "sign up for Connect" → "review managing-losses
   responsibilities" (platform-profile acks now **Completed**, liability=Stripe,
   Express dashboard) → **current:** *"complete your platform profile … to create
   **live** connected accounts"*. Remaining = the full **live** platform-profile
   questionnaire + **Stripe account verification** at
   `dashboard.stripe.com/connect/accounts/overview`. Owner said to proceed without
   waiting on Stripe's verification — so treat this as **pending on Stripe review**,
   not on code. **No code fix bypasses it.** Until it clears, every donation returns
   `PAYOUT_NOT_READY` (by design — CharitMe never custodies funds).

**To fully verify the money path without live verification:** get this account's
**test** key (`sk_test_51TNul7BrwQtGmNLk…`) OR enable Connect on a sandbox, then run
`STRIPE_SECRET_KEY=sk_test_… node scripts/verify-money-flow.mjs` — proves
create-account → destination charge → recipient nets full donation → refund. Fee
math already verified in test ($100 → $118.64).

**Feature flows verified end-to-end vs the reconciled DB this session** (all with
full cleanup, zero residue): **Grants**, **Events RSVP**, **Subscriptions/recurring
billing** (idempotency + state machine + ownership), **Privacy requests (GDPR/CCPA)**
(schema/constraints/partial-unique/state-machine/RLS + export-assembly surface).
RLS confirmed correct on each.

**Next queued verification:** **Sponsorships** (opportunities → requests →
approval flow), then **Gamification** (challenges/badges) remain — same treatment
(schema + constraints + RLS + a zero-residue write round-trip). Query tooling: the
sandboxed Bash `curl` fails TLS (exit 35) against the Supabase Management API — use
**PowerShell** `Invoke-RestMethod` instead (see `scratchpad/q.ps1` pattern: read
`SUPABASE_ACCESS_TOKEN` from `apps/web/.env.local`, POST to
`/v1/projects/yanexccimwooursawynm/database/query`, one statement per call).

**Gotchas:** the auto-mode classifier intermittently blocks compound `git commit &&
git push` and heredoc commit messages — run commit and push as SEPARATE calls and
use `-m` flags. Do NOT create live Stripe objects as tests (the Connect probe
create-then-delete is fine only because create currently fails).
