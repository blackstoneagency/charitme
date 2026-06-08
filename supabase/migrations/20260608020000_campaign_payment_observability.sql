create table if not exists public.payment_processors (
  id uuid primary key default uuid_generate_v4(),
  processor text not null unique check (processor in ('stripe','paypal','manual','other')),
  display_name text not null,
  status text not null default 'disabled' check (status in ('enabled','disabled','test','error')),
  dashboard_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

insert into public.payment_processors (processor, display_name, status, dashboard_url, metadata)
values
  ('stripe', 'Stripe', 'enabled', 'https://dashboard.stripe.com/payments', '{"campaign_donations": true}'::jsonb),
  ('paypal', 'PayPal', 'disabled', 'https://www.paypal.com/mep/dashboard', '{"campaign_donations": false, "setup_required": true}'::jsonb)
on conflict (processor) do update set
  display_name = excluded.display_name,
  dashboard_url = excluded.dashboard_url,
  updated_at = now();

create table if not exists public.processor_accounts (
  id uuid primary key default uuid_generate_v4(),
  processor text not null check (processor in ('stripe','paypal','manual','other')),
  account_scope text not null default 'campaign_owner' check (account_scope in ('platform','campaign_owner','processor')),
  owner_id uuid references public.profiles(id) on delete set null,
  connected_account_id uuid references public.connected_accounts(id) on delete set null,
  processor_account_id text not null,
  status text not null default 'pending' check (status in ('active','pending','restricted','disabled','error')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (processor, processor_account_id)
);

create table if not exists public.campaign_payments (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid references public.donations(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  business_id uuid,
  tenant_id uuid,
  processor text not null default 'stripe' check (processor in ('stripe','paypal','manual','other')),
  processor_account_id text,
  processor_charge_id text,
  processor_payment_intent_id text,
  processor_checkout_session_id text,
  processor_transfer_id text,
  processor_payout_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  tip_amount bigint not null default 0 check (tip_amount >= 0),
  platform_fee_amount bigint not null default 0 check (platform_fee_amount >= 0),
  processor_fee_amount bigint not null default 0 check (processor_fee_amount >= 0),
  campaign_owner_net_amount bigint not null default 0 check (campaign_owner_net_amount >= 0),
  refunded_amount bigint not null default 0 check (refunded_amount >= 0),
  disputed_amount bigint not null default 0 check (disputed_amount >= 0),
  currency text not null default 'usd',
  payment_status text not null default 'pending' check (payment_status in ('pending','processing','succeeded','failed','canceled','refunded','partially_refunded','disputed')),
  transfer_status text not null default 'not_applicable' check (transfer_status in ('not_applicable','pending','created','paid','failed','canceled')),
  payout_status text not null default 'not_applicable' check (payout_status in ('not_applicable','requested','approved','pending','paid','failed','frozen','released')),
  refund_status text not null default 'none' check (refund_status in ('none','requested','partial','full','failed')),
  dispute_status text not null default 'none' check (dispute_status in ('none','opened','won','lost','warning_needs_response','closed')),
  settlement_status text not null default 'pending' check (settlement_status in ('pending','available','paid_out','failed','needs_review')),
  reconciliation_status text not null default 'pending_data' check (reconciliation_status in ('reconciled','pending_data','mismatch','failed','needs_review','ignored')),
  reconciliation_reason text,
  paid_at timestamptz,
  available_on timestamptz,
  payout_at timestamptz,
  last_webhook_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  constraint campaign_payments_amounts_balance check (
    gross_amount + tip_amount >= platform_fee_amount + campaign_owner_net_amount
  )
);

create unique index if not exists campaign_payments_payment_intent_uidx
  on public.campaign_payments(processor, processor_payment_intent_id)
  where processor_payment_intent_id is not null;
create unique index if not exists campaign_payments_checkout_uidx
  on public.campaign_payments(processor, processor_checkout_session_id)
  where processor_checkout_session_id is not null;
create index if not exists campaign_payments_campaign_idx on public.campaign_payments(campaign_id, created_at desc);
create index if not exists campaign_payments_owner_idx on public.campaign_payments(campaign_owner_id, created_at desc);
create index if not exists campaign_payments_status_idx on public.campaign_payments(payment_status, payout_status, reconciliation_status);
create index if not exists campaign_payments_processor_idx on public.campaign_payments(processor, created_at desc);

create table if not exists public.campaign_payment_breakdowns (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid not null references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  tip_amount bigint not null default 0 check (tip_amount >= 0),
  processor_fee_amount bigint not null default 0 check (processor_fee_amount >= 0),
  platform_fee_amount bigint not null default 0 check (platform_fee_amount >= 0),
  owner_net_amount bigint not null default 0 check (owner_net_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'current' check (status in ('current','superseded','pending_data')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_payment_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  event_type text not null,
  event_status text not null default 'received',
  amount bigint not null default 0 check (amount >= 0),
  currency text not null default 'usd',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (processor, processor_object_id, event_type)
);

create table if not exists public.campaign_processor_fees (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  processor_fee_amount bigint not null default 0 check (processor_fee_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','recorded','unavailable','refunded','adjusted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_platform_fees (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  platform_fee_amount bigint not null default 0 check (platform_fee_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','recorded','refunded','adjusted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_owner_transfers (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  owner_net_amount bigint not null default 0 check (owner_net_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','created','paid','failed','canceled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_owner_payouts (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  owner_net_amount bigint not null default 0 check (owner_net_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('requested','approved','pending','paid','failed','frozen','released','not_applicable')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_payment_refunds (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  refund_id uuid references public.refunds(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  refund_amount bigint not null default 0 check (refund_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'requested' check (status in ('requested','pending','processed','failed','declined')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_payment_disputes (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  dispute_amount bigint not null default 0 check (dispute_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'opened' check (status in ('opened','warning_needs_response','won','lost','closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (processor, processor_object_id)
);

create table if not exists public.campaign_payment_reconciliation (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid not null references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  processor_fee_amount bigint not null default 0 check (processor_fee_amount >= 0),
  platform_fee_amount bigint not null default 0 check (platform_fee_amount >= 0),
  owner_net_amount bigint not null default 0 check (owner_net_amount >= 0),
  refunded_amount bigint not null default 0 check (refunded_amount >= 0),
  disputed_amount bigint not null default 0 check (disputed_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending_data' check (status in ('reconciled','pending_data','mismatch','failed','needs_review','ignored')),
  issues text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (campaign_payment_id)
);

create table if not exists public.campaign_payment_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  webhook_event_id uuid references public.webhook_events(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  processor_event_id text not null,
  event_type text not null,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'received' check (status in ('received','processed','duplicate','failed','ignored')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (processor, processor_event_id)
);

create table if not exists public.campaign_payment_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  action text not null,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_payment_admin_notes (
  id uuid primary key default uuid_generate_v4(),
  campaign_payment_id uuid references public.campaign_payments(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  note text not null check (char_length(note) between 1 and 5000),
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'active' check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_payment_exports (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  processor text default 'stripe',
  processor_account_id text,
  processor_object_id text,
  export_type text not null,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'requested' check (status in ('requested','generated','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz
);

create table if not exists public.campaign_payment_settings (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  campaign_owner_id uuid references public.profiles(id) on delete set null,
  donor_id uuid references public.profiles(id) on delete set null,
  processor text not null default 'stripe',
  processor_account_id text,
  processor_object_id text,
  gross_amount bigint not null default 0 check (gross_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'active' check (status in ('active','disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  unique (campaign_id, processor)
);

create index if not exists campaign_payment_events_payment_idx on public.campaign_payment_events(campaign_payment_id, occurred_at desc);
create index if not exists campaign_payment_breakdowns_payment_idx on public.campaign_payment_breakdowns(campaign_payment_id);
create index if not exists campaign_processor_fees_payment_idx on public.campaign_processor_fees(campaign_payment_id);
create index if not exists campaign_platform_fees_payment_idx on public.campaign_platform_fees(campaign_payment_id);
create index if not exists campaign_owner_transfers_payment_idx on public.campaign_owner_transfers(campaign_payment_id);
create index if not exists campaign_owner_payouts_payment_idx on public.campaign_owner_payouts(campaign_payment_id);
create index if not exists campaign_payment_refunds_payment_idx on public.campaign_payment_refunds(campaign_payment_id);
create index if not exists campaign_payment_disputes_payment_idx on public.campaign_payment_disputes(campaign_payment_id);
create index if not exists campaign_payment_reconciliation_status_idx on public.campaign_payment_reconciliation(status, checked_at desc);
create index if not exists campaign_payment_webhooks_payment_idx on public.campaign_payment_webhook_events(campaign_payment_id, created_at desc);
create index if not exists campaign_payment_admin_notes_payment_idx on public.campaign_payment_admin_notes(campaign_payment_id, created_at desc);

create or replace function public.campaign_payment_owner_can_read(p_campaign_id uuid, p_campaign_owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = p_campaign_owner_id
    or exists (
      select 1 from public.campaigns c
      where c.id = p_campaign_id and c.user_id = auth.uid()
    );
$$;

create or replace function public.audit_campaign_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  row_data jsonb := to_jsonb(new);
begin
  insert into public.campaign_payment_audit_logs (
    campaign_payment_id, campaign_id, campaign_owner_id, donor_id,
    processor, processor_account_id, processor_object_id,
    action, gross_amount, currency, status, metadata
  ) values (
    nullif(coalesce(row_data->>'campaign_payment_id', row_data->>'id'), '')::uuid,
    nullif(row_data->>'campaign_id', '')::uuid,
    nullif(row_data->>'campaign_owner_id', '')::uuid,
    nullif(row_data->>'donor_id', '')::uuid,
    coalesce(row_data->>'processor', 'stripe'),
    row_data->>'processor_account_id',
    coalesce(row_data->>'processor_object_id', row_data->>'processor_payment_intent_id', row_data->>'processor_checkout_session_id'),
    tg_table_name || '.' || lower(tg_op),
    coalesce((row_data->>'gross_amount')::bigint, 0),
    coalesce(row_data->>'currency', 'usd'),
    'recorded',
    jsonb_build_object('table', tg_table_name, 'operation', tg_op)
  );
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'payment_processors','processor_accounts','campaign_payments','campaign_payment_breakdowns',
    'campaign_payment_events','campaign_processor_fees','campaign_platform_fees',
    'campaign_owner_transfers','campaign_owner_payouts','campaign_payment_refunds',
    'campaign_payment_disputes','campaign_payment_reconciliation','campaign_payment_webhook_events',
    'campaign_payment_audit_logs','campaign_payment_admin_notes','campaign_payment_exports',
    'campaign_payment_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists set_updated_at_%I on public.%I', t, t);
    execute format('create trigger set_updated_at_%I before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

drop trigger if exists audit_campaign_payments_write on public.campaign_payments;
create trigger audit_campaign_payments_write
  after insert or update on public.campaign_payments
  for each row execute function public.audit_campaign_payment_change();

drop trigger if exists audit_campaign_payment_reconciliation_write on public.campaign_payment_reconciliation;
create trigger audit_campaign_payment_reconciliation_write
  after insert or update on public.campaign_payment_reconciliation
  for each row execute function public.audit_campaign_payment_change();

drop policy if exists payment_processors_admin_all on public.payment_processors;
create policy payment_processors_admin_all on public.payment_processors for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists payment_processors_owner_read on public.payment_processors;
create policy payment_processors_owner_read on public.payment_processors for select using (auth.uid() is not null);

drop policy if exists processor_accounts_admin_all on public.processor_accounts;
create policy processor_accounts_admin_all on public.processor_accounts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists processor_accounts_owner_read on public.processor_accounts;
create policy processor_accounts_owner_read on public.processor_accounts for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists campaign_payments_admin_all on public.campaign_payments;
create policy campaign_payments_admin_all on public.campaign_payments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_payments_owner_read on public.campaign_payments;
create policy campaign_payments_owner_read on public.campaign_payments for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

drop policy if exists campaign_payment_breakdowns_admin_all on public.campaign_payment_breakdowns;
create policy campaign_payment_breakdowns_admin_all on public.campaign_payment_breakdowns for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_payment_breakdowns_owner_read on public.campaign_payment_breakdowns;
create policy campaign_payment_breakdowns_owner_read on public.campaign_payment_breakdowns for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

drop policy if exists campaign_owner_transfers_admin_all on public.campaign_owner_transfers;
create policy campaign_owner_transfers_admin_all on public.campaign_owner_transfers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_owner_transfers_owner_read on public.campaign_owner_transfers;
create policy campaign_owner_transfers_owner_read on public.campaign_owner_transfers for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

drop policy if exists campaign_owner_payouts_admin_all on public.campaign_owner_payouts;
create policy campaign_owner_payouts_admin_all on public.campaign_owner_payouts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_owner_payouts_owner_read on public.campaign_owner_payouts;
create policy campaign_owner_payouts_owner_read on public.campaign_owner_payouts for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'campaign_payment_events','campaign_processor_fees','campaign_platform_fees',
    'campaign_payment_refunds','campaign_payment_disputes','campaign_payment_reconciliation',
    'campaign_payment_webhook_events','campaign_payment_audit_logs','campaign_payment_admin_notes',
    'campaign_payment_exports','campaign_payment_settings'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;
