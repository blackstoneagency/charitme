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
| Milestones / stretch goals | Kickstarter ✅, Indiegogo ✅ | ✅ **Shipped** — public "Milestones & stretch goals" panel on every campaign page with live progress bars, plus an organizer "Manage Milestones" page to add/reorder/mark goals reached |
| Reward / perk tiers (Kickstarter-style) | Kickstarter ✅, Indiegogo ✅ | ✅ **Shipped** — organizers define pledge-level perks (price, description, delivery estimate, optional quantity limit); donors pick a reward at checkout which sets the minimum amount and is tracked through to fulfillment |
| AI campaign copilot (story, social, FAQ, goal) | None of them | ✅ **Unique to CharitMe** |
| AI fundraising coach | None of them | ✅ **Unique to CharitMe** |
| QR code poster generator | Few | ✅ |
| Embeddable donation widget | Donorbox ✅✅ (core product) | ⚠️ 25% rollout → enable fully |

**Verdict:** CharitMe's AI tooling (copilot, coach, growth plan) is a genuine category-leading differentiator nothing else in this list has. With milestones and reward tiers now shipped, CharitMe matches or exceeds Kickstarter/Indiegogo on campaign creation tooling.

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
| Top-fundraiser leaderboard | ✅ | ✅ | ❌ | ✅ **Shipped** — site-wide `/leaderboard` with Top Campaigns + Top Donors (all-time/month/week) |
| Donor badges / impact points / streaks | ✅ | ⚠️ | ❌ | ✅ **Shipped** — Giving Levels (Supporter→Icon) with progress bar, 8 achievement badges, monthly giving streaks on `/profile` |
| Referral program / share-to-earn | ⚠️ | ⚠️ | ❌ | ✅ **Shipped** — personal `?ref=<userId>` link on every campaign, tracked end-to-end via `share_events`, with a `/dashboard/referrals` rewards dashboard (5 tiers: Connector→Champion) |
| Employer donation matching lookup | Double the Donation add-on | Double the Donation add-on | ❌ | ✅ **Shipped** — built-in employer matching search on every donate flow, free |
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
| Blog / content marketing | ✅ extensive | ✅ **Shipped** — 8 full long-form articles at `/blog/[slug]` (statically generated, per-post SEO metadata, OpenGraph/Twitter cards, JSON-LD Article schema, sitemap entries, related-posts + CTA per article) |
| Multi-language i18n | JustGiving ✅ | ❌ → planned (longer-term) |

---

## 7. Internationalization & Payments Infra

| Capability | Competitors | **CharitMe** |
|---|---|---|
| Multi-country fundraise/donate | JustGiving ✅✅ | ✅ 20+/70+ countries |
| Multi-currency | ✅ | ✅ **Shipped** — 24 currencies (shared `@shared/currencies` module); campaign-level currency flows end-to-end: settings picker → Stripe Checkout (one-time + recurring) → recorded on `donations.currency` → currency-correct display on campaign page, donate flow, milestones, mobile CTA |
| Multi-language UI | JustGiving ✅ | ⚠️ Groundwork shipped — `lib/i18n.ts` with 7 supported locales, Accept-Language negotiation, dictionary/`t()` scaffold; profile language picker wired to it. Full UI translation is the remaining step |

---

## Execution Plan (small, independently-shippable pushes)

Each item below ships as its own commit + push to `claude/charitme-gofundme-audit-8vizt7` so partial progress is always deployable:

1. ✅ **This document** (competitive matrix)
2. ✅ **Expand Stripe Checkout payment methods** — Apple Pay, Google Pay, Link, US bank transfer (ACH), Cash App, Amazon Pay enabled on one-time + recurring donation checkout, with automatic card-only fallback
3. ✅ **PWA**: manifest, service worker, offline fallback, install prompt
4. ✅ **Public Donor Wall + Live Donation Ticker** on campaign pages
5. ✅ **Public Top-Fundraiser / Top-Donor Leaderboards** (site-wide `/leaderboard`, with per-campaign Top Donors already shipped via Donor Wall)
6. ✅ **Donor Gamification**: badges, giving levels, streaks shown on donor profile
7. ✅ **Employer Donation Matching** lookup widget on donate flow
8. ✅ **Referral program**: personal `?ref=<userId>` referral links on every campaign page, end-to-end conversion tracking via `share_events` (reuses existing webhook logic), and a `/dashboard/referrals` rewards dashboard with 5 tiers (Connector → Champion)
9. ✅ **Public campaign milestones / stretch goals** display — campaign pages now show a "🎯 Milestones & stretch goals" panel with progress bars based on funds raised, and organizers get a new `/dashboard/campaigns/[id]/milestones` page to add, delete, and mark milestones reached
10. ✅ **Reward/perk tiers** for campaigns (Kickstarter-style) — new `campaign_rewards` table, organizer "Reward Tiers" management page, and an in-checkout reward picker on the donate flow that pre-fills the pledge amount, enforces minimums/sold-out limits, and tracks claims via `donations.reward_id`
11. ✅ **Blog expansion** — replaced the 6-link stub with a real content library (`lib/blog-posts.ts`): 8 long-form fundraising guides rendered at `/blog/[slug]` with static generation, per-post SEO metadata + JSON-LD Article schema, related-articles sections, contextual CTAs, and sitemap coverage
12. ✅ **Multi-currency expansion + i18n groundwork** — new `@shared/currencies` module (24 Stripe-supported two-decimal currencies with symbols/formatting helpers); campaign currency now drives Stripe Checkout for one-time and recurring donations, is recorded on each donation (`donations.currency`), and renders correctly across the public campaign page, donate widget, reward tiers, milestones, and mobile CTA; campaign + profile settings expose the full currency list; `lib/i18n.ts` lands locale negotiation and the translation-dictionary scaffold (7 locales) wired into the profile language picker

Progress on items 2+ is tracked via commit history on this branch.
