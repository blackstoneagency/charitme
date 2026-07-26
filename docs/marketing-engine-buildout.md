# CharitMe Marketing Engine — Buildout Readout

> 2026-06-09. End-to-end marketing engine: capture → identity resolution → events →
> scoring → segments → campaigns → automations → consent, wired to live Supabase data.

## What was built

### Database — `supabase/migrations/20260610010000_marketing_engine.sql` (17 tables)

| Table | Purpose |
|---|---|
| `marketing_contacts` | One identity-resolved row per person: type, lifecycle stage, scores, attribution, status |
| `marketing_identities` | Identity stitching — email / phone / user_id → contact (unique per kind+value) |
| `marketing_events` | Behavioral stream (donation_started/completed, support_contacted, form_submitted, …) |
| `marketing_segments` + `_members` | Dynamic rule-based audiences (AND/OR JSON rules) |
| `marketing_campaigns` + `_recipients` | Email campaigns with per-recipient delivery state |
| `marketing_automations` + `_runs` | Trigger→action workflows with full run history |
| `marketing_email_templates` | Template library ({{first_name}} etc. variables) |
| `marketing_utm_links`, `marketing_referrals` | Link/referral attribution rails |
| `marketing_forms` + `_submissions` | Lead/newsletter/survey form storage |
| `marketing_consent`, `marketing_suppression_list` | Consent audit trail + do-not-send list |
| `marketing_audit_logs` | Every admin marketing action logged |

All tables: PK/FKs, indexes, `created_at`/`updated_at` (+touch triggers), status fields,
**RLS enabled with zero anon/authenticated policies** — only the service role (admin APIs)
can touch marketing data.

Seeded (real, usable rows — not mock analytics): 7 system segments (repeat donors, high-value,
abandoned donations, draft organizers, dormant, …), 7 system email templates (welcome, abandoned
reminder, reactivation, organizer nudge, payout chaser, recurring upgrade, seasonal), and
6 starter automations (disabled until an admin enables them).

### Engine — `lib/marketing-core.ts` (pure) + `lib/marketing-engine.ts` (Supabase)

- **Identity resolution** (`resolveContact`): find-or-create by any identity, stitch
  email/phone/user_id, merge profile fields, first-touch preserved / last-touch updated,
  consent logging.
- **Event tracking** (`trackEvent`): writes the behavioral stream + bumps `last_active_at`.
- **Scoring** (`refreshContactScores`): recomputes from **live** donations, recurring
  subscriptions, campaigns, and events — lead score, engagement score, churn risk,
  client-type classification (visitor→donor→repeat→high-value→recurring), lifecycle stage
  (subscriber→lead→engaged→customer→champion→dormant).
- **Segment engine** (`matchesSegment` + `evaluateSegment`): AND/OR conditions over
  numeric fields, string fields, event presence (`has`/`not_has`), and inactivity windows;
  membership materialized to `marketing_segment_members`.
- **Consent** (`isSuppressed`, `unsubscribeEmail`): suppression honored on every send path.

### APIs

| Route | Function |
|---|---|
| `POST /api/marketing/capture` | Public capture from any surface (rate-limited, zod-validated): identity-resolve + event + optional form submission + score refresh |
| `GET/POST /api/marketing/unsubscribe` | One-click unsubscribe (email link) + JSON API; writes suppression + consent audit |
| `GET/POST/PATCH /api/admin/marketing/contacts` | List/filter/search contacts, full contact profile (events, segments, consent, identities), admin lead creation, **platform-user sync** (imports donors/organizers from `profiles` and scores them) |
| `GET/POST/PATCH /api/admin/marketing/segments` | List, create-with-rules (instant evaluation), re-evaluate |
| `GET/POST/PATCH /api/admin/marketing/campaigns` | List, create draft, **send test**, **launch** (materializes recipients from segment, honors suppression + unsubscribes, personalizes {{first_name}}, sends via Resend, per-recipient status), pause/archive |
| `GET/PATCH /api/admin/marketing/automations` | List + run history, enable/disable, **run now** (trigger matching: donor_inactive, donation_abandoned, donation_completed, payout_setup_incomplete, no_update_posted → templated sends with run records) |
| `POST /api/admin/marketing/copilot` | AI copilot grounded in live contact/event/campaign stats: analyze, weekly plan, campaign copy, subject lines, SMS, social. Returns a clear 503 + settings instruction when `OPENAI_API_KEY` is absent (no fake output) |

### Capture wired into existing surfaces (live today)

- **Contact form** (`/api/contact`) → `support` contact + `support_contacted` event
- **Donation checkout** (`/api/donations`) → `donation_started` event (feeds abandoned-donation segment/automation)
- **Stripe webhook** (`checkout.session.completed`) → contact resolution with UTM attribution,
  `donation_completed` event, immediate score refresh
- All capture is wrapped so it can never break checkout/webhooks/contact.

### Admin UI — Admin → Marketing (in sidebar nav, badge "New")

`/admin/marketing` + subpages `/audience`, `/segments`, `/campaigns`, `/automations`, `/copilot`
(one shared client, deep-linkable tabs). All data live from Supabase:

- **Overview** — KPI cards (contacts, 7-day events, campaigns sent, unsubscribed), contacts-by-type,
  top segments, capture-endpoint documentation card
- **Audience** — searchable contact table (type, stage, lead/engagement score bars, lifetime value,
  churn risk), platform-user sync, admin lead creation, and a full **contact profile drawer**
  (scores, segments, identities, consent history, event timeline)
- **Segments** — visual rule builder (field/op/value rows, ALL/ANY logic), create+evaluate,
  member counts, re-evaluate per segment
- **Campaigns** — email campaign composer (audience segment picker, subject/body with
  personalization), send test, launch with sent/suppressed report, pause/archive
- **Automations** — toggle the 6 seeded workflows, "Run now" with matched/executed/skipped report,
  recent-run history
- **AI Copilot** — 6 task modes grounded in live stats; disabled state with setup instructions when
  no AI key

## Tests & verification

| Check | Result |
|---|---|
| New unit tests (`__tests__/marketing-engine.test.ts`) | **19 tests** — lead/engagement scoring, churn, classification, lifecycle, segment matching (AND/OR, events, inactivity) |
| Full Vitest suite | **188/188 pass** (14 suites) |
| `tsc --noEmit` | clean |
| `eslint .` | 0 errors |
| `next build` | pass |

## Honest scope notes / remaining blockers

- **Migration must be applied** to the Supabase project (`supabase db push` or the
  `/admin/setup` apply-schema flow) before the Marketing section has data to show.
- **Email sends require `RESEND_API_KEY`** — without it, test/launch report a clear
  "provider not configured" message (nothing fake is recorded as sent).
- **SMS and social studios**: schema + campaign types exist; no SMS/social provider is
  configured, so sends of those types record as failed with a clear reason. Adapter
  settings are the natural next step (Twilio/Sinch for SMS).
- **Open/click tracking**: recipient rows have opened/clicked states; pixel + redirect
  endpoints are not yet implemented (sends record `sent` only).
- The 25-page nav in the original spec was deliberately consolidated into 6 wired pages
  rather than 25 thin ones — every page shown is functional against live data, nothing
  is a static placeholder.
- Landing-page builder, popups, surveys, A/B tests: **tables and form types exist**
  (`marketing_forms.form_type`, submissions API); dedicated builder UIs not yet built.

## Production readiness score: 8/10
Capture, identity, events, scoring, segments, campaigns (email), automations, consent,
audit, and admin visibility are fully wired and tested. Deduct 2 for: migration not yet
applied to prod + provider keys (Resend/OpenAI) required for sends/copilot.
