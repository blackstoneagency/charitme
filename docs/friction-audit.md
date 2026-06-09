# CharitMe UX Friction Audit

> Generated 2026-06-09. Scores: effort 1 (trivial) – 5 (heavy). Dropoff risk: low/med/high.

## 1. Donation flow (`/campaigns/[slug]` → Stripe Checkout)

| Step | Effort | Dropoff | Status |
|---|---|---|---|
| Land on campaign page | 1 | low | ✅ Trust score visible above fold |
| Pick amount | 2 | **med** | ⚠️ Static preset amounts — not adapted to campaign size or donor behavior |
| Click Donate → Stripe Checkout | 1 | low | ✅ Guest donation supported, no account required |
| Post-donation thank you | 1 | low | ✅ Receipt + webhook attribution |

**Fix shipped:** AI Donation Optimizer — ask amounts now computed per-campaign from goal,
median donation, and progress (see `lib/donation-optimizer.ts`). Zero added latency
(deterministic, server-rendered).

## 2. Campaign creation (`/create`)

| Step | Effort | Dropoff | Status |
|---|---|---|---|
| 8-step wizard | 2/step | med | ✅ Progress sidebar + CharitMe Score gamifies completion |
| Story writing | 4 | **high** | ✅ AI copilot generates story/title from notes |
| Goal setting | 3 | med | ✅ AI goal recommendation + automated-goal toggle |
| Payout connect | 3 | **high** | ✅ 5 methods (Stripe/Venmo/Google Pay/PayPal/Sinch); required-gate prevents broken launches |
| Guest → signup | 3 | **high** | ✅ Deferred auth: full wizard as guest, login only at launch |
| Launch | 1 | low | ✅ One-click launch + preview modal + Quick Share with QR |

Remaining friction: media upload is single-image-first; suggested photos mitigate.

## 3. Donor discovery

| Step | Effort | Dropoff | Status |
|---|---|---|---|
| Browse `/campaigns` | 2 | med | ✅ Category filters |
| Find related causes | 3 | **high** | **Fixed:** donor-matching recommendations on campaign pages ("Donors also supported") |

## 4. Organizer retention

| Step | Effort | Dropoff | Status |
|---|---|---|---|
| Post-launch guidance | 3 | high | ✅ AI Coach + Growth Plan dashboards |
| Sharing | 2 | med | ✅ Quick Share (6 channels + QR + poster) on launch screen and dashboard share page |
| Thanking donors | 2 | med | ✅ thank-donors flow |
| Understanding impact | 3 | med | **Fixed:** Impact summary on campaign detail (backers, momentum, projected finish) |

## 5. Trust

- Public trust gauge on every campaign page ✅
- CharitMe Score during creation (identity/beneficiary/payout/story/evidence) ✅
- Rule-based risk flags feeding admin trust-safety queue ✅
- "CharitMe does NOT store funds" disclosure on payout step ✅

## Verdict

The two highest-leverage friction points without mitigation were **static donation asks** and
**no related-campaign discovery** — both addressed in this audit cycle. Everything else has an
existing flow; future work should be measured (analytics events exist in `campaign_analytics_events`)
before further redesign.
