# Applying the pending migrations

Everything that could be verified without a Supabase plan has been. This is the
part that needs an account, written so it is mechanical rather than exploratory.

**Repository state:** 114 migration files, of which **27 are newer than the last
figure anyone recorded as applied**. Six of those are privilege/RLS hardening
that is merged but not live.

> ⚠️ **"27 pending" is a FILE COUNT, not a measurement, and it is known to be
> too high.** Two of the 27 are demonstrably already applied to production:
>
> | migration | signal |
> |---|---|
> | `20260817000000_campaign_geolocation` | `/api/campaigns/nearby?lat=&lng=` returns `{"available":true}`, which is only reachable after a select on the `latitude` column succeeds — the route returns `available:false` on PostgREST's `42703` |
> | `20260820000000_incidents_and_maintenance` | `/status` renders "No incidents reported in the last 30 days", the `length === 0` branch, which requires a successful read; it renders "Incident history could not be loaded" otherwise |
>
> **This is now four, not two, and it is a script rather than a note.** Run it
> before you plan anything — it needs no credentials and takes seconds:
>
> ```bash
> npm run probe:migrations --workspace=apps/web     # --base defaults to www.charitme.com
> ```
>
> Measured 2026-08-03 against production: **4 of the 27 are already applied** —
> `reconcile_runtime_tables` (proven twice, via `campaign_milestones` and
> `campaign_faqs`), `volunteer_shifts_hours`, `campaign_geolocation`, and
> `incidents_and_maintenance`. The remaining 23 have **no public signal**, which
> the script lists individually with the reason.
>
> ⚠️ **APPLIED is proof; "no proof" is NOT evidence of pending.** A successful
> read cannot happen unless the migration ran, so a ✅ is conclusive. A ❔ only
> means no unauthenticated route reads that table — six of them are RLS changes
> that are invisible to any successful read by design, and one
> (`creator_tips_not_world_readable`) could only be probed by performing the
> leak it closes.
>
> So the true pending set is **somewhere between 0 and 23 — establish it in Step
> 3 rather than assuming it.**

---

## Before you start — what is already proven

Run these yourself; they need no credentials and take a few minutes.

```bash
./scripts/rehearse-migrations.sh    # 114/114 apply clean; 162 tables, 162 with RLS, 0 unprotected
./scripts/rehearse-rollbacks.sh     # 11/11 rollbacks remove their targets with no collateral
```

| | |
|---|---|
| all 114 replay from zero, in order, no errors | ✅ measured |
| resulting schema RLS-complete (162/162 tables) | ✅ measured |
| every pending migration has a rollback | ✅ 27/27 |
| function rollbacks byte-identical to prior body | ✅ 3/3 |

What this does **not** prove: drift between the migrations and what is actually
live. That is what staging is for, and it is the only reason this document
exists.

---

## Step 1 — get a staging database

Any one of these unblocks it:

- Upgrade Supabase to Pro and create a **Preview Branch** (returns HTTP 402 on
  the free plan)
- Pause or delete an unrelated project to free a slot, then create
  `charitme-staging` (a third free project is refused at the two-project limit)
- Provision staging in another organization

## Step 2 — restore production into staging

Staging must be a copy of **production**, not a fresh database. A clean replay
already passes locally; it cannot surface drift.

```bash
supabase db dump --linked --schema public -f /tmp/prod-snapshot.sql
psql "$STAGING_DB_URL" -f /tmp/prod-snapshot.sql
```

## Step 3 — establish what is ACTUALLY pending

This step used to say "expect 87 applied, 27 pending — if it is not 87/27,
**stop**". That instruction was wrong and actively harmful: at least two of the
27 are already live, so following it would abort a perfectly valid release on
the belief that something had gone wrong outside the gate.

Measure instead of expecting:

```bash
npm run probe:migrations --workspace=apps/web   # no credentials; proves what is ALREADY live
supabase migration list --linked                # the authoritative answer, needs the project
```

Take the pending list from THAT output. Cross-check it against the files:

```bash
ls supabase/migrations/*.sql | xargs -n1 basename | sed 's/_.*//' | sort > /tmp/files.txt
# ...and diff against the versions `migration list` reports as applied.
```

**What to do with the result:**

- A migration listed as applied that you expected to be pending is **normal** —
  see the note at the top. Skip it; do not re-run it. The four the probe already
  proved are the known cases.
- A migration the probe reports **APPLIED** but `migration list` reports
  **pending** is the one contradiction worth stopping for: the schema has the
  change but the ledger does not know, so `db push` would try to re-run it.
  Check that migration is idempotent before pushing.
- A migration listed as *pending* that you expected to be applied is the case
  worth stopping for. That is real drift.
- `supabase db push` applies only what is missing, so an already-applied
  migration is skipped rather than re-run. The danger is not the push; it is
  planning the release against a count that is wrong.

## Step 4 — apply to staging and smoke-test

```bash
supabase db push --db-url "$STAGING_DB_URL" --include-all
```

Then exercise, as an authenticated user — these are the six security migrations
in effect, so a mistake here is a permissions mistake:

- a donation end to end (`record_donation` is replaced by two of the pending set)
- a tax receipt send (`20260728020000` fixes an upsert that silently no-ops)
- reading another user's `creator_tips` → **must be denied**
- reading another user's `donor_messages` → **must be denied**
- an admin action and a non-admin attempt at the same action

## Step 5 — apply to production

Only after step 4 passes.

```bash
supabase db push --linked --include-all
supabase migration list --linked        # expect 114 applied, 0 pending — this one IS exact
```

---

## ⚠️ If you have to roll back

**Order matters, and one pairing is not obvious.**

> **Roll back `20260814000000_marketing_org_scoping` BEFORE
> `20260807000000_organizations_multitenancy`.**
>
> Dropping `organizations` cascades into 15 foreign keys on tables that survive —
> the whole marketing subsystem is org-scoped. Each keeps its `org_id` column and
> loses the constraint: a half-reverted schema that still looks scoped, which is
> worse than either applying or fully reverting. Found by rehearsal, not by
> reading the SQL.

**Two rollbacks deliberately refuse to run** (`raise exception`, psql exits 3):

- `20260812010000_creator_tips_not_world_readable` — reverting restores anonymous
  SELECT over `supporter_id`, `amount_cents`, `message` and
  `stripe_payment_intent_id`
- `20260819000000_donation_forms_slug_and_campaign_owner` — same shape, and a
  partial revert breaks form URLs rather than restoring anything

If either genuinely must be reverted, do it by hand with sign-off, knowing
exactly what becomes readable again.

**Two rollbacks reinstate a known bug**, which is legitimate but should be
deliberate: `20260728020000` and `20260812000000` restore the `42P10` upsert
failure. For tax receipts that means emailing a donor an IRS receipt while
recording nothing.

---

## Tooling built for this

| script | what it does |
|---|---|
| `rehearse-migrations.sh` | replays all migrations, `ON_ERROR_STOP=1`, names the failing file, exits non-zero, asserts every table has RLS |
| `rehearse-rollbacks.sh` | replays all migrations then applies one rollback per fresh database; asserts targets existed before, are gone after, and no collateral FK loss |
| `generate-function-rollback.sh` | regenerates a `create or replace function` rollback from `pg_get_functiondef()` and keeps it only if the restored body and triggers are byte-identical |
| `diff-migration.sh` | prints exactly what one migration adds, measured by schema diff |

⚠️ `regen_schema.sh` is **not** a verification tool — it runs psql with
`ON_ERROR_STOP=0` and discards output, so a broken migration is silently skipped
and the schema mirror is still written. Use `rehearse-migrations.sh` to verify.
