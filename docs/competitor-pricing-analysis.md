# CharitMe vs GoFundMe — Pricing & Transparency Analysis

> Honest current-state comparison (not aspirational). Public GoFundMe fee info as
> generally documented; verify against gofundme.com before publishing claims.
> This is the audit basis for the pricing program; items marked **[done]** are
> implemented in code, the rest are backlog (many also gated on the DB
> reconciliation — see `docs/LAUNCH_BLOCKERS.md` LB-001).

| Area | Current CharitMe | GoFundMe (typical) | Gap / Opportunity | Implementation | Priority |
|------|------------------|--------------------|-------------------|----------------|----------|
| Mandatory platform fee | **0%** (`PLATFORM_FEE_PERCENT=0`) | 0% on personal (US); charities may see a fee | At parity; lead on messaging | Marketing/SEO copy | P1 |
| Donor support (tip) | Optional, **suggested 15%**, reducible to 0 in one tap **[done]** | Optional tip, default varies (~⁠15%+), reducible | Match + make reduction obvious, no dark patterns | `TIP_OPTIONS=[15..0]`, `DEFAULT=15`, slider to 0 **[done]** | P0 |
| Fee transparency at checkout | Live breakdown: Donation / tip / processing / **you pay** / **recipient receives (100%)** **[done]** | Shows tip + processing, less emphasis on "recipient gets 100%" | Emphasize recipient nets full donation | Added "Recipient receives 100%" line to `DonateButton` **[done]** | P0 |
| Fund custody | **None** — Stripe Connect destination charges; recipient nets full amount **[verified]** | Held/processed by GoFundMe then transferred | Trust lead: "we never hold your money" | `resolvePayoutDestination` gate + destination charges | P0 |
| Payout readiness | Donations blocked until recipient KYC + charges/payouts enabled **[verified]** | Transfers require verification | At parity; clearer UX ("Donations open soon") **[done]** | Recipient-first gate | P1 |
| Processing fee | Per-method, server-authoritative (`methodProcessingFee`), donor-optional coverage **[done]** | ~2.9% + $0.30 | Show per-method clearly | Already itemized in breakdown | P2 |
| Transparency Center page | **Absent** | Basic help articles | Dedicated animated fees/money-flow page | New `/transparency` route | P1 (backlog) |
| Organizer subscription (CharitMe Plus) | **Absent** (AI features exist, not gated/billed) | GoFundMe Pro (charities) | $19.99/mo tier w/ Stripe Billing + entitlements | `subscriptions`/`entitlements` (needs DB) | P2 (backlog, gated) |
| Nonprofit tiers (Starter/Growth/Pro/Enterprise) | **Absent** | Enterprise/Classy pricing | Tiered plans + comparison table | Stripe Billing + feature flags (needs DB) | P2 (backlog, gated) |
| Admin revenue dashboard (MRR/ARR/LTV/CAC) | Partial (donation analytics) | Internal | Pricing/revenue admin surface | New admin pages (needs subscription tables) | P3 (backlog, gated) |
| Legal (fee/refund/subscription policy) | Terms/Privacy exist | Comprehensive | Add explicit Fee & Transparency policy | Legal pages | P2 (backlog) |

## Implemented this pass
- Donor support model set to spec: suggested **15%**, options `[15,12,10,8,5,3,1,0]`,
  always reducible to 0 (`packages/shared/fees.ts`), regression-tested.
- Donation breakdown now shows **"Recipient receives {full donation} — 100% of
  your donation"**, the strongest trust signal (`DonateButton.tsx`).

## Deliberately NOT done in one pass (honest scope)
Transparency Center, subscription tiers + Stripe Billing + entitlements, checkout
redesign, revenue admin dashboards, and legal rewrites are a multi-week program.
Most subscription/analytics work also **can't function until the live DB is
reconciled** (LB-001: prod is ~48 migrations behind; `subscriptions`/`entitlements`
tables don't exist there). Sequence: reconcile DB → build billing/entitlements →
tiers/admin → transparency center → legal.

## Env note
`DEFAULT_DONOR_TIP_PERCENT` is also read from an env var in `/api/donations`
(`process.env.DEFAULT_DONOR_TIP_PERCENT ?? 15`). Vercel currently sets it to `8`;
update it to `15` (or unset it) for the new suggested default to take effect in
production.
