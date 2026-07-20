# CharitMe — Competitor Pricing Analysis (vs. GoFundMe)

**Date:** 2026-07-20 · **Owner:** Revenue/Product · **Status:** Living document

This is the **pricing-model** companion to `docs/competitor-comparison.md` (which
covers features broadly). It benchmarks CharitMe's money model against GoFundMe and
tracks the gap-closure work. Every row answers one question: **"Would this increase
donor trust?"**

## Model at a glance

| Dimension | CharitMe (today) | GoFundMe | Verdict |
|---|---|---|---|
| Create a fundraiser | **Free**, unlimited campaigns/updates/media/donors | Free | ✅ parity |
| Mandatory platform fee | **0% forever** | 0% (personal, US); Pro/Classy tiers charge | ✅ better |
| Donor support ("tip") | **Optional**, suggested 15%, ladder 15→0%, always reducible to 0% | Optional tip, default varies, reducible | ✅ parity+ (clear ladder) |
| Processing fee | 2.9% + $0.30 (card), method-aware (ACH/Venmo/PayPal) | 2.9% + $0.30 | ✅ parity, more methods |
| Recipient receives | **100% of the gift** when donor covers processing | Donation minus processing | ✅ better |
| Payout model | Stripe Connect **destination charge**, recipient-first, no CharitMe custody | Stripe/Adyen, WePay legacy | ✅ comparable+ |
| Payout gating | Donations **blocked** until recipient's connected account is payout-ready | Similar | ✅ parity |
| Refunds/disputes | Reversed into an **immutable double-entry ledger**; nightly reconciliation | Opaque | ✅ better (auditable) |

## Gap table

| # | Area | CharitMe now | GoFundMe | Gap | Opportunity | Implementation | Priority | Rev. impact | Conv. impact |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Support ladder | Suggested 15%, chips 15/12/10/8/5/3/1/0, reducible to 0 | Tip default, less explicit | Chips + "None" were not always one tap away | Make reducing support frictionless → trust | **DONE** — `SUPPORT_TIER_PERCENTS`, chip row in DonateButton | P0 | Neutral/±tip | +trust |
| 2 | Live breakdown | Donation/support/processing/**recipient receives**/you-pay, live | Basic | Missing explicit "recipient receives" line | Show 100%-to-recipient message | **DONE** — `donationBreakdown()` single source of truth | P0 | — | + |
| 3 | "Where your money goes" | Breakdown inline on donate form | Help-center article | No dedicated animated explainer page | Category-dominating transparency page | Backlog — `todo.md` §Pricing P1 | P1 | — | + |
| 4 | Transparency Center | `docs/payments/money-flow.md` + inline copy | Scattered help pages | No single public trust hub | One page: fees, Stripe, KYC/AML, refunds, escrow=none | Backlog — P1 | P1 | — | + |
| 5 | Organizer subscription (CharitMe Plus) | AI features exist un-gated | GoFundMe Pro/Classy paid | No `subscriptions/entitlements` tables or Stripe billing | New recurring revenue line | Backlog — P1, `needs-staging` (Stripe test keys) | P1 | **+MRR** | — |
| 6 | Nonprofit tiers (Starter/Growth/Pro/Enterprise) | Single tier | Classy enterprise | No plan/feature-flag model | Upmarket revenue | Backlog — P2, `needs-staging` | P2 | **+MRR** | — |
| 7 | Admin pricing dashboard (MRR/ARR/LTV/CAC, support-reduction %) | Finance + reconciliation consoles exist | Internal only | No subscription/MRR analytics (no subs yet) | Operator insight | Backlog — follows #5 | P2 | — | — |
| 8 | Checkout methods (Apple/Google Pay, ACH, saved cards, round-up) | Stripe Checkout, method-aware fees | Apple/Google Pay | Some methods surfaced via fee config only | Lower friction → higher conversion | Backlog — P1 (Stripe Payment Element) | P1 | — | **+conv** |
| 9 | SEO/AEO pricing pages | Fees shown on donate form; JSON-LD elsewhere | Ranks for "GoFundMe fees" | No dedicated `/pricing` + FAQ schema | Capture "fundraising fees" search | Backlog — P2 | P2 | +top-of-funnel | + |

## What shipped in this pass (see `pricing-audit-log.md`)
- Canonical, tested `donationBreakdown()` in `@shared/fees` — one source of truth for
  the donate form, the (future) calculator, and the "where your money goes" view.
- Support tier ladder `[15,12,10,8,5,3,1,0]`, suggested 15%, one-tap "None".
- "Recipient receives" line + 100%-to-recipient messaging on the donate form.

## Guardrails (non-negotiable)
- Support is **always** optional and reducible to 0% — no dark patterns, no hiding the
  reduce control, no pre-checked "add a tip" that can't be removed.
- The recipient's net is **never** reduced by CharitMe's platform fee (it is 0%).
- Subscription/enterprise pricing is **additive** revenue; it must never gate a
  donor's ability to give or an organizer's ability to raise for free.
