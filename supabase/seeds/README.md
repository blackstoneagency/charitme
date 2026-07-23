# CharitMe seed data — 100+ rows per feature

These files populate every major **user-facing feature** with **120 rows each** so
you can fully exercise the platform (lists, filters, pagination, dashboards,
admin consoles) against realistic volume.

## Safety gate

These are demo/staging fixtures, not production data. Before running them, set an
explicit session flag in the SQL editor or `psql` connection:

```sql
set app.charitme_allow_demo_seed = 'true';
```

Run them only against a disposable staging/demo project. The JavaScript seed
scripts require `CHARITME_ALLOW_DEMO_SEED=true` and refuse `NODE_ENV=production`.

They are written for the **Supabase SQL editor** (or `psql`). They use the
service/`postgres` role, so RLS does not block the inserts.

## Run order

Run these **in order**, once each, top to bottom:

| # | File | Seeds | Rows |
|---|------|-------|------|
| 00 | `00_test_users.sql` | `auth.users` → `profiles` (the trigger auto-creates profiles) | 120 users |
| 01 | `01_campaigns_core.sql` | `campaigns` (ensures ≥120), `campaign_updates`, `campaign_faqs`, `campaign_milestones`, `campaign_rewards`, `donations`, `saved_campaigns`, `notifications` | 120 each |
| 02 | `02_marketplaces.sql` | `sponsorship_opportunities`/`requests`, `grants` (+`deadlines`/`applications`/`documents`/`matches`), `matching_programs`/`claims`, `volunteer_opportunities`/`applications`/`profiles`, `nonprofit_profiles` | 120 each |
| 03 | `03_events.sql` | `fundraising_events`, `event_tickets`, `event_registrations`, `event_checkins`, `peer_fundraisers` | 120 each |
| 04 | `04_impact_gamification.sql` | `impact_plans`, `impact_plan_items`, `impact_updates`, `impact_evidence`, `impact_metrics`, `challenges`, `challenge_participants`, `user_badges` | 120 each |
| 05 | `05_engagement_financial.sql` | `donor_messages`, `recurring_donations`, `refunds`, `payouts`, `verification_documents`, `risk_flags`, `tax_receipts`, `business_leads` | 120 each |
| 99 | `99_verify_counts.sql` | *(read-only)* reports row counts + an `ok` flag (≥100) per feature | — |

Each feature file re-reads whatever `profiles`/`campaigns` already exist, so if
you already have real data you can skip `00` and `01` — but the strictly
**per-user** tables (see below) only reach 100 rows once you have **≥100 profiles**.

## Notes & caveats

- **Run once.** The child-table inserts are additive; re-running appends another
  120 rows (and `impact_plans`/`fundraising_events`-style unique constraints will
  error on a second full run). `00_test_users.sql` **is** idempotent (skips emails
  that already exist).
- **Test users have no password** — they exist to populate data, not to log in.
  Create a real login through the app/dashboard for interactive testing.
- **Per-user tables** (`volunteer_profiles`, `saved_campaigns`, `challenge_participants`,
  `user_badges`) are 1-row-per-user or unique on `(user, …)`, so they reach
  `min(120, number_of_profiles)`. Run `00` first to guarantee ≥120.
- If your Supabase/GoTrue version rejects the `auth.users` insert in `00`, create
  ~120 users another way (dashboard/app) — files 01–04 will still work.

## Not seeded here (by design)

Internal **plumbing** tables don't need 100 rows to test features and are left
out: audit logs, webhook events, the `campaign_payment_*` observability tables,
`ledger_entries`/`reconciliation_exceptions` (populated by the live donation/
refund flow), rate-limit hits, and the `marketing_*` internals (there are already
generator scripts under `scripts/seed-marketing-data.mjs`). Support cases and
sponsors have existing seed migrations. Ask if you want any of these added.

## Verifying

After running 00–04, run `99_verify_counts.sql`. Every row should show `ok = true`
(≥100). Anything showing `false` on a per-user table means you need more profiles —
run `00_test_users.sql`.

For a repeatable CI/deployment check against a configured Supabase project, run the
read-only service-role audit from the repository root:

```bash
node --env-file=apps/web/.env.local scripts/audit-seed-coverage.mjs --json
```

It exits non-zero when a target table is missing or below 100 rows and never prints
row contents or credentials.
