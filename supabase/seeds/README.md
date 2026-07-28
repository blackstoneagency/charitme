# CharitMe seed data — 100+ rows per feature

These files populate every major **user-facing feature** with **120 rows each** so
you can fully exercise the platform (lists, filters, pagination, dashboards,
admin consoles) against realistic volume.

They are written for the **Supabase SQL editor** (or `psql`). They use the
service/`postgres` role, so RLS does not block the inserts.

These are disposable local/staging fixtures, not production data. Never run this
suite with `supabase db reset --linked`. Before running individual SQL seed
files, set both guards in the same database session:

```sql
set charitme.allow_demo_seed = 'true';
set app.charitme_allow_demo_seed = 'true';
```

The base seed refuses to start when it finds any auth identity outside the
reserved demo domains. Mutating SQL files fail closed when either session guard
is absent. The JavaScript marketing seeders additionally require
`CHARITME_ALLOW_DEMO_SEED=true` and refuse to run with `NODE_ENV=production`.

## One-command run (psql)

If you have a Postgres connection string (Supabase → Project Settings →
Database → Connection string, "URI"), run the whole suite in order with:

```bash
# from the repo root; runs 00→07 then the 99 verifier, stopping on first error
export DATABASE_URL='postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'
for f in 00 01 02 03 04 05 06 07 99; do
  echo "── running ${f} ──"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "supabase/seeds/${f}"_*.sql || break
done
```

The final `99` step prints a row-count table with an `ok` (≥100) flag per
feature — that is your proof the ≥100-rows-per-feature bar is met. **Run once**
(see caveats below). Or paste each file into the Supabase SQL editor in order.

The `99_verify_counts.sql` verifier is strict: it raises an exception when any
expected feature table is missing or below 100 rows. A successful completion is
the authoritative seed-coverage check.

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
| 06 | `06_extended_features.sql` | `creator_profiles`, `membership_tiers`, `member_subscriptions`, `exclusive_posts`, `creator_tips`, `digital_products`, `product_orders`, `auction_items`, `auction_bids`, `livestreams`, `giving_days`, `donor_crm_contacts`, `donor_segments`, `campaign_media`, `transparency_ledger_items` | 120 each |
| 07 | `07_operational_features.sql` | Role personas, organizations/brands, volunteer shifts/hours, tax-delivery ledgers, teams, beneficiaries, messaging, privacy, embeds, analytics, outreach, and Marketing Engine plans/assets | 120 each |
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

After running 00–07, run `99_verify_counts.sql`. Every row should show `ok = true`
(≥100). Anything showing `false` on a per-user table means you need more profiles —
run `00_test_users.sql`.
