# CharitMe — Architecture Decision Record

> One entry per significant decision. Append; never rewrite history.

---

### ADR-0001 — Treat the mission as hardening/gap-closure, not a rewrite
- **Date**: 2026-07-19
- **Context**: The execution brief assumed a stub-heavy MVP. The audit found a mature, healthy platform (~80 wired tables, 138 APIs, 339 passing tests, type-clean).
- **Options**: (a) Rewrite per the brief's greenfield framing; (b) Preserve working subsystems and close real gaps as verified slices.
- **Decision**: (b). Rewriting a working, deployed, money-handling platform would destroy value and risk real donors.
- **Consequences**: Each change is a small vertical slice with evidence. Working code is not touched without a proven gap.
- **Rollback**: Per-slice branches; revert individual commits.

---

### ADR-0002 — WIP on branches; only verified slices reach `master`
- **Date**: 2026-07-19
- **Context**: `master` auto-deploys to live `charitme.com` handling real money. The brief itself forbids pushing broken code to main.
- **Decision**: All implementation happens on `agent/*` branches. `master` receives only slices that pass typecheck + lint + relevant tests + build, with no secrets. Docs-only changes may go straight to `master` for visibility.
- **Consequences**: Slower visible cadence on `master`, but production stays safe.
- **Rollback**: Branch isolation; `master` never carries unverified WIP.

---

### ADR-0003 — Verification boundary given no live Supabase in sandbox
- **Date**: 2026-07-19
- **Context**: The dev sandbox cannot reach Supabase (invalid/short local keys; data routes time out). The brief requires end-to-end tested payment/payout/RLS flows.
- **Decision**: Locally, "verified" means: typecheck pass, Vitest (mocked-Supabase) pass, `next build` pass, static UI/responsive/a11y checks. Data-path, Stripe, webhook, payout, and RLS verification are marked **"needs staging"** in `todo.md` and require a staging Supabase project + Stripe test mode before they can be certified.
- **Consequences**: No task touching live data flows may be marked `Verified`/`Production Ready` from this environment alone. Honesty over green checkmarks.
- **Rollback**: n/a (process decision).

---

### ADR-P1 — Payments: destination charges now; direct-charge migration requires sign-off
- **Date**: 2026-07-19
- **Context**: Spec §1.1 prefers **Stripe Connect direct charges** (PaymentIntent created on the recipient's connected account) as the default. The as-built flow (`app/api/donations/route.ts`) uses **destination charges** (`transfer_data.destination` + `application_fee_amount` on the platform account). Both keep net donation proceeds attributable to the recipient; the code already blocks donations until the recipient's account is fully verified/payout-enabled and never falls back to the platform balance (audited — see `docs/payments/money-flow.md`).
- **Options**: (a) Keep destination charges; (b) Migrate to direct charges (`Stripe-Account` header / `on_behalf_of`), feature-flagged by country + recipient type; (c) Separate charges & transfers.
- **Decision**: **(a) for now.** The recipient-first / no-funds-held guarantee is met. Direct charges materially change **merchant-of-record status, chargeback/refund-fee liability, and per-country/payment-method availability** — spec §1.1 requires this be "approved in writing by business, legal, tax, finance, and compliance" and verified in Stripe **test mode**. Neither the approval nor Stripe test keys are available in this environment, so switching now would be an unverified, legally consequential change to a live money path.
- **Consequences**: Documented as a reviewed decision, not a defect. Migration (b) stays a gated follow-up: it needs written multi-stakeholder approval, a country/recipient feature flag, reconciliation proving no recipient funds become platform-spendable, and explicit reserve/refund/dispute/negative-balance handling.
- **Security/Compliance impact**: MoR, charitable-solicitation, and money-transmitter exposure must be validated by qualified counsel before any change.
- **Rollback**: N/A (no code change). If (b) is later implemented, it must be flag-gated so it can be disabled per country/recipient without redeploy.
