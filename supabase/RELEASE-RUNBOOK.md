# Applying the 27 pending migrations

Everything that could be verified without a Supabase plan has been. This is the
part that needs an account, written so it is mechanical rather than exploratory.

**Current state:** 87 of 114 migrations applied to production; **27 pending**.
Six of the 27 are privilege/RLS hardening that is merged but **not live**.

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

## Step 3 — confirm the count before touching anything

```bash
supabase migration list --linked        # expect 87 applied, 27 pending
```

If it is not 87/27, **stop**. Something was applied outside the gate and the
arithmetic in `__tests__/migration-ledger.test.ts` needs updating first.

## Step 4 — apply to staging and smoke-test

```bash
supabase db push --db-url "$STAGING_DB_URL" --include-all
```

Then exercise, as an authenticated user — these are the six security migrations
in effect, so a mistake here is a permissions mistake:

- a donation end to end (`record_donation` is replaced by two of the 27)
- a tax receipt send (`20260728020000` fixes an upsert that silently no-ops)
- reading another user's `creator_tips` → **must be denied**
- reading another user's `donor_messages` → **must be denied**
- an admin action and a non-admin attempt at the same action

## Step 5 — apply to production

Only after step 4 passes.

```bash
supabase db push --linked --include-all
supabase migration list --linked        # expect 114 applied, 0 pending
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
