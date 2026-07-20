# CharitMe — Pricing Audit Change Log

Append-only record of pricing/revenue-model changes. Newest first.

---

## 2026-07-20 · Admin pricing & support analytics (donation-side)

**Issue.** No operator view of how donors respond to optional support — the only
donation-side revenue lever CharitMe has (platform fee is 0%).

**Reason.** Pricing-audit "admin pricing dashboard" — measure average donation,
**average support %**, and **support-reduction %** from real data so the team can
tune messaging without dark patterns.

**Implementation.**
- `lib/pricing-analytics-core.ts` — pure: `computePricingAnalytics(rows)` → gross,
  support revenue, avg donation, avg support %, effective support %, support-reduction
  % (share below the suggested 15% tier), zero-support %, and a support-tier
  distribution. `supportPercentOf` guards divide-by-zero.
- `lib/pricing-analytics.ts` — reads completed online donations (last N days).
- `app/api/admin/pricing/route.ts` — admin GET (`?days=`).
- `app/admin/pricing/page.tsx` — stat cards + tier distribution bars; added to admin
  nav after Finance.
- `__tests__/pricing-analytics.test.ts` — +7 cases (support-% math, reduction
  definition, bucketing, exactly-one-bucket, zero-safety).

**Files changed.** `lib/pricing-analytics-core.ts`, `lib/pricing-analytics.ts`,
`app/api/admin/pricing/route.ts`, `app/admin/pricing/page.tsx`,
`components/CharitMeApp.tsx`, `__tests__/pricing-analytics.test.ts`,
`docs/pricing-audit-log.md`, `todo.md`.

**Before.** No pricing/support analytics anywhere.

**After.** Admins see support behavior from real donations. Partially closes `todo.md`
C7; MRR/ARR/LTV/CAC still pend subscription billing (C4).

**Revenue impact.** Enables data-driven support-messaging decisions. No fee changes.
**Security/Compliance impact.** Admin-gated read of aggregate donation data; no PII, no
new write paths.

**Verification.** `tsc --noEmit` ✓ · vitest 563/563 ✓ · `next build` ✓.

---

## 2026-07-20 · Transparency Center + interactive "Where your money goes" calculator

**Issue.** No dedicated public trust hub explaining fees, money flow, KYC/AML, and
"CharitMe never holds your donation." The strongest trust story was buried in the
donate form and a docs file.

**Reason.** Pricing-audit objective #1 — increase donor trust. A category-dominating
transparency page that lets a donor *interactively* see where every dollar goes.

**Implementation.**
- `apps/web/app/transparency/MoneyCalculator.tsx` — client calculator driven by the
  same `donationBreakdown()` as checkout (so displayed == charged). Amount input,
  support tier chips (reducible to 0%), method toggle (card/ACH/PayPal/Venmo),
  cover-processing toggle, animated stacked bar (recipient/support/processing) and a
  live line-item breakdown with "Recipient receives" + "You pay". Dark/light aware,
  responsive (clamp sizing).
- `apps/web/app/transparency/page.tsx` — server page: metadata + OpenGraph + canonical,
  **FAQPage JSON-LD** for AEO/rich results, and static sections (how payments work,
  where fees go, no-custody money-flow diagram, verification/security/compliance,
  refunds/chargebacks, FAQ). Reuses `.pub-page`/`.legal-body` styles.
- `apps/web/components/AppShell.tsx` — footer link under Legal → **Transparency Center**.

**Files changed.** `apps/web/app/transparency/page.tsx`,
`apps/web/app/transparency/MoneyCalculator.tsx`, `apps/web/components/AppShell.tsx`,
`docs/pricing-audit-log.md`, `todo.md`.

**Before.** No `/transparency`; trust content scattered across `/security`,
`/trust-safety`, and `docs/payments/money-flow.md`.

**After.** One public Transparency Center with an interactive calculator that can never
disagree with checkout. Closes `todo.md` C2 + C3.

**Revenue impact.** Indirect — higher perceived transparency should lift conversion and
support-retention. No fee changes.

**UX impact.** Donors can model any gift/support/method combination and see the exact
recipient net before ever reaching checkout.

**Security/Compliance impact.** Publicly documents PCI (Stripe), KYC, AML, no-custody,
and the immutable-ledger reconciliation posture. No new data paths (pure calculation).

**Verification.** `tsc --noEmit` ✓ · vitest 556/556 ✓ · `next build` ✓ (`/transparency`
prerendered static, 126 pages).

---

## 2026-07-20 · Canonical donor-support model + live "recipient receives" breakdown

**Issue.** The donor-support ("tip") model was spread across the donate form and two
API routes with an ad-hoc ladder (`[0,5,8,10,12]`) and no single source of truth for
the money breakdown. The transparent breakdown didn't state what the *recipient*
actually receives — the strongest trust signal CharitMe has (100% of the gift).

**Reason.** Pricing-audit objective: maximize donor trust and make reducing support
frictionless (no dark patterns). A single tested breakdown function guarantees the
donate form, the future calculator, and the "where your money goes" view can never
disagree with what the server charges.

**Implementation.**
- `packages/shared/fees.ts`
  - Added `SUGGESTED_SUPPORT_PERCENT = 15`, `SUPPORT_TIER_PERCENTS = [15,12,10,8,5,3,1,0]`.
  - `DEFAULT_DONOR_TIP_PERCENT` now aliases the suggested tier (fallback only; the
    client always sends an explicit percent).
  - Added `donationBreakdown()` — pure, returns donation / support / processing /
    total-charged / **net-to-recipient** / recipient-%. Model: recipient gets 100% of
    the gift when the donor covers processing; support is always *on top* and never
    reduces the recipient's net; platform fee is 0%.
- `apps/web/app/campaigns/[slug]/DonateButton.tsx`
  - Breakdown now derives from `donationBreakdown()` (was ad-hoc math).
  - Added a one-tap support tier chip row (incl. **None**) above the fine-tune slider.
  - Added a green **"Recipient receives"** line; relabeled total to **"You pay"** and
    "tip" → "support".
- `apps/web/__tests__/fees.test.ts` — +7 cases: ladder invariants, 100%-to-recipient
  when covered, processor-only deduction when not, support-never-reduces-recipient,
  composition parity with checkout, clamping, zero-gift safety.

**Files changed.** `packages/shared/fees.ts`, `apps/web/app/campaigns/[slug]/DonateButton.tsx`,
`apps/web/__tests__/fees.test.ts`, `docs/competitor-pricing-analysis.md`,
`docs/pricing-audit-log.md`, `todo.md`.

**Before.** Suggested support 8%; ladder `[0,5,8,10,12]`; breakdown showed
donation/tip/processing/total; no recipient-net line; math duplicated per surface.

**After.** Suggested support 15% (reducible to 0% in one tap); ladder `[15,…,0]`;
breakdown shows donation/support/processing/**recipient receives**/you-pay; one tested
`donationBreakdown()` shared by every surface.

**Revenue impact.** Suggested support raised 8%→15% (opt-in, reducible) — modest
positive expected on support revenue; recipient net unchanged. No change to the 0%
platform fee or processing pass-through.

**UX impact.** Reducing support is now one tap (chips + "None"); donors see exactly
what the recipient receives. Higher perceived transparency.

**Security impact.** None — pure calculation + presentation. No new data paths.

**Compliance impact.** Reinforces the "optional, clearly-reducible support" posture
(no dark patterns). Recipient-net messaging is accurate to the destination-charge
ledger (recipient_payable = donation amount).

**Verification.** `tsc --noEmit` ✓ · vitest 556/556 ✓ · `next build` ✓.
