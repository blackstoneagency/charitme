-- ─────────────────────────────────────────────────────────────────────────────
-- Immutable double-entry financial ledger + reconciliation exceptions (spec §1.7).
--
-- The ledger is the auditable record of every monetary event. It is APPEND-ONLY:
-- entries can never be updated or deleted (enforced by trigger). Corrections are
-- made with reversing/adjusting entries. Each event posts a BALANCED group of
-- lines (total debits = total credits). Admin/finance read-only via RLS.
--
-- This is metadata + accounting, NOT custody of funds — Stripe holds the money.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ledger_entries (
  id                           uuid primary key default uuid_generate_v4(),
  entry_group_id               uuid not null,          -- balanced lines of one event share this
  account                      text not null check (account in (
                                 'donor_clearing','recipient_payable','platform_revenue',
                                 'processor_fees','refunds','disputes','adjustments')),
  direction                    text not null check (direction in ('debit','credit')),
  amount_cents                 bigint not null check (amount_cents >= 0),
  currency                     text not null default 'usd',
  event_type                   text not null check (event_type in (
                                 'donation','refund','partial_refund','dispute','payout','adjustment')),
  -- Linkage
  campaign_id                  uuid references campaigns(id) on delete set null,
  donation_id                  uuid references donations(id) on delete set null,
  recipient_user_id            uuid references profiles(id) on delete set null,
  connected_account_id         text,
  -- Stripe references (for reconciliation)
  stripe_payment_intent_id     text,
  stripe_charge_id             text,
  stripe_application_fee_id    text,
  stripe_balance_transaction_id text,
  stripe_refund_id             text,
  stripe_dispute_id            text,
  stripe_transfer_id           text,
  stripe_payout_id             text,
  -- Audit
  idempotency_key              text,
  correlation_id               text,
  source                       text not null default 'system',
  occurred_at                  timestamptz not null default now(),
  effective_at                 timestamptz not null default now(),
  created_at                   timestamptz not null default now()
);

create index if not exists ledger_entries_group_idx     on ledger_entries(entry_group_id);
create index if not exists ledger_entries_donation_idx   on ledger_entries(donation_id);
create index if not exists ledger_entries_campaign_idx   on ledger_entries(campaign_id);
create index if not exists ledger_entries_account_idx    on ledger_entries(account);
create index if not exists ledger_entries_pi_idx         on ledger_entries(stripe_payment_intent_id);
-- Idempotency: a given (idempotency_key, account, direction) may be posted at most once.
create unique index if not exists ledger_entries_idem_uniq
  on ledger_entries(idempotency_key, account, direction) where idempotency_key is not null;

-- ── Immutability: block UPDATE and DELETE ────────────────────────────────────
create or replace function public.prevent_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only; post reversing entries instead';
end; $$;

drop trigger if exists ledger_entries_no_update on ledger_entries;
create trigger ledger_entries_no_update before update on ledger_entries
  for each row execute function public.prevent_ledger_mutation();
drop trigger if exists ledger_entries_no_delete on ledger_entries;
create trigger ledger_entries_no_delete before delete on ledger_entries
  for each row execute function public.prevent_ledger_mutation();

-- ── reconciliation_exceptions ────────────────────────────────────────────────
create table if not exists reconciliation_exceptions (
  id               uuid primary key default uuid_generate_v4(),
  kind             text not null check (kind in (
                     'amount_mismatch','missing_ledger','missing_stripe','unbalanced_group',
                     'duplicate','fee_mismatch','payout_mismatch','other')),
  status           text not null default 'open' check (status in ('open','assigned','resolved','ignored')),
  description      text not null,
  campaign_id      uuid references campaigns(id) on delete set null,
  donation_id      uuid references donations(id) on delete set null,
  stripe_ref       text,
  expected_cents   bigint,
  actual_cents     bigint,
  difference_cents bigint,
  assignee_id      uuid references profiles(id) on delete set null,
  resolution_note  text,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists reconciliation_exceptions_status_idx on reconciliation_exceptions(status);

drop trigger if exists reconciliation_exceptions_updated_at on reconciliation_exceptions;
create trigger reconciliation_exceptions_updated_at before update on reconciliation_exceptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — financial internals: admin only (service role bypasses).
-- ─────────────────────────────────────────────────────────────────────────────
alter table ledger_entries            enable row level security;
alter table reconciliation_exceptions enable row level security;

drop policy if exists ledger_entries_admin_read on ledger_entries;
create policy ledger_entries_admin_read on ledger_entries for select using (is_admin());
-- No insert/update/delete policy for end users: writes happen via service role only,
-- and the immutability trigger blocks update/delete even for the service role.

drop policy if exists reconciliation_exceptions_admin_all on reconciliation_exceptions;
create policy reconciliation_exceptions_admin_all on reconciliation_exceptions for all
  using (is_admin()) with check (is_admin());
