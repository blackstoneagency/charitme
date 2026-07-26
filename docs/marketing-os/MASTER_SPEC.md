# Marketing OS — Master Spec & Backlog

## Vision

Turn CharitMe's marketing area into an AI-first, goal-driven operating system:
_"tell CharitMe the outcome you want; it researches, plans, creates, publishes,
measures, and improves the work"_ — inside approved brand, legal, privacy, and
budget guardrails, with exception-based human oversight.

## Reality & sequencing

This is a multi-quarter program. It is being built as **thin, fully-connected
vertical slices** — each one working end-to-end (UI → Supabase → audit) before
the next starts — rather than a wide layer of disconnected scaffolding. See
`IMPLEMENTATION_STATUS.md` for exactly what is live today.

## Closed loop (target)

`Observe → Understand → Predict → Prioritize → Plan → Create → Review → Approve
→ Publish → Measure → Optimize → Learn`

The **Goals** slice implements the first hop of this loop: capture the objective
(Plan) and Measure it against live data. Later slices extend outward.

## Prioritized backlog

Ordered by dependency and value. `[x]` = shipped in this branch.

### Foundation
- [x] Repository audit → `ARCHITECTURE.md`
- [x] Goal data model + migration + RLS + audit
- [x] Goal-Based Marketing vertical slice (NL entry → measurable goal → live progress → lifecycle)
- [ ] Multi-tenant `organizations` / `brands` scoping on marketing tables
- [ ] Roles beyond admin/super (Brand/Legal/Finance reviewers, analyst, viewer)
- [ ] Approval engine (`approval_requests` / `_steps` / `_decisions`)
- [ ] Automation-rule builder UI on top of existing `marketing_automations`

### Intelligence
- [ ] Brand Constitution (ingest guides → structured brand rules + scoring)
- [ ] Opportunity engine (scored feed → convert to goal/campaign)
- [ ] Research / Strategy / Analytics / Executive agents (governed, structured outputs)
- [x] Command Center executive dashboard — shipped; live-data audit + 12 tests (2026-07-26). Daily-briefing digest and approval queue remain open (approval engine is a separate item below).

### Creation
- [ ] Goal → full multichannel campaign generation (pages, email, social, ads, SEO)
- [ ] Content Studio (briefs → drafts → review → publish → refresh, versioned)
- [ ] Creative Studio + Supabase Storage asset governance
- [ ] Template system with controlled cascade to published assets

### Channels
- [ ] GA4 + Search Console (read-only) connectors
- [ ] Extend SEO/AEO workspace into a measurable engine
- [ ] Email lifecycle journeys wired to real user activity
- [ ] Social + Paid Media connectors (read-only → draft → approval → guardrailed)

### Optimization
- [ ] Experiments, attribution models, forecasting, guardrailed autonomy

### Hardening
- [ ] Cross-tenant test matrix, E2E flows, a11y pass, cost governance, monitoring

## Guardrails (non-negotiable)

- Never weaken RLS; every marketing table stays service-role-only.
- Never invent successful external integration states or fabricated analytics.
- No autonomous spend/publish without a configurable policy + approval record.
- External/user text is untrusted data, never instructions (prompt-injection).
- No secrets in bundles, logs, or client-visible errors.
