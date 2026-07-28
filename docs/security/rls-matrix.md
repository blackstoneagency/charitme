# CharitMe — RLS Coverage Matrix

> Static audit of Row Level Security across all migrations (§6.2). Live
> per-persona verification (querying `pg_class.relrowsecurity` and driving each
> role) still requires DB access and is gated in this environment.

## Coverage summary (from `supabase/migrations/`)

- **132** tables created across all migrations.
- **98** declare `enable row level security` with policies (user-accessible data).
- **34** did **not** declare RLS in-migration — **all** in admin/finance/marketing
  clusters, **all** confirmed accessed **only via the service-role client**
  (`supabaseAdmin`) with **zero** anon/authenticated (`createClient`/browser)
  access anywhere in the app.

## Finding & remediation

**Finding (Medium → latent High):** the 34 service-role-only tables had no RLS
declaration. Because the schema-cache-reload path (`POST /api/health`) grants
`anon`/`authenticated` broad table privileges, a table left without RLS could be
read directly through PostgREST even though the app never does so.

**Remediation (this session):** migration
`20260723002000_rls_hardening_admin_tables.sql` enables RLS (deny-all, no
policies) on all 34. Because `service_role` bypasses RLS (`BYPASSRLS`), every
existing admin route, webhook handler, and marketing function keeps working
unchanged; anon/authenticated direct-PostgREST access is now denied. Idempotent
and existence-guarded, so safe on clean or existing databases.

**Verification method used:** for each table, `grep` confirmed every `.from('<t>')`
call site resides in a file whose only Supabase client is `supabaseAdmin`
(0 `createClient`/`supabase-browser` references in: `lib/marketing-engine.ts`,
`lib/payment-admin-data.ts`, `lib/payment-flow.ts`, `lib/lead-enrichment.ts`,
`app/go/[code]/route.ts`, `app/api/marketing/capture/route.ts`, and the admin
API routes + `app/api/stripe/webhook/route.ts`).

## The 34 hardened tables

**Payment/finance:** campaign_owner_payouts, campaign_owner_transfers,
campaign_payment_admin_notes, campaign_payment_audit_logs,
campaign_payment_breakdowns, campaign_payment_disputes, campaign_payment_events,
campaign_payment_exports, campaign_payment_reconciliation,
campaign_payment_refunds, campaign_payment_settings,
campaign_payment_webhook_events, campaign_payments, campaign_platform_fees,
campaign_processor_fees, payment_processors, processor_accounts.

**Marketing:** marketing_audit_logs, marketing_automation_runs,
marketing_automations, marketing_campaign_recipients, marketing_campaigns,
marketing_consent, marketing_contacts, marketing_email_templates,
marketing_events, marketing_form_submissions, marketing_forms,
marketing_identities, marketing_referrals, marketing_segment_members,
marketing_segments, marketing_suppression_list, marketing_utm_links.

## Repeatable live smoke check

`npm run test:rls-live` runs a read-only PostgREST check using the public anon
key. It verifies that anonymous callers cannot read `profiles`, `donations`, or
`privacy_requests`. To add authenticated isolation checks, provide a JSON array
of real staging test users through `CHARITME_RLS_TEST_USERS_JSON`:

```json
[{"name":"donor-a","email":"<staging email>","password":"<staging password>","userId":"<uuid>"},{"name":"donor-b","email":"<staging email>","password":"<staging password>","userId":"<uuid>"}]
```

The harness verifies each user's own profile is readable and another supplied
persona's profile is not. It never writes data, uses the service-role key, or
prints credentials. It creates fresh sessions on each run, so release checks do
not depend on stored access tokens. Run it only against a staging project with
dedicated test users before recording a new certification.

## Remaining (gated on live DB access)

- Apply this migration to the live project and confirm `relrowsecurity=true` on
  all 34 (the additive migration is safe to apply per the grants/volunteers
  playbook).
- Automated per-persona RLS test harness (anon, donor, organizer, beneficiary,
  nonprofit admin, corporate admin, T&S, finance, support, super admin) against
  the 98 policy-bearing tables — needs seeded sessions on a staging project.
