# CharitMe — Pricing Audit Change Log

Append-only record of pricing/revenue-model changes. Newest first.

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
