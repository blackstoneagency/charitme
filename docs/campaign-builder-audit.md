# Campaign Builder — UX / CRO Audit & Roadmap

> Grounded audit of the **two** existing campaign-creation paths (no third path is
> being added). Scope: friction inventory + a prioritized, shippable roadmap.
> Items marked ✅ are already done; the rest are ranked by impact/effort.

## The two paths (confirmed in code)

| Path | Route | Shape |
|------|-------|-------|
| **1 · AI Campaign Creator** | `app/ai-campaign/`, `app/ai-fundraising/` + `POST /api/ai/campaign`, `/api/ai/campaign-assistant` | Type an intent → AI drafts title/story/goal/category/etc. Falls back deterministically when no OpenAI key. |
| **2 · Guided Wizard** | `app/create/page.tsx` (9 steps) + helper components (`AiFollowUps`, `GoalProceedsBreakdown`, `ReadinessChecklist`, `StorySectionsEditor`) | `type → category → location → story → title → goal → media → payout → review → live`. Cross-links to Path 1 ("Use AI Instead"). |
| Fork | `app/create/choose-path/` | Chooses between the two. |

Both post to `POST /api/campaigns` (Supabase `campaigns` insert). Images go through
`POST /api/upload/campaign-image` (authz-checked). Payout uses Stripe Connect +
alt rails (`/api/stripe/connect`).

## Friction inventory (highest-impact first)

1. **✅ FIXED — No draft autosave / recovery.** The wizard created a Supabase row
   only on the *final* submit, so any interruption (refresh, closed tab, dead
   battery, accidental Back) lost everything. Only a one-shot `sessionStorage`
   restore existed, and only for the login-bounce. → Shipped `lib/campaign-draft.ts`
   (localStorage autosave, 7-day TTL, versioned, defensive parse) + a "Welcome
   back — resume?" banner + "✓ Saved" indicator, cleared on successful
   Supabase submit. (CHAR-SM15)
2. **✅ FIXED — Payout required before publish (Step 8 of 9).** Was the single
   biggest drop-off point. Payout is now **optional to publish** (CHAR-SM23): the
   creator launches + shares immediately and finishes payout later; the donation
   API still 409s `PAYOUT_NOT_READY` until the recipient is payout-ready, so no
   funds path is compromised. Messaging added on the payout/review/success steps
   and the public page already shows donors "Donations open soon".
3. **9 steps is long.** Merge/auto-infer: `location` (infer country from
   locale/IP; ZIP optional), `type`+`category` (one screen), `title` (AI-derived
   from story — never ask). Target: ≤5 screens, one primary action each.
4. **AI is opt-in, not default.** Path 2 treats AI as a side link. Per the brief,
   AI should pre-fill title/tagline/goal/category/FAQs silently and let the user
   edit — never present an empty field AI could fill.
5. **No per-step analytics / drop-off tracking.** There's a marketing/events
   pipeline (`trackEvent`) but wizard steps aren't instrumented, so abandonment
   points are invisible. Recommended: emit a `campaign_builder_step` event per
   step advance (cheap, high signal).
6. **Image experience is a plain uploader.** No AI/stock suggestions, crop
   preview, or optimization surfaced in-flow. Free-stock suggestions are now
   feasible via `lib/unsplash.ts` (pending the Unsplash key — see CHAR-SM13).
7. **No live multi-device preview.** A desktop/mobile/social preview while editing
   materially lifts completion + quality on competitors.

## Requires external services / keys (cannot be "fully wired" without them — will not fake)

- **AI image & video generation, background removal, face enhancement, auto-captions,
  transcription** — need an image/video AI provider + storage pipeline. Themed
  *stock* images are wired-ready via Unsplash (CHAR-SM13) once the key lands.
- **Voice input / speech-to-text** — needs a speech provider (or the Web Speech
  API, browser-gated; can be added as progressive enhancement).
- **End-to-end publish + donation verification** — needs Stripe **test** keys
  (configured keys are live; ADR-0003 forbids real charges from the sandbox).

## Method note

This is a program of work, not a single commit. Each slice ships fully wired to
Supabase, tested, and mobile-checked — starting with #1 (recovery), the highest
abandonment lever. Progress is logged in `todo.md` (CHAR-SM15…).
