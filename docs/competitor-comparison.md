# CharitMe — Competitive Feature Matrix & "Beat the Market" Roadmap
**Date:** 2026-06-10
**Status:** Living document — updated as features ship

---

## Why this document exists

A prior audit (`docs/charitme-gofundme-audit.md`) brought CharitMe to **100/100 GoFundMe parity**. This document goes one level up: it benchmarks CharitMe against the *entire* crowdfunding/donation category — GoFundMe, GoFundMe Pro (Classy), Givebutter, Donorbox, JustGiving, Kickstarter, and Indiegogo — and identifies where CharitMe should not just match but **leapfrog** them.

Legend:
- ✅ **Comparable / Better** — CharitMe already matches or exceeds this
- ⚠️ **Partial** — exists but not fully wired up / not public-facing
- ❌ **Gap** — not available; build planned
- 🚀 **Building now** — actively being shipped this session (small incremental commits)

---

## 1. Core Donation & Checkout

| Capability | GoFundMe | Givebutter | Donorbox | Classy | Kickstarter/Indiegogo | JustGiving | **CharitMe** |
|---|---|---|---|---|---|---|---|
| One-time donation | ✅ | ✅ | ✅ | ✅ | ✅ (pledge) | ✅ | ✅ |
| Recurring donation | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Card / Apple Pay / Google Pay | ✅ | ✅ | ✅ (22+ methods) | ✅ | ✅ | ✅ | ✅ **Shipped** — Apple Pay, Google Pay, Link, Cash App, US bank (ACH), Amazon Pay |
| PayPal / Venmo at checkout | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ❌ → planned (PayPal/Venmo require separate Stripe activation) |
| "Pay over time" / installment pledges | ✅ (BNPL) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ → planned |
| Donor tip / "cover fees" | ✅ | ✅ (tip-or-fee) | ✅ | ✅ | n/a | ✅ | ✅ |
| Transparent fee breakdown | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ **Better** — itemized at checkout |
| Anonymous donations | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Offline donation recording | ⚠️ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| Crypto donations | ❌ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ → planned |

**Verdict:** CharitMe's fee transparency is best-in-class. ✅ Stripe Checkout now offers Apple Pay, Google Pay, Link, Cash App, US bank transfer (ACH), and Amazon Pay alongside cards — for both one-time and recurring donations — closing in on Donorbox's 22-payment-method claim at near-zero engineering cost. Accounts where a method isn't yet activated automatically fall back to card-only so checkout never breaks.

---

## 2. Campaign Creation & Management

| Capability | Competitors | **CharitMe** |
|---|---|---|
| Guided campaign wizard | GoFundMe ✅, Classy ✅ | ✅ 8-step wizard |
| 18+ categories | Most have 8-12 | ✅ **Better** — 18 categories |
| Team / peer-to-peer fundraising | Classy ✅, GoFundMe ✅ | ✅ |
| Co-organizer roles & permissions | Classy ✅ | ✅ |
| Milestones / stretch goals | Kickstarter ✅, Indiegogo ✅ | ✅ schema exists — ⚠️ not shown publicly → 🚀 |
| Reward / perk tiers (Kickstarter-style) | Kickstarter ✅, Indiegogo ✅ | ❌ → planned |
| AI campaign copilot (story, social, FAQ, goal) | None of them | ✅ **Unique to CharitMe** |
| AI fundraising coach | None of them | ✅ **Unique to CharitMe** |
| QR code poster generator | Few | ✅ |
| Embeddable donation widget | Donorbox ✅✅ (core product) | ⚠️ 25% rollout → enable fully |

**Verdict:** CharitMe's AI tooling (copilot, coach, growth plan) is a genuine category-leading differentiator nothing else in this list has. The gap is **surfacing milestones publicly** and adding **reward tiers** for creative/business/event campaigns.

---

## 3. Trust, Safety & Verification

| Capability | Competitors | **CharitMe** |
|---|---|---|
| Identity verification (KYC) | GoFundMe ✅ | ✅ via Stripe Connect |
| AI fraud / risk scoring | ❌ none publicly | ✅ **Unique** — `campaign_health_score`, risk flags |
| Public trust badge | GoFundMe ✅ (basic) | ✅ CharitScore™ |
| Transparency ledger (spend tracking) | ❌ none | ✅ **Unique** |
| Campaign reporting / moderation | ✅ | ✅ |

**Verdict:** Already ahead here — no action needed.

---

## 4. Donor Engagement, Gamification & Virality

| Capability | OneCause | Classy | GoFundMe | **CharitMe** |
|---|---|---|---|---|
| Donor wall / "Wall of Fame" | ✅ | ✅ | ⚠️ | ✅ **Shipped** — Recent + Top Donors tabs, tier badges, load more |
| Top-fundraiser leaderboard | ✅ | ✅ | ❌ | ⚠️ admin-only → 🚀 **public** |
| Donor badges / impact points / streaks | ✅ | ⚠️ | ❌ | ❌ → 🚀 **building, gamified levels** |
| Referral program / share-to-earn | ⚠️ | ⚠️ | ❌ | ❌ → 🚀 **building w/ tracked links** |
| Employer donation matching lookup | Double the Donation add-on | Double the Donation add-on | ❌ | ❌ → 🚀 **built-in, free** |
| Recent donation live ticker | ✅ | ✅ | ✅ | ✅ **Shipped** — auto-polling live ticker on campaign pages |
| Goal meter / donor map | ✅ | ✅ | ✅ | ✅ |

**Verdict:** This is the single biggest category of gaps and the highest-leverage area — these features directly drive viral growth and repeat donations, and most competitors only offer them as paid add-ons (Double the Donation, OneCause). CharitMe can ship all of these **natively and free**.

---

## 5. Mobile, PWA & Device Experience

| Capability | GoFundMe | **CharitMe** |
|---|---|---|
| Native iOS/Android app | ✅ | ❌ (out of scope — no app store presence) |
| Installable PWA (Add to Home Screen) | ❌ | ✅ **Shipped** — manifest + service worker + install prompt |
| Offline support / fast loads | ⚠️ | ✅ **Shipped** — offline fallback page + asset caching |
| Dark mode | ❌ | ✅ **Already shipped, better than GoFundMe** |
| Responsive device-aware layout | ✅ | ✅ (recently completed) |

**Verdict:** ✅ A full PWA (manifest + service worker + install prompt) gives CharitMe an installable, app-like experience on every OS — something GoFundMe itself doesn't offer on web — for a fraction of the cost of a native app.

---

## 6. Marketing, SEO & Content

| Capability | Competitors | **CharitMe** |
|---|---|---|
| Audience landing pages | ✅ | ✅ (individuals/nonprofits/donors) |
| Success stories | ✅ | ✅ |
| Blog / content marketing | ✅ extensive | ⚠️ stub (6 static links) → planned |
| Multi-language i18n | JustGiving ✅ | ❌ → planned (longer-term) |

---

## 7. Internationalization & Payments Infra

| Capability | Competitors | **CharitMe** |
|---|---|---|
| Multi-country fundraise/donate | JustGiving ✅✅ | ✅ 20+/70+ countries |
| Multi-currency | ✅ | ⚠️ 4 currencies → expand |
| Multi-language UI | JustGiving ✅ | ❌ |

---

## Execution Plan (small, independently-shippable pushes)

Each item below ships as its own commit + push to `claude/charitme-gofundme-audit-8vizt7` so partial progress is always deployable:

1. ✅ **This document** (competitive matrix)
2. ✅ **Expand Stripe Checkout payment methods** — Apple Pay, Google Pay, Link, US bank transfer (ACH), Cash App, Amazon Pay enabled on one-time + recurring donation checkout, with automatic card-only fallback
3. ✅ **PWA**: manifest, service worker, offline fallback, install prompt
4. ✅ **Public Donor Wall + Live Donation Ticker** on campaign pages
5. 🚀 **Public Top-Fundraiser / Top-Donor Leaderboards** (site-wide + per-campaign)
6. 🚀 **Donor Gamification**: badges, giving levels, streaks shown on donor profile
7. 🚀 **Employer Donation Matching** lookup widget on donate flow
8. 🚀 **Referral program**: trackable referral links + rewards dashboard
9. 🚀 **Public campaign milestones / stretch goals** display
10. 🚀 **Reward/perk tiers** for campaigns (Kickstarter-style)
11. Blog CMS expansion
12. Multi-currency expansion + i18n groundwork

Progress on items 2+ is tracked via commit history on this branch.
