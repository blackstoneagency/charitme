# Applying the 47 pending migrations to production

Written 2026-08-10, after being asked to apply them from an agent sandbox that
**cannot**: it holds no `SUPABASE_ACCESS_TOKEN`, no database password, no
Postgres URL, and its `SUPABASE_SERVICE_ROLE_KEY` is dead — production answers
`{"message":"Unregistered API key"}`. `.env.local` says so in its own header:
production secrets are deliberately omitted from the ephemeral container. Even a
live service-role key would not do it; PostgREST executes RPCs, not DDL.

So this is the runbook for whoever has the credential.

## The batch

47 files, `20260803000000_profiles_preference_columns` →
`20260904030000_deleted_user_tombstone`. That figure is a **file-derived upper
bound**: 134 local files against 87 rows in the production ledger. Some may
already be applied without a ledger row, which is harmless — `supabase db push`
applies only what is missing.

```bash
export SUPABASE_ACCESS_TOKEN=...          # or use the DB password
supabase link --project-ref yanexccimwooursawynm
supabase migration list                    # ← the real applied/pending split
supabase db push --dry-run                 # ← what it will actually run
supabase db push
```

⚠️ **Run `migration list` and `--dry-run` first.** They replace the estimate above
with the database's own answer. Everything below is a static read of the files.

## What in this batch destroys rows

Scanned for `DROP`, `DELETE`, `TRUNCATE`, `SET NOT NULL`, type changes and bulk
`UPDATE`. Most hits are the ordinary `drop policy … create policy` idiom, which is
how these migrations stay replayable. Four needed reading, and two of those turned
out to be nothing:

| Migration | What it really does |
|---|---|
| `20260812000000_make_onconflict_targets_inferable` | **Deletes duplicate rows** from `campaign_processor_fees`, `campaign_payment_refunds`, `campaign_owner_transfers`, keeping the newest per `(processor, processor_object_id)`, then adds a UNIQUE index. Real deletions, on payment-adjacent tables. |
| `20260812030000_tax_document_guest_access` | **Deletes duplicate `donation_receipts`** per `donation_id`, keeping the most recently sent, and lowercases `donor_email`. Real deletions. |
| `20260814010000_harden_role_and_team_boundaries` | ❌ **Not a `TRUNCATE`.** The word appears inside `revoke insert, update, delete, truncate … from authenticated` — a privilege grant, not a command. |
| `20260808000000_demo_data_labeling` | ❌ **Not executed.** The `update public.campaigns set is_demo = true` sits inside a comment block documenting a manual procedure. |

### Before running, count what the dedupes will remove

They are the only statements in the batch that delete production rows. If a count
comes back large or surprising, stop and look — a "duplicate" here is a payment
record.

```sql
select count(*) from (
  select 1 from public.campaign_processor_fees older
  join public.campaign_processor_fees newer
    on older.processor = newer.processor
   and older.processor_object_id = newer.processor_object_id
  where older.processor_object_id is not null
    and (older.created_at, older.id) < (newer.created_at, newer.id)
) q;   -- repeat for campaign_payment_refunds, campaign_owner_transfers,
       -- and donation_receipts (keyed on donation_id)
```

## Migrations whose effect you cannot see from outside

`npm run probe:production-migrations` asks production which of these are already
applied over unauthenticated HTTP. It is the fastest way to shrink the unknown
set. The ones it cannot answer are catalogued in
`scripts/probe-production-migrations.mjs` with the reason — several are
authenticated-only or gated on `published = true`, and three in this batch were
flagged by their authors as needing **staging verification before production**:

- `20260904000000_paid_event_tickets` — paid registration state and inventory
  transitions; needs Stripe test-mode webhooks
- `20260904010000_dashboard_financial_reporting` — service-role reporting RPCs
- `20260904020000_volunteer_checkin_code_privacy` — column-level privilege
  hardening; a successful public read cannot prove a denied column

They are not mine and I have not verified them. A single `db push` applies them
alongside everything else, which is worth knowing before running one command.

## You do not have to push all 47 to unblock deletion

⚠️ **The framing above — "even a live service-role key would not do it; PostgREST
executes RPCs, not DDL" — is correct about the API and wrong as a conclusion about
the owner.** The Supabase **SQL editor** runs as `postgres`, not through PostgREST,
so it executes anything a migration contains. This was proved on 2026-08-10: the
owner applied `20260904040000_default_support_percent_ten` that way, read the value
back as `10`, and the live donate card changed within the minute.

That matters here because the tombstone is the *only* migration blocking
self-service deletion, and it is **safe to run alone**:

- It is **pure DML** — two `INSERT`s and one `COMMENT`. No table, column, type,
  policy or index is created, so nothing later in the batch depends on it and it
  depends on nothing earlier. `auth.users` and `public.profiles` both already
  exist in production.
- Both inserts carry `ON CONFLICT (id) DO NOTHING`, so it is **idempotent** and
  running it twice is a no-op.
- It **deletes nothing**. Neither of the two row-destroying dedupe migrations
  above is involved.
- `public.profiles` has no `NOT NULL` column without a default beyond the four it
  supplies, so the insert cannot fail on a missing field.

Paste `supabase/migrations/20260904030000_deleted_user_tombstone.sql` into the SQL
editor for project `yanexccimwooursawynm`, run it, then run the verification block
below.

⚠️ **Two things this route does NOT do.**

1. **It writes no `schema_migrations` row.** `supabase migration list` will still
   call it pending, and a later `db push` will run it again — harmless *for this
   migration* because of the `ON CONFLICT` clauses, but do not generalise that to
   the rest of the batch.
2. **It is not a substitute for `db push`.** It is appropriate here because this
   file is idempotent, self-contained and destroys nothing. A migration that
   creates schema, or that depends on an earlier unapplied one, needs the ordered
   push.

## After the push

```sql
select id, full_name from public.profiles
 where id = '00000000-0000-4000-8000-00000000dead';   -- 'Deleted User'
select banned_until, email_confirmed_at, confirmation_token from auth.users
 where id = '00000000-0000-4000-8000-00000000dead';   -- far future, null, ''
```

⚠️ `confirmation_token` is in that list deliberately. If it — or any of
`recovery_token`, `email_change`, `email_change_token_new`,
`email_change_token_current`, `phone_change`, `phone_change_token`,
`reauthentication_token` — comes back **NULL** rather than `''`, GoTrue cannot
scan the row and every Admin API read of it returns
`500 "Database error loading user"`. That is what happened to the original
tombstone (`…0000deadbeef`, now unused) and to 502 rows in production. It is a
property of inserting into `auth.users` with raw SQL, not of any value stored in
`banned_until`.

The tombstone is the precondition for self-service account deletion. Until it
exists, `POST /api/account/delete` refuses with `TOMBSTONE_MISSING` (503) rather
than deleting — an unapplied migration disables the feature instead of corrupting
anything.

Deletion stays **off** after the push regardless: `ACCOUNT_SELF_DELETE_ENABLED`
is a separate switch, and the endpoint 404s until it is set to `true`.
