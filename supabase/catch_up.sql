-- =============================================================================
-- CharitMe production catch-up (schema only, idempotent). Safe to run ONCE on
-- an existing database: creates only what is missing (create ... if not exists,
-- drop policy/trigger if exists + create, create or replace function). Contains
-- NO demo/seed data. Generated from supabase/migrations/ (excludes *seed*).
--
-- HOW TO USE: paste this whole file into the Supabase SQL editor and Run once.
--   Validated idempotent on Postgres 16 against BOTH a fresh DB and a
--   schema.sql-drifted DB. Adds missing tables AND missing columns on existing
--   tables before anything references them. No drops, no data loss.
-- =============================================================================
set check_function_bodies = off;


-- ---- column-drift reconciliation: add any missing column to existing
-- ---- tables BEFORE indexes/policies reference them (add column if not
-- ---- exists; no drops, no data loss). Generated from the target schema.
alter table if exists public.admin_notes add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.admin_notes add column if not exists author_id uuid;
alter table if exists public.admin_notes add column if not exists target_type text;
alter table if exists public.admin_notes add column if not exists target_id uuid;
alter table if exists public.admin_notes add column if not exists body text;
alter table if exists public.admin_notes add column if not exists internal boolean default true not null;
alter table if exists public.admin_notes add column if not exists pinned boolean default false not null;
alter table if exists public.admin_notes add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.admin_notes add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.admin_reviews add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.admin_reviews add column if not exists reviewer_id uuid;
alter table if exists public.admin_reviews add column if not exists campaign_id uuid;
alter table if exists public.admin_reviews add column if not exists user_id uuid;
alter table if exists public.admin_reviews add column if not exists review_type text;
alter table if exists public.admin_reviews add column if not exists status text default 'open'::text not null;
alter table if exists public.admin_reviews add column if not exists notes text;
alter table if exists public.admin_reviews add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.admin_reviews add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.admin_reviews add column if not exists action text;
alter table if exists public.ai_generations add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.ai_generations add column if not exists user_id uuid;
alter table if exists public.ai_generations add column if not exists campaign_id uuid;
alter table if exists public.ai_generations add column if not exists generation_type text;
alter table if exists public.ai_generations add column if not exists prompt jsonb;
alter table if exists public.ai_generations add column if not exists output jsonb;
alter table if exists public.ai_generations add column if not exists model text;
alter table if exists public.ai_generations add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.analytics_snapshots add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.analytics_snapshots add column if not exists owner_id uuid;
alter table if exists public.analytics_snapshots add column if not exists campaign_id uuid;
alter table if exists public.analytics_snapshots add column if not exists nonprofit_id uuid;
alter table if exists public.analytics_snapshots add column if not exists creator_profile_id uuid;
alter table if exists public.analytics_snapshots add column if not exists snapshot_date date default CURRENT_DATE not null;
alter table if exists public.analytics_snapshots add column if not exists metrics jsonb default '{}'::jsonb not null;
alter table if exists public.analytics_snapshots add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.api_keys add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.api_keys add column if not exists owner_id uuid;
alter table if exists public.api_keys add column if not exists name text;
alter table if exists public.api_keys add column if not exists key_hash text;
alter table if exists public.api_keys add column if not exists scopes text[] default '{}'::text[] not null;
alter table if exists public.api_keys add column if not exists last_used_at timestamp with time zone;
alter table if exists public.api_keys add column if not exists revoked_at timestamp with time zone;
alter table if exists public.api_keys add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.auction_bids add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.auction_bids add column if not exists item_id uuid;
alter table if exists public.auction_bids add column if not exists bidder_id uuid;
alter table if exists public.auction_bids add column if not exists amount_cents bigint;
alter table if exists public.auction_bids add column if not exists status text default 'active'::text not null;
alter table if exists public.auction_bids add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.auction_items add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.auction_items add column if not exists event_id uuid;
alter table if exists public.auction_items add column if not exists title text;
alter table if exists public.auction_items add column if not exists description text;
alter table if exists public.auction_items add column if not exists image_url text;
alter table if exists public.auction_items add column if not exists starting_bid_cents bigint;
alter table if exists public.auction_items add column if not exists current_bid_cents bigint default 0 not null;
alter table if exists public.auction_items add column if not exists closes_at timestamp with time zone;
alter table if exists public.auction_items add column if not exists status text default 'open'::text not null;
alter table if exists public.auction_items add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.auction_items add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.audit_logs add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.audit_logs add column if not exists actor_id uuid;
alter table if exists public.audit_logs add column if not exists action text;
alter table if exists public.audit_logs add column if not exists target_type text;
alter table if exists public.audit_logs add column if not exists target_id text;
alter table if exists public.audit_logs add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.audit_logs add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.beneficiary_invites add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.beneficiary_invites add column if not exists campaign_id uuid;
alter table if exists public.beneficiary_invites add column if not exists invited_by uuid;
alter table if exists public.beneficiary_invites add column if not exists email text;
alter table if exists public.beneficiary_invites add column if not exists token text default substr(md5(((random())::text || (clock_timestamp())::text)), 1, 32) not null;
alter table if exists public.beneficiary_invites add column if not exists accepted_at timestamp with time zone;
alter table if exists public.beneficiary_invites add column if not exists beneficiary_id uuid;
alter table if exists public.beneficiary_invites add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.beneficiary_invites add column if not exists expires_at timestamp with time zone default (now() + '7 days'::interval) not null;
alter table if exists public.business_leads add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.business_leads add column if not exists business_name text;
alter table if exists public.business_leads add column if not exists entity_type text;
alter table if exists public.business_leads add column if not exists state text;
alter table if exists public.business_leads add column if not exists filing_date date;
alter table if exists public.business_leads add column if not exists filing_status text;
alter table if exists public.business_leads add column if not exists registered_agent text;
alter table if exists public.business_leads add column if not exists owner_name text;
alter table if exists public.business_leads add column if not exists industry text;
alter table if exists public.business_leads add column if not exists address text;
alter table if exists public.business_leads add column if not exists source text default 'manual'::text not null;
alter table if exists public.business_leads add column if not exists source_ref text;
alter table if exists public.business_leads add column if not exists website text;
alter table if exists public.business_leads add column if not exists email text;
alter table if exists public.business_leads add column if not exists phone text;
alter table if exists public.business_leads add column if not exists enrichment_notes text;
alter table if exists public.business_leads add column if not exists enrichment_model text;
alter table if exists public.business_leads add column if not exists enriched_at timestamp with time zone;
alter table if exists public.business_leads add column if not exists lead_score integer default 0 not null;
alter table if exists public.business_leads add column if not exists lead_grade text;
alter table if exists public.business_leads add column if not exists score_breakdown jsonb default '{}'::jsonb not null;
alter table if exists public.business_leads add column if not exists status text default 'new'::text not null;
alter table if exists public.business_leads add column if not exists alerted boolean default false not null;
alter table if exists public.business_leads add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.business_leads add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.business_leads add column if not exists marketing_contact_id uuid;
alter table if exists public.campaign_analytics_events add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_analytics_events add column if not exists campaign_id uuid;
alter table if exists public.campaign_analytics_events add column if not exists event_type text;
alter table if exists public.campaign_analytics_events add column if not exists source text;
alter table if exists public.campaign_analytics_events add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_analytics_events add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_launch_settings add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_launch_settings add column if not exists campaign_id uuid;
alter table if exists public.campaign_launch_settings add column if not exists funding_model text default 'flexible'::text not null;
alter table if exists public.campaign_launch_settings add column if not exists launch_type text default 'fundraiser'::text not null;
alter table if exists public.campaign_launch_settings add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_launch_settings add column if not exists country text default 'US'::text not null;
alter table if exists public.campaign_launch_settings add column if not exists is_indemand boolean default false not null;
alter table if exists public.campaign_launch_settings add column if not exists product_stage text;
alter table if exists public.campaign_launch_settings add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_launch_settings add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_media add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_media add column if not exists campaign_id uuid;
alter table if exists public.campaign_media add column if not exists uploader_id uuid;
alter table if exists public.campaign_media add column if not exists media_type text;
alter table if exists public.campaign_media add column if not exists storage_path text;
alter table if exists public.campaign_media add column if not exists public_url text;
alter table if exists public.campaign_media add column if not exists reuse_risk_score integer default 0 not null;
alter table if exists public.campaign_media add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_owner_payouts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_owner_payouts add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_owner_payouts add column if not exists payout_id uuid;
alter table if exists public.campaign_owner_payouts add column if not exists campaign_id uuid;
alter table if exists public.campaign_owner_payouts add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_owner_payouts add column if not exists donor_id uuid;
alter table if exists public.campaign_owner_payouts add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_owner_payouts add column if not exists processor_account_id text;
alter table if exists public.campaign_owner_payouts add column if not exists processor_object_id text;
alter table if exists public.campaign_owner_payouts add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_owner_payouts add column if not exists owner_net_amount bigint default 0 not null;
alter table if exists public.campaign_owner_payouts add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_owner_payouts add column if not exists status text default 'pending'::text not null;
alter table if exists public.campaign_owner_payouts add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_owner_payouts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_owner_payouts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_owner_payouts add column if not exists created_by uuid;
alter table if exists public.campaign_owner_payouts add column if not exists updated_by uuid;
alter table if exists public.campaign_owner_payouts add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_owner_transfers add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_owner_transfers add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_owner_transfers add column if not exists campaign_id uuid;
alter table if exists public.campaign_owner_transfers add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_owner_transfers add column if not exists donor_id uuid;
alter table if exists public.campaign_owner_transfers add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_owner_transfers add column if not exists processor_account_id text;
alter table if exists public.campaign_owner_transfers add column if not exists processor_object_id text;
alter table if exists public.campaign_owner_transfers add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_owner_transfers add column if not exists owner_net_amount bigint default 0 not null;
alter table if exists public.campaign_owner_transfers add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_owner_transfers add column if not exists status text default 'pending'::text not null;
alter table if exists public.campaign_owner_transfers add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_owner_transfers add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_owner_transfers add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_owner_transfers add column if not exists created_by uuid;
alter table if exists public.campaign_owner_transfers add column if not exists updated_by uuid;
alter table if exists public.campaign_owner_transfers add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_admin_notes add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists author_id uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_admin_notes add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_admin_notes add column if not exists note text;
alter table if exists public.campaign_payment_admin_notes add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists status text default 'active'::text not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_admin_notes add column if not exists created_by uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_admin_notes add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_audit_logs add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists actor_id uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_audit_logs add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_audit_logs add column if not exists action text;
alter table if exists public.campaign_payment_audit_logs add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists status text default 'recorded'::text not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_audit_logs add column if not exists created_by uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_audit_logs add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_breakdowns add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_breakdowns add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_breakdowns add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_breakdowns add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_breakdowns add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_breakdowns add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists tip_amount bigint default 0 not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists processor_fee_amount bigint default 0 not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists platform_fee_amount bigint default 0 not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists owner_net_amount bigint default 0 not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists status text default 'current'::text not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_breakdowns add column if not exists created_by uuid;
alter table if exists public.campaign_payment_breakdowns add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_breakdowns add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_disputes add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_disputes add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_disputes add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_disputes add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_disputes add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_disputes add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_disputes add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_disputes add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_disputes add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_disputes add column if not exists dispute_amount bigint default 0 not null;
alter table if exists public.campaign_payment_disputes add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_disputes add column if not exists status text default 'opened'::text not null;
alter table if exists public.campaign_payment_disputes add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_disputes add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_disputes add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_disputes add column if not exists created_by uuid;
alter table if exists public.campaign_payment_disputes add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_disputes add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_events add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_events add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_events add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_events add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_events add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_events add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_events add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_events add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_events add column if not exists event_type text;
alter table if exists public.campaign_payment_events add column if not exists event_status text default 'received'::text not null;
alter table if exists public.campaign_payment_events add column if not exists amount bigint default 0 not null;
alter table if exists public.campaign_payment_events add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_events add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_events add column if not exists occurred_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_events add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_events add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_events add column if not exists created_by uuid;
alter table if exists public.campaign_payment_events add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_events add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_exports add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_exports add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_exports add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_exports add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_exports add column if not exists requested_by uuid;
alter table if exists public.campaign_payment_exports add column if not exists processor text default 'stripe'::text;
alter table if exists public.campaign_payment_exports add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_exports add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_exports add column if not exists export_type text;
alter table if exists public.campaign_payment_exports add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_exports add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_exports add column if not exists status text default 'requested'::text not null;
alter table if exists public.campaign_payment_exports add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_exports add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_exports add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_exports add column if not exists created_by uuid;
alter table if exists public.campaign_payment_exports add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_exports add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_reconciliation add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_reconciliation add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_reconciliation add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_reconciliation add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_reconciliation add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_reconciliation add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists processor_fee_amount bigint default 0 not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists platform_fee_amount bigint default 0 not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists owner_net_amount bigint default 0 not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists refunded_amount bigint default 0 not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists disputed_amount bigint default 0 not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists status text default 'pending_data'::text not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists issues text[] default '{}'::text[] not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists checked_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_reconciliation add column if not exists created_by uuid;
alter table if exists public.campaign_payment_reconciliation add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_reconciliation add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_refunds add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_refunds add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_refunds add column if not exists refund_id uuid;
alter table if exists public.campaign_payment_refunds add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_refunds add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_refunds add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_refunds add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_refunds add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_refunds add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_refunds add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_refunds add column if not exists refund_amount bigint default 0 not null;
alter table if exists public.campaign_payment_refunds add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_refunds add column if not exists status text default 'requested'::text not null;
alter table if exists public.campaign_payment_refunds add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_refunds add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_refunds add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_refunds add column if not exists created_by uuid;
alter table if exists public.campaign_payment_refunds add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_refunds add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_settings add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_settings add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_settings add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_settings add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_settings add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_settings add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_settings add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_settings add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_settings add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_settings add column if not exists status text default 'active'::text not null;
alter table if exists public.campaign_payment_settings add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_settings add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_settings add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_settings add column if not exists created_by uuid;
alter table if exists public.campaign_payment_settings add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_settings add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payment_webhook_events add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists webhook_event_id uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists campaign_id uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists donor_id uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists processor_account_id text;
alter table if exists public.campaign_payment_webhook_events add column if not exists processor_object_id text;
alter table if exists public.campaign_payment_webhook_events add column if not exists processor_event_id text;
alter table if exists public.campaign_payment_webhook_events add column if not exists event_type text;
alter table if exists public.campaign_payment_webhook_events add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists status text default 'received'::text not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists payload jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payment_webhook_events add column if not exists created_by uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists updated_by uuid;
alter table if exists public.campaign_payment_webhook_events add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_payments add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_payments add column if not exists donation_id uuid;
alter table if exists public.campaign_payments add column if not exists campaign_id uuid;
alter table if exists public.campaign_payments add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_payments add column if not exists donor_id uuid;
alter table if exists public.campaign_payments add column if not exists business_id uuid;
alter table if exists public.campaign_payments add column if not exists tenant_id uuid;
alter table if exists public.campaign_payments add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_payments add column if not exists processor_account_id text;
alter table if exists public.campaign_payments add column if not exists processor_charge_id text;
alter table if exists public.campaign_payments add column if not exists processor_payment_intent_id text;
alter table if exists public.campaign_payments add column if not exists processor_checkout_session_id text;
alter table if exists public.campaign_payments add column if not exists processor_transfer_id text;
alter table if exists public.campaign_payments add column if not exists processor_payout_id text;
alter table if exists public.campaign_payments add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists tip_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists platform_fee_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists processor_fee_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists campaign_owner_net_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists refunded_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists disputed_amount bigint default 0 not null;
alter table if exists public.campaign_payments add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_payments add column if not exists payment_status text default 'pending'::text not null;
alter table if exists public.campaign_payments add column if not exists transfer_status text default 'not_applicable'::text not null;
alter table if exists public.campaign_payments add column if not exists payout_status text default 'not_applicable'::text not null;
alter table if exists public.campaign_payments add column if not exists refund_status text default 'none'::text not null;
alter table if exists public.campaign_payments add column if not exists dispute_status text default 'none'::text not null;
alter table if exists public.campaign_payments add column if not exists settlement_status text default 'pending'::text not null;
alter table if exists public.campaign_payments add column if not exists reconciliation_status text default 'pending_data'::text not null;
alter table if exists public.campaign_payments add column if not exists reconciliation_reason text;
alter table if exists public.campaign_payments add column if not exists paid_at timestamp with time zone;
alter table if exists public.campaign_payments add column if not exists available_on timestamp with time zone;
alter table if exists public.campaign_payments add column if not exists payout_at timestamp with time zone;
alter table if exists public.campaign_payments add column if not exists last_webhook_event_id text;
alter table if exists public.campaign_payments add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_payments add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payments add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_payments add column if not exists created_by uuid;
alter table if exists public.campaign_payments add column if not exists updated_by uuid;
alter table if exists public.campaign_payments add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_platform_fees add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_platform_fees add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_platform_fees add column if not exists campaign_id uuid;
alter table if exists public.campaign_platform_fees add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_platform_fees add column if not exists donor_id uuid;
alter table if exists public.campaign_platform_fees add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_platform_fees add column if not exists processor_account_id text;
alter table if exists public.campaign_platform_fees add column if not exists processor_object_id text;
alter table if exists public.campaign_platform_fees add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_platform_fees add column if not exists platform_fee_amount bigint default 0 not null;
alter table if exists public.campaign_platform_fees add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_platform_fees add column if not exists status text default 'pending'::text not null;
alter table if exists public.campaign_platform_fees add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_platform_fees add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_platform_fees add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_platform_fees add column if not exists created_by uuid;
alter table if exists public.campaign_platform_fees add column if not exists updated_by uuid;
alter table if exists public.campaign_platform_fees add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_processor_fees add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_processor_fees add column if not exists campaign_payment_id uuid;
alter table if exists public.campaign_processor_fees add column if not exists campaign_id uuid;
alter table if exists public.campaign_processor_fees add column if not exists campaign_owner_id uuid;
alter table if exists public.campaign_processor_fees add column if not exists donor_id uuid;
alter table if exists public.campaign_processor_fees add column if not exists processor text default 'stripe'::text not null;
alter table if exists public.campaign_processor_fees add column if not exists processor_account_id text;
alter table if exists public.campaign_processor_fees add column if not exists processor_object_id text;
alter table if exists public.campaign_processor_fees add column if not exists gross_amount bigint default 0 not null;
alter table if exists public.campaign_processor_fees add column if not exists processor_fee_amount bigint default 0 not null;
alter table if exists public.campaign_processor_fees add column if not exists currency text default 'usd'::text not null;
alter table if exists public.campaign_processor_fees add column if not exists status text default 'pending'::text not null;
alter table if exists public.campaign_processor_fees add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_processor_fees add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_processor_fees add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_processor_fees add column if not exists created_by uuid;
alter table if exists public.campaign_processor_fees add column if not exists updated_by uuid;
alter table if exists public.campaign_processor_fees add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaign_reports add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_reports add column if not exists campaign_id uuid;
alter table if exists public.campaign_reports add column if not exists reporter_id uuid;
alter table if exists public.campaign_reports add column if not exists reason text;
alter table if exists public.campaign_reports add column if not exists details text;
alter table if exists public.campaign_reports add column if not exists status text default 'open'::text not null;
alter table if exists public.campaign_reports add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_reports add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaign_rewards add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_rewards add column if not exists campaign_id uuid;
alter table if exists public.campaign_rewards add column if not exists title text;
alter table if exists public.campaign_rewards add column if not exists description text;
alter table if exists public.campaign_rewards add column if not exists amount_cents bigint;
alter table if exists public.campaign_rewards add column if not exists estimated_delivery text;
alter table if exists public.campaign_rewards add column if not exists item_limit integer;
alter table if exists public.campaign_rewards add column if not exists claimed_count integer default 0 not null;
alter table if exists public.campaign_rewards add column if not exists sort_order integer default 0 not null;
alter table if exists public.campaign_rewards add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_status_log add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_status_log add column if not exists campaign_id uuid;
alter table if exists public.campaign_status_log add column if not exists changed_by uuid;
alter table if exists public.campaign_status_log add column if not exists from_status text;
alter table if exists public.campaign_status_log add column if not exists to_status text;
alter table if exists public.campaign_status_log add column if not exists reason text;
alter table if exists public.campaign_status_log add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.campaign_status_log add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaign_updates add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaign_updates add column if not exists campaign_id uuid;
alter table if exists public.campaign_updates add column if not exists user_id uuid;
alter table if exists public.campaign_updates add column if not exists title text;
alter table if exists public.campaign_updates add column if not exists body text;
alter table if exists public.campaign_updates add column if not exists ai_generated boolean default false not null;
alter table if exists public.campaign_updates add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaigns add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.campaigns add column if not exists user_id uuid;
alter table if exists public.campaigns add column if not exists beneficiary_profile_id uuid;
alter table if exists public.campaigns add column if not exists slug text;
alter table if exists public.campaigns add column if not exists title text;
alter table if exists public.campaigns add column if not exists tagline text;
alter table if exists public.campaigns add column if not exists description text;
alter table if exists public.campaigns add column if not exists category text;
alter table if exists public.campaigns add column if not exists goal_amount bigint;
alter table if exists public.campaigns add column if not exists raised_amount bigint default 0 not null;
alter table if exists public.campaigns add column if not exists backer_count integer default 0 not null;
alter table if exists public.campaigns add column if not exists deadline date;
alter table if exists public.campaigns add column if not exists status text default 'draft'::text not null;
alter table if exists public.campaigns add column if not exists beneficiary_name text;
alter table if exists public.campaigns add column if not exists beneficiary_relationship text;
alter table if exists public.campaigns add column if not exists cover_image_url text;
alter table if exists public.campaigns add column if not exists trust_status text default 'Needs More Info'::text not null;
alter table if exists public.campaigns add column if not exists campaign_health_score integer default 0 not null;
alter table if exists public.campaigns add column if not exists payout_frozen boolean default false not null;
alter table if exists public.campaigns add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.campaigns add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.campaigns add column if not exists image_urls text[] default '{}'::text[] not null;
alter table if exists public.campaigns add column if not exists featured boolean default false not null;
alter table if exists public.campaigns add column if not exists pinned boolean default false not null;
alter table if exists public.campaigns add column if not exists accept_donations boolean default true not null;
alter table if exists public.campaigns add column if not exists deleted_at timestamp with time zone;
alter table if exists public.campaigns add column if not exists visibility text default 'public'::text not null;
alter table if exists public.challenge_participants add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.challenge_participants add column if not exists challenge_id uuid;
alter table if exists public.challenge_participants add column if not exists user_id uuid;
alter table if exists public.challenge_participants add column if not exists progress_value bigint default 0 not null;
alter table if exists public.challenge_participants add column if not exists joined_at timestamp with time zone default now() not null;
alter table if exists public.challenge_participants add column if not exists completed_at timestamp with time zone;
alter table if exists public.challenges add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.challenges add column if not exists slug text;
alter table if exists public.challenges add column if not exists title text;
alter table if exists public.challenges add column if not exists description text;
alter table if exists public.challenges add column if not exists metric text default 'donation_count'::text not null;
alter table if exists public.challenges add column if not exists goal_value bigint;
alter table if exists public.challenges add column if not exists starts_at timestamp with time zone;
alter table if exists public.challenges add column if not exists ends_at timestamp with time zone;
alter table if exists public.challenges add column if not exists status text default 'active'::text not null;
alter table if exists public.challenges add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.challenges add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.commission_requests add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.commission_requests add column if not exists creator_profile_id uuid;
alter table if exists public.commission_requests add column if not exists requester_id uuid;
alter table if exists public.commission_requests add column if not exists requester_email text;
alter table if exists public.commission_requests add column if not exists title text;
alter table if exists public.commission_requests add column if not exists brief text;
alter table if exists public.commission_requests add column if not exists budget_cents bigint;
alter table if exists public.commission_requests add column if not exists status text default 'requested'::text not null;
alter table if exists public.commission_requests add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.commission_requests add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.connected_accounts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.connected_accounts add column if not exists user_id uuid;
alter table if exists public.connected_accounts add column if not exists stripe_account_id text;
alter table if exists public.connected_accounts add column if not exists charges_enabled boolean default false not null;
alter table if exists public.connected_accounts add column if not exists payouts_enabled boolean default false not null;
alter table if exists public.connected_accounts add column if not exists details_submitted boolean default false not null;
alter table if exists public.connected_accounts add column if not exists verification_status text default 'pending'::text not null;
alter table if exists public.connected_accounts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.connected_accounts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.contact_messages add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.contact_messages add column if not exists name text;
alter table if exists public.contact_messages add column if not exists email text;
alter table if exists public.contact_messages add column if not exists subject text;
alter table if exists public.contact_messages add column if not exists message text;
alter table if exists public.contact_messages add column if not exists status text default 'new'::text not null;
alter table if exists public.contact_messages add column if not exists source text default 'contact_page'::text not null;
alter table if exists public.contact_messages add column if not exists ip_hash text;
alter table if exists public.contact_messages add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.contact_messages add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.creator_profiles add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.creator_profiles add column if not exists user_id uuid;
alter table if exists public.creator_profiles add column if not exists handle text;
alter table if exists public.creator_profiles add column if not exists display_name text;
alter table if exists public.creator_profiles add column if not exists bio text;
alter table if exists public.creator_profiles add column if not exists hero_image_url text;
alter table if exists public.creator_profiles add column if not exists website_url text;
alter table if exists public.creator_profiles add column if not exists brand_color text default '#059669'::text;
alter table if exists public.creator_profiles add column if not exists accepts_tips boolean default true not null;
alter table if exists public.creator_profiles add column if not exists accepts_commissions boolean default false not null;
alter table if exists public.creator_profiles add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.creator_profiles add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.creator_tips add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.creator_tips add column if not exists creator_profile_id uuid;
alter table if exists public.creator_tips add column if not exists supporter_id uuid;
alter table if exists public.creator_tips add column if not exists amount_cents bigint;
alter table if exists public.creator_tips add column if not exists message text;
alter table if exists public.creator_tips add column if not exists stripe_payment_intent_id text;
alter table if exists public.creator_tips add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.digital_products add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.digital_products add column if not exists creator_profile_id uuid;
alter table if exists public.digital_products add column if not exists title text;
alter table if exists public.digital_products add column if not exists description text;
alter table if exists public.digital_products add column if not exists price_cents bigint;
alter table if exists public.digital_products add column if not exists storage_path text;
alter table if exists public.digital_products add column if not exists preview_url text;
alter table if exists public.digital_products add column if not exists active boolean default true not null;
alter table if exists public.digital_products add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.digital_products add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.direct_messages add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.direct_messages add column if not exists sender_id uuid;
alter table if exists public.direct_messages add column if not exists recipient_id uuid;
alter table if exists public.direct_messages add column if not exists campaign_id uuid;
alter table if exists public.direct_messages add column if not exists body text;
alter table if exists public.direct_messages add column if not exists read_at timestamp with time zone;
alter table if exists public.direct_messages add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donation_forms add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donation_forms add column if not exists nonprofit_id uuid;
alter table if exists public.donation_forms add column if not exists campaign_id uuid;
alter table if exists public.donation_forms add column if not exists title text;
alter table if exists public.donation_forms add column if not exists slug text;
alter table if exists public.donation_forms add column if not exists default_amounts_cents bigint[] default ARRAY[2500, 5000, 10000, 25000] not null;
alter table if exists public.donation_forms add column if not exists recurring_enabled boolean default true not null;
alter table if exists public.donation_forms add column if not exists currencies text[] default ARRAY['usd'::text] not null;
alter table if exists public.donation_forms add column if not exists embed_enabled boolean default true not null;
alter table if exists public.donation_forms add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donation_forms add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.donation_receipts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donation_receipts add column if not exists donation_id uuid;
alter table if exists public.donation_receipts add column if not exists donor_id uuid;
alter table if exists public.donation_receipts add column if not exists campaign_id uuid;
alter table if exists public.donation_receipts add column if not exists receipt_number text default ((('RCP-'::text || to_char(now(), 'YYYYMMDD'::text)) || '-'::text) || substr(md5((random())::text), 1, 8)) not null;
alter table if exists public.donation_receipts add column if not exists amount_cents bigint;
alter table if exists public.donation_receipts add column if not exists tip_cents bigint default 0 not null;
alter table if exists public.donation_receipts add column if not exists processing_fee_cents bigint default 0 not null;
alter table if exists public.donation_receipts add column if not exists currency text default 'usd'::text not null;
alter table if exists public.donation_receipts add column if not exists is_tax_deductible boolean default false not null;
alter table if exists public.donation_receipts add column if not exists nonprofit_ein text;
alter table if exists public.donation_receipts add column if not exists campaign_title text;
alter table if exists public.donation_receipts add column if not exists donor_name text;
alter table if exists public.donation_receipts add column if not exists donor_email text;
alter table if exists public.donation_receipts add column if not exists email_sent_at timestamp with time zone;
alter table if exists public.donation_receipts add column if not exists resent_at timestamp with time zone;
alter table if exists public.donation_receipts add column if not exists stripe_payment_intent_id text;
alter table if exists public.donation_receipts add column if not exists stripe_checkout_session_id text;
alter table if exists public.donation_receipts add column if not exists receipt_type text default 'donation'::text not null;
alter table if exists public.donation_receipts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donations add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donations add column if not exists campaign_id uuid;
alter table if exists public.donations add column if not exists donor_id uuid;
alter table if exists public.donations add column if not exists amount_cents bigint;
alter table if exists public.donations add column if not exists message text;
alter table if exists public.donations add column if not exists anonymous boolean default false not null;
alter table if exists public.donations add column if not exists stripe_payment_intent_id text;
alter table if exists public.donations add column if not exists status text default 'completed'::text not null;
alter table if exists public.donations add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donations add column if not exists payment_method text;
alter table if exists public.donations add column if not exists source text;
alter table if exists public.donations add column if not exists notes text;
alter table if exists public.donations add column if not exists is_spam boolean default false not null;
alter table if exists public.donations add column if not exists receipt_sent_at timestamp with time zone;
alter table if exists public.donations add column if not exists refunded_at timestamp with time zone;
alter table if exists public.donations add column if not exists refund_reason text;
alter table if exists public.donations add column if not exists updated_at timestamp with time zone;
alter table if exists public.donations add column if not exists source_utm jsonb default '{}'::jsonb not null;
alter table if exists public.donations add column if not exists reward_id uuid;
alter table if exists public.donations add column if not exists currency text default 'usd'::text not null;
alter table if exists public.donor_crm_contacts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donor_crm_contacts add column if not exists nonprofit_id uuid;
alter table if exists public.donor_crm_contacts add column if not exists owner_id uuid;
alter table if exists public.donor_crm_contacts add column if not exists email text;
alter table if exists public.donor_crm_contacts add column if not exists full_name text;
alter table if exists public.donor_crm_contacts add column if not exists phone text;
alter table if exists public.donor_crm_contacts add column if not exists tags text[] default '{}'::text[] not null;
alter table if exists public.donor_crm_contacts add column if not exists lifetime_value_cents bigint default 0 not null;
alter table if exists public.donor_crm_contacts add column if not exists last_donated_at timestamp with time zone;
alter table if exists public.donor_crm_contacts add column if not exists consent_email boolean default true not null;
alter table if exists public.donor_crm_contacts add column if not exists consent_sms boolean default false not null;
alter table if exists public.donor_crm_contacts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donor_crm_contacts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.donor_message_likes add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donor_message_likes add column if not exists donor_message_id uuid;
alter table if exists public.donor_message_likes add column if not exists user_id uuid;
alter table if exists public.donor_message_likes add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donor_messages add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donor_messages add column if not exists donation_id uuid;
alter table if exists public.donor_messages add column if not exists campaign_id uuid;
alter table if exists public.donor_messages add column if not exists donor_id uuid;
alter table if exists public.donor_messages add column if not exists message text;
alter table if exists public.donor_messages add column if not exists visibility text default 'public'::text not null;
alter table if exists public.donor_messages add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donor_segment_members add column if not exists segment_id uuid;
alter table if exists public.donor_segment_members add column if not exists contact_id uuid;
alter table if exists public.donor_segment_members add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donor_segments add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donor_segments add column if not exists nonprofit_id uuid;
alter table if exists public.donor_segments add column if not exists name text;
alter table if exists public.donor_segments add column if not exists rules jsonb default '{}'::jsonb not null;
alter table if exists public.donor_segments add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.donor_segments add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.donor_tips add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.donor_tips add column if not exists campaign_id uuid;
alter table if exists public.donor_tips add column if not exists donor_id uuid;
alter table if exists public.donor_tips add column if not exists amount_cents bigint;
alter table if exists public.donor_tips add column if not exists stripe_payment_intent_id text;
alter table if exists public.donor_tips add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.email_campaigns add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.email_campaigns add column if not exists owner_id uuid;
alter table if exists public.email_campaigns add column if not exists nonprofit_id uuid;
alter table if exists public.email_campaigns add column if not exists campaign_id uuid;
alter table if exists public.email_campaigns add column if not exists subject text;
alter table if exists public.email_campaigns add column if not exists body text;
alter table if exists public.email_campaigns add column if not exists status text default 'draft'::text not null;
alter table if exists public.email_campaigns add column if not exists scheduled_at timestamp with time zone;
alter table if exists public.email_campaigns add column if not exists sent_at timestamp with time zone;
alter table if exists public.email_campaigns add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.email_campaigns add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.embedded_buttons add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.embedded_buttons add column if not exists owner_id uuid;
alter table if exists public.embedded_buttons add column if not exists campaign_id uuid;
alter table if exists public.embedded_buttons add column if not exists creator_profile_id uuid;
alter table if exists public.embedded_buttons add column if not exists donation_form_id uuid;
alter table if exists public.embedded_buttons add column if not exists label text default 'Support CharitMe'::text not null;
alter table if exists public.embedded_buttons add column if not exists button_type text default 'donate'::text not null;
alter table if exists public.embedded_buttons add column if not exists config jsonb default '{}'::jsonb not null;
alter table if exists public.embedded_buttons add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.embedded_buttons add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.event_checkins add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.event_checkins add column if not exists registration_id uuid;
alter table if exists public.event_checkins add column if not exists event_id uuid;
alter table if exists public.event_checkins add column if not exists checked_in_by uuid;
alter table if exists public.event_checkins add column if not exists checked_in_at timestamp with time zone default now() not null;
alter table if exists public.event_registrations add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.event_registrations add column if not exists event_id uuid;
alter table if exists public.event_registrations add column if not exists ticket_id uuid;
alter table if exists public.event_registrations add column if not exists attendee_id uuid;
alter table if exists public.event_registrations add column if not exists attendee_email text;
alter table if exists public.event_registrations add column if not exists attendee_name text;
alter table if exists public.event_registrations add column if not exists quantity integer default 1 not null;
alter table if exists public.event_registrations add column if not exists amount_cents bigint default 0 not null;
alter table if exists public.event_registrations add column if not exists stripe_payment_intent_id text;
alter table if exists public.event_registrations add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.event_tickets add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.event_tickets add column if not exists event_id uuid;
alter table if exists public.event_tickets add column if not exists title text;
alter table if exists public.event_tickets add column if not exists price_cents bigint;
alter table if exists public.event_tickets add column if not exists quantity_limit integer;
alter table if exists public.event_tickets add column if not exists sold_count integer default 0 not null;
alter table if exists public.event_tickets add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.exclusive_posts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.exclusive_posts add column if not exists creator_profile_id uuid;
alter table if exists public.exclusive_posts add column if not exists nonprofit_id uuid;
alter table if exists public.exclusive_posts add column if not exists author_id uuid;
alter table if exists public.exclusive_posts add column if not exists title text;
alter table if exists public.exclusive_posts add column if not exists body text;
alter table if exists public.exclusive_posts add column if not exists visibility text default 'members'::text not null;
alter table if exists public.exclusive_posts add column if not exists minimum_tier_id uuid;
alter table if exists public.exclusive_posts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.exclusive_posts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.fundraising_events add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.fundraising_events add column if not exists nonprofit_id uuid;
alter table if exists public.fundraising_events add column if not exists campaign_id uuid;
alter table if exists public.fundraising_events add column if not exists title text;
alter table if exists public.fundraising_events add column if not exists slug text;
alter table if exists public.fundraising_events add column if not exists event_type text default 'fundraiser'::text not null;
alter table if exists public.fundraising_events add column if not exists starts_at timestamp with time zone;
alter table if exists public.fundraising_events add column if not exists ends_at timestamp with time zone;
alter table if exists public.fundraising_events add column if not exists location text;
alter table if exists public.fundraising_events add column if not exists virtual_url text;
alter table if exists public.fundraising_events add column if not exists status text default 'draft'::text not null;
alter table if exists public.fundraising_events add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.fundraising_events add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.fundraising_events add column if not exists created_by uuid;
alter table if exists public.fundraising_events add column if not exists description text;
alter table if exists public.fundraising_events add column if not exists capacity integer;
alter table if exists public.fundraising_events add column if not exists cover_image_url text;
alter table if exists public.giving_days add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.giving_days add column if not exists nonprofit_id uuid;
alter table if exists public.giving_days add column if not exists title text;
alter table if exists public.giving_days add column if not exists slug text;
alter table if exists public.giving_days add column if not exists starts_at timestamp with time zone;
alter table if exists public.giving_days add column if not exists ends_at timestamp with time zone;
alter table if exists public.giving_days add column if not exists goal_amount bigint;
alter table if exists public.giving_days add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.giving_days add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.grant_applications add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.grant_applications add column if not exists grant_id uuid;
alter table if exists public.grant_applications add column if not exists applicant_user_id uuid;
alter table if exists public.grant_applications add column if not exists campaign_id uuid;
alter table if exists public.grant_applications add column if not exists organization_name text;
alter table if exists public.grant_applications add column if not exists status text default 'draft'::text not null;
alter table if exists public.grant_applications add column if not exists amount_requested bigint;
alter table if exists public.grant_applications add column if not exists narrative text;
alter table if exists public.grant_applications add column if not exists answers jsonb default '{}'::jsonb not null;
alter table if exists public.grant_applications add column if not exists submitted_at timestamp with time zone;
alter table if exists public.grant_applications add column if not exists decision_at timestamp with time zone;
alter table if exists public.grant_applications add column if not exists award_amount bigint;
alter table if exists public.grant_applications add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.grant_applications add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.grant_applications add column if not exists deleted_at timestamp with time zone;
alter table if exists public.grant_deadlines add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.grant_deadlines add column if not exists grant_id uuid;
alter table if exists public.grant_deadlines add column if not exists label text;
alter table if exists public.grant_deadlines add column if not exists kind text default 'application'::text not null;
alter table if exists public.grant_deadlines add column if not exists due_at timestamp with time zone;
alter table if exists public.grant_deadlines add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.grant_documents add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.grant_documents add column if not exists application_id uuid;
alter table if exists public.grant_documents add column if not exists uploaded_by uuid;
alter table if exists public.grant_documents add column if not exists file_url text;
alter table if exists public.grant_documents add column if not exists file_name text;
alter table if exists public.grant_documents add column if not exists doc_type text;
alter table if exists public.grant_documents add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.grant_matches add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.grant_matches add column if not exists grant_id uuid;
alter table if exists public.grant_matches add column if not exists user_id uuid;
alter table if exists public.grant_matches add column if not exists campaign_id uuid;
alter table if exists public.grant_matches add column if not exists score numeric(5,2) default 0 not null;
alter table if exists public.grant_matches add column if not exists reasons jsonb default '[]'::jsonb not null;
alter table if exists public.grant_matches add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.grants add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.grants add column if not exists slug text;
alter table if exists public.grants add column if not exists title text;
alter table if exists public.grants add column if not exists funder_name text;
alter table if exists public.grants add column if not exists funder_type text default 'foundation'::text not null;
alter table if exists public.grants add column if not exists summary text;
alter table if exists public.grants add column if not exists description text;
alter table if exists public.grants add column if not exists category text;
alter table if exists public.grants add column if not exists focus_areas text[] default '{}'::text[] not null;
alter table if exists public.grants add column if not exists eligibility text;
alter table if exists public.grants add column if not exists eligible_entity_types text[] default '{}'::text[] not null;
alter table if exists public.grants add column if not exists amount_min bigint;
alter table if exists public.grants add column if not exists amount_max bigint;
alter table if exists public.grants add column if not exists currency text default 'USD'::text not null;
alter table if exists public.grants add column if not exists location text;
alter table if exists public.grants add column if not exists country text;
alter table if exists public.grants add column if not exists application_url text;
alter table if exists public.grants add column if not exists deadline_at timestamp with time zone;
alter table if exists public.grants add column if not exists rolling_deadline boolean default false not null;
alter table if exists public.grants add column if not exists status text default 'open'::text not null;
alter table if exists public.grants add column if not exists source text;
alter table if exists public.grants add column if not exists created_by uuid;
alter table if exists public.grants add column if not exists verified boolean default false not null;
alter table if exists public.grants add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.grants add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.grants add column if not exists deleted_at timestamp with time zone;
alter table if exists public.impact_evidence add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.impact_evidence add column if not exists update_id uuid;
alter table if exists public.impact_evidence add column if not exists kind text default 'image'::text not null;
alter table if exists public.impact_evidence add column if not exists url text;
alter table if exists public.impact_evidence add column if not exists caption text;
alter table if exists public.impact_evidence add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.impact_metrics add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.impact_metrics add column if not exists campaign_id uuid;
alter table if exists public.impact_metrics add column if not exists label text;
alter table if exists public.impact_metrics add column if not exists unit text;
alter table if exists public.impact_metrics add column if not exists target_value numeric;
alter table if exists public.impact_metrics add column if not exists current_value numeric default 0 not null;
alter table if exists public.impact_metrics add column if not exists sort integer default 0 not null;
alter table if exists public.impact_metrics add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.impact_metrics add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.impact_plan_items add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.impact_plan_items add column if not exists plan_id uuid;
alter table if exists public.impact_plan_items add column if not exists label text;
alter table if exists public.impact_plan_items add column if not exists category text;
alter table if exists public.impact_plan_items add column if not exists planned_amount_cents bigint default 0 not null;
alter table if exists public.impact_plan_items add column if not exists spent_amount_cents bigint default 0 not null;
alter table if exists public.impact_plan_items add column if not exists sort integer default 0 not null;
alter table if exists public.impact_plan_items add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.impact_plans add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.impact_plans add column if not exists campaign_id uuid;
alter table if exists public.impact_plans add column if not exists created_by uuid;
alter table if exists public.impact_plans add column if not exists title text default 'Impact Plan'::text not null;
alter table if exists public.impact_plans add column if not exists summary text;
alter table if exists public.impact_plans add column if not exists total_budget_cents bigint default 0 not null;
alter table if exists public.impact_plans add column if not exists status text default 'draft'::text not null;
alter table if exists public.impact_plans add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.impact_plans add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.impact_updates add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.impact_updates add column if not exists campaign_id uuid;
alter table if exists public.impact_updates add column if not exists author_id uuid;
alter table if exists public.impact_updates add column if not exists title text;
alter table if exists public.impact_updates add column if not exists body text;
alter table if exists public.impact_updates add column if not exists amount_spent_cents bigint;
alter table if exists public.impact_updates add column if not exists status text default 'published'::text not null;
alter table if exists public.impact_updates add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.impact_updates add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.integration_connections add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.integration_connections add column if not exists owner_id uuid;
alter table if exists public.integration_connections add column if not exists provider text;
alter table if exists public.integration_connections add column if not exists status text default 'connected'::text not null;
alter table if exists public.integration_connections add column if not exists config jsonb default '{}'::jsonb not null;
alter table if exists public.integration_connections add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.integration_connections add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.lead_outreach add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.lead_outreach add column if not exists business_lead_id uuid;
alter table if exists public.lead_outreach add column if not exists marketing_contact_id uuid;
alter table if exists public.lead_outreach add column if not exists utm_link_id uuid;
alter table if exists public.lead_outreach add column if not exists short_code text;
alter table if exists public.lead_outreach add column if not exists channel text default 'email'::text not null;
alter table if exists public.lead_outreach add column if not exists subject text;
alter table if exists public.lead_outreach add column if not exists body text;
alter table if exists public.lead_outreach add column if not exists email text;
alter table if exists public.lead_outreach add column if not exists email_valid boolean;
alter table if exists public.lead_outreach add column if not exists email_validation jsonb default '{}'::jsonb not null;
alter table if exists public.lead_outreach add column if not exists email_validated_at timestamp with time zone;
alter table if exists public.lead_outreach add column if not exists status text default 'drafted'::text not null;
alter table if exists public.lead_outreach add column if not exists sent_at timestamp with time zone;
alter table if exists public.lead_outreach add column if not exists first_click_at timestamp with time zone;
alter table if exists public.lead_outreach add column if not exists last_click_at timestamp with time zone;
alter table if exists public.lead_outreach add column if not exists click_count integer default 0 not null;
alter table if exists public.lead_outreach add column if not exists created_by uuid;
alter table if exists public.lead_outreach add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.lead_outreach add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.ledger_entries add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.ledger_entries add column if not exists entry_group_id uuid;
alter table if exists public.ledger_entries add column if not exists account text;
alter table if exists public.ledger_entries add column if not exists direction text;
alter table if exists public.ledger_entries add column if not exists amount_cents bigint;
alter table if exists public.ledger_entries add column if not exists currency text default 'usd'::text not null;
alter table if exists public.ledger_entries add column if not exists event_type text;
alter table if exists public.ledger_entries add column if not exists campaign_id uuid;
alter table if exists public.ledger_entries add column if not exists donation_id uuid;
alter table if exists public.ledger_entries add column if not exists recipient_user_id uuid;
alter table if exists public.ledger_entries add column if not exists connected_account_id text;
alter table if exists public.ledger_entries add column if not exists stripe_payment_intent_id text;
alter table if exists public.ledger_entries add column if not exists stripe_charge_id text;
alter table if exists public.ledger_entries add column if not exists stripe_application_fee_id text;
alter table if exists public.ledger_entries add column if not exists stripe_balance_transaction_id text;
alter table if exists public.ledger_entries add column if not exists stripe_refund_id text;
alter table if exists public.ledger_entries add column if not exists stripe_dispute_id text;
alter table if exists public.ledger_entries add column if not exists stripe_transfer_id text;
alter table if exists public.ledger_entries add column if not exists stripe_payout_id text;
alter table if exists public.ledger_entries add column if not exists idempotency_key text;
alter table if exists public.ledger_entries add column if not exists correlation_id text;
alter table if exists public.ledger_entries add column if not exists source text default 'system'::text not null;
alter table if exists public.ledger_entries add column if not exists occurred_at timestamp with time zone default now() not null;
alter table if exists public.ledger_entries add column if not exists effective_at timestamp with time zone default now() not null;
alter table if exists public.ledger_entries add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.livestreams add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.livestreams add column if not exists event_id uuid;
alter table if exists public.livestreams add column if not exists campaign_id uuid;
alter table if exists public.livestreams add column if not exists title text;
alter table if exists public.livestreams add column if not exists stream_url text;
alter table if exists public.livestreams add column if not exists starts_at timestamp with time zone;
alter table if exists public.livestreams add column if not exists status text default 'scheduled'::text not null;
alter table if exists public.livestreams add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.livestreams add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_audit_logs add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_audit_logs add column if not exists actor_id uuid;
alter table if exists public.marketing_audit_logs add column if not exists action text;
alter table if exists public.marketing_audit_logs add column if not exists entity text;
alter table if exists public.marketing_audit_logs add column if not exists entity_id uuid;
alter table if exists public.marketing_audit_logs add column if not exists detail jsonb default '{}'::jsonb not null;
alter table if exists public.marketing_audit_logs add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_automation_runs add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_automation_runs add column if not exists automation_id uuid;
alter table if exists public.marketing_automation_runs add column if not exists contact_id uuid;
alter table if exists public.marketing_automation_runs add column if not exists status text default 'success'::text not null;
alter table if exists public.marketing_automation_runs add column if not exists detail text;
alter table if exists public.marketing_automation_runs add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_automations add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_automations add column if not exists name text;
alter table if exists public.marketing_automations add column if not exists trigger_event text;
alter table if exists public.marketing_automations add column if not exists trigger_config jsonb default '{}'::jsonb not null;
alter table if exists public.marketing_automations add column if not exists action_type text;
alter table if exists public.marketing_automations add column if not exists action_config jsonb default '{}'::jsonb not null;
alter table if exists public.marketing_automations add column if not exists enabled boolean default false not null;
alter table if exists public.marketing_automations add column if not exists run_count integer default 0 not null;
alter table if exists public.marketing_automations add column if not exists last_run_at timestamp with time zone;
alter table if exists public.marketing_automations add column if not exists created_by uuid;
alter table if exists public.marketing_automations add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_automations add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_campaign_recipients add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_campaign_recipients add column if not exists campaign_id uuid;
alter table if exists public.marketing_campaign_recipients add column if not exists contact_id uuid;
alter table if exists public.marketing_campaign_recipients add column if not exists status text default 'pending'::text not null;
alter table if exists public.marketing_campaign_recipients add column if not exists sent_at timestamp with time zone;
alter table if exists public.marketing_campaign_recipients add column if not exists opened_at timestamp with time zone;
alter table if exists public.marketing_campaign_recipients add column if not exists clicked_at timestamp with time zone;
alter table if exists public.marketing_campaign_recipients add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_campaigns add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_campaigns add column if not exists name text;
alter table if exists public.marketing_campaigns add column if not exists campaign_type text default 'email'::text not null;
alter table if exists public.marketing_campaigns add column if not exists goal text;
alter table if exists public.marketing_campaigns add column if not exists segment_id uuid;
alter table if exists public.marketing_campaigns add column if not exists template_id uuid;
alter table if exists public.marketing_campaigns add column if not exists subject text;
alter table if exists public.marketing_campaigns add column if not exists preview_text text;
alter table if exists public.marketing_campaigns add column if not exists body text;
alter table if exists public.marketing_campaigns add column if not exists status text default 'draft'::text not null;
alter table if exists public.marketing_campaigns add column if not exists scheduled_at timestamp with time zone;
alter table if exists public.marketing_campaigns add column if not exists sent_at timestamp with time zone;
alter table if exists public.marketing_campaigns add column if not exists sent_count integer default 0 not null;
alter table if exists public.marketing_campaigns add column if not exists open_count integer default 0 not null;
alter table if exists public.marketing_campaigns add column if not exists click_count integer default 0 not null;
alter table if exists public.marketing_campaigns add column if not exists conversion_count integer default 0 not null;
alter table if exists public.marketing_campaigns add column if not exists revenue_cents bigint default 0 not null;
alter table if exists public.marketing_campaigns add column if not exists created_by uuid;
alter table if exists public.marketing_campaigns add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_campaigns add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_consent add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_consent add column if not exists contact_id uuid;
alter table if exists public.marketing_consent add column if not exists channel text;
alter table if exists public.marketing_consent add column if not exists granted boolean;
alter table if exists public.marketing_consent add column if not exists source text;
alter table if exists public.marketing_consent add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_contacts add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_contacts add column if not exists user_id uuid;
alter table if exists public.marketing_contacts add column if not exists email text;
alter table if exists public.marketing_contacts add column if not exists phone text;
alter table if exists public.marketing_contacts add column if not exists first_name text;
alter table if exists public.marketing_contacts add column if not exists last_name text;
alter table if exists public.marketing_contacts add column if not exists client_type text default 'visitor'::text not null;
alter table if exists public.marketing_contacts add column if not exists lifecycle_stage text default 'subscriber'::text not null;
alter table if exists public.marketing_contacts add column if not exists country text;
alter table if exists public.marketing_contacts add column if not exists region text;
alter table if exists public.marketing_contacts add column if not exists preferred_causes text[] default '{}'::text[];
alter table if exists public.marketing_contacts add column if not exists preferred_channel text default 'email'::text;
alter table if exists public.marketing_contacts add column if not exists first_touch_source text;
alter table if exists public.marketing_contacts add column if not exists first_touch_medium text;
alter table if exists public.marketing_contacts add column if not exists first_touch_campaign text;
alter table if exists public.marketing_contacts add column if not exists last_touch_source text;
alter table if exists public.marketing_contacts add column if not exists last_touch_medium text;
alter table if exists public.marketing_contacts add column if not exists last_touch_campaign text;
alter table if exists public.marketing_contacts add column if not exists landing_page text;
alter table if exists public.marketing_contacts add column if not exists lead_score integer default 0 not null;
alter table if exists public.marketing_contacts add column if not exists engagement_score integer default 0 not null;
alter table if exists public.marketing_contacts add column if not exists donor_value_cents bigint default 0 not null;
alter table if exists public.marketing_contacts add column if not exists donation_count integer default 0 not null;
alter table if exists public.marketing_contacts add column if not exists churn_risk text default 'unknown'::text;
alter table if exists public.marketing_contacts add column if not exists last_active_at timestamp with time zone;
alter table if exists public.marketing_contacts add column if not exists status text default 'active'::text not null;
alter table if exists public.marketing_contacts add column if not exists created_by uuid;
alter table if exists public.marketing_contacts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_contacts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_email_templates add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_email_templates add column if not exists name text;
alter table if exists public.marketing_email_templates add column if not exists category text default 'general'::text not null;
alter table if exists public.marketing_email_templates add column if not exists subject text default ''::text not null;
alter table if exists public.marketing_email_templates add column if not exists preview_text text;
alter table if exists public.marketing_email_templates add column if not exists body text default ''::text not null;
alter table if exists public.marketing_email_templates add column if not exists variables text[] default '{first_name,campaign_title,donation_amount}'::text[];
alter table if exists public.marketing_email_templates add column if not exists is_system boolean default false not null;
alter table if exists public.marketing_email_templates add column if not exists created_by uuid;
alter table if exists public.marketing_email_templates add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_email_templates add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_events add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_events add column if not exists contact_id uuid;
alter table if exists public.marketing_events add column if not exists event_type text;
alter table if exists public.marketing_events add column if not exists campaign_id uuid;
alter table if exists public.marketing_events add column if not exists marketing_campaign_id uuid;
alter table if exists public.marketing_events add column if not exists amount_cents bigint;
alter table if exists public.marketing_events add column if not exists utm_source text;
alter table if exists public.marketing_events add column if not exists utm_medium text;
alter table if exists public.marketing_events add column if not exists utm_campaign text;
alter table if exists public.marketing_events add column if not exists utm_term text;
alter table if exists public.marketing_events add column if not exists utm_content text;
alter table if exists public.marketing_events add column if not exists url text;
alter table if exists public.marketing_events add column if not exists device text;
alter table if exists public.marketing_events add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.marketing_events add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_form_submissions add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_form_submissions add column if not exists form_id uuid;
alter table if exists public.marketing_form_submissions add column if not exists contact_id uuid;
alter table if exists public.marketing_form_submissions add column if not exists data jsonb default '{}'::jsonb not null;
alter table if exists public.marketing_form_submissions add column if not exists url text;
alter table if exists public.marketing_form_submissions add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_forms add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_forms add column if not exists name text;
alter table if exists public.marketing_forms add column if not exists form_type text default 'lead'::text not null;
alter table if exists public.marketing_forms add column if not exists fields jsonb default '["email"]'::jsonb not null;
alter table if exists public.marketing_forms add column if not exists status text default 'active'::text not null;
alter table if exists public.marketing_forms add column if not exists submission_count integer default 0 not null;
alter table if exists public.marketing_forms add column if not exists created_by uuid;
alter table if exists public.marketing_forms add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_forms add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_identities add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_identities add column if not exists contact_id uuid;
alter table if exists public.marketing_identities add column if not exists kind text;
alter table if exists public.marketing_identities add column if not exists value text;
alter table if exists public.marketing_identities add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_referrals add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_referrals add column if not exists referrer_contact_id uuid;
alter table if exists public.marketing_referrals add column if not exists code text;
alter table if exists public.marketing_referrals add column if not exists kind text default 'donor'::text not null;
alter table if exists public.marketing_referrals add column if not exists click_count integer default 0 not null;
alter table if exists public.marketing_referrals add column if not exists signup_count integer default 0 not null;
alter table if exists public.marketing_referrals add column if not exists donation_count integer default 0 not null;
alter table if exists public.marketing_referrals add column if not exists revenue_cents bigint default 0 not null;
alter table if exists public.marketing_referrals add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_segment_members add column if not exists segment_id uuid;
alter table if exists public.marketing_segment_members add column if not exists contact_id uuid;
alter table if exists public.marketing_segment_members add column if not exists added_at timestamp with time zone default now() not null;
alter table if exists public.marketing_segments add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_segments add column if not exists name text;
alter table if exists public.marketing_segments add column if not exists description text;
alter table if exists public.marketing_segments add column if not exists rules jsonb default '{"logic": "and", "conditions": []}'::jsonb not null;
alter table if exists public.marketing_segments add column if not exists is_system boolean default false not null;
alter table if exists public.marketing_segments add column if not exists member_count integer default 0 not null;
alter table if exists public.marketing_segments add column if not exists created_by uuid;
alter table if exists public.marketing_segments add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_segments add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.marketing_suppression_list add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_suppression_list add column if not exists email text;
alter table if exists public.marketing_suppression_list add column if not exists phone text;
alter table if exists public.marketing_suppression_list add column if not exists reason text default 'unsubscribed'::text not null;
alter table if exists public.marketing_suppression_list add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_utm_links add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.marketing_utm_links add column if not exists name text;
alter table if exists public.marketing_utm_links add column if not exists destination_url text;
alter table if exists public.marketing_utm_links add column if not exists utm_source text;
alter table if exists public.marketing_utm_links add column if not exists utm_medium text;
alter table if exists public.marketing_utm_links add column if not exists utm_campaign text;
alter table if exists public.marketing_utm_links add column if not exists utm_term text;
alter table if exists public.marketing_utm_links add column if not exists utm_content text;
alter table if exists public.marketing_utm_links add column if not exists short_code text;
alter table if exists public.marketing_utm_links add column if not exists click_count integer default 0 not null;
alter table if exists public.marketing_utm_links add column if not exists conversion_count integer default 0 not null;
alter table if exists public.marketing_utm_links add column if not exists revenue_cents bigint default 0 not null;
alter table if exists public.marketing_utm_links add column if not exists created_by uuid;
alter table if exists public.marketing_utm_links add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.marketing_utm_links add column if not exists campaign_id uuid;
alter table if exists public.matching_claims add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.matching_claims add column if not exists program_id uuid;
alter table if exists public.matching_claims add column if not exists employee_id uuid;
alter table if exists public.matching_claims add column if not exists campaign_id uuid;
alter table if exists public.matching_claims add column if not exists donation_id uuid;
alter table if exists public.matching_claims add column if not exists donation_amount_cents bigint;
alter table if exists public.matching_claims add column if not exists match_amount_cents bigint default 0 not null;
alter table if exists public.matching_claims add column if not exists status text default 'pending'::text not null;
alter table if exists public.matching_claims add column if not exists note text;
alter table if exists public.matching_claims add column if not exists reviewer_id uuid;
alter table if exists public.matching_claims add column if not exists resolved_at timestamp with time zone;
alter table if exists public.matching_claims add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.matching_claims add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.matching_programs add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.matching_programs add column if not exists sponsor_id uuid;
alter table if exists public.matching_programs add column if not exists company_name text;
alter table if exists public.matching_programs add column if not exists description text;
alter table if exists public.matching_programs add column if not exists match_ratio numeric(6,2) default 1.0 not null;
alter table if exists public.matching_programs add column if not exists annual_cap_cents bigint default 0 not null;
alter table if exists public.matching_programs add column if not exists min_donation_cents bigint default 0 not null;
alter table if exists public.matching_programs add column if not exists categories text[] default '{}'::text[] not null;
alter table if exists public.matching_programs add column if not exists currency text default 'USD'::text not null;
alter table if exists public.matching_programs add column if not exists status text default 'active'::text not null;
alter table if exists public.matching_programs add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.matching_programs add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.member_subscriptions add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.member_subscriptions add column if not exists tier_id uuid;
alter table if exists public.member_subscriptions add column if not exists member_id uuid;
alter table if exists public.member_subscriptions add column if not exists status text default 'active'::text not null;
alter table if exists public.member_subscriptions add column if not exists stripe_subscription_id text;
alter table if exists public.member_subscriptions add column if not exists current_period_end timestamp with time zone;
alter table if exists public.member_subscriptions add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.member_subscriptions add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.membership_tiers add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.membership_tiers add column if not exists creator_profile_id uuid;
alter table if exists public.membership_tiers add column if not exists nonprofit_id uuid;
alter table if exists public.membership_tiers add column if not exists title text;
alter table if exists public.membership_tiers add column if not exists description text;
alter table if exists public.membership_tiers add column if not exists amount_cents bigint;
alter table if exists public.membership_tiers add column if not exists "interval" text default 'month'::text not null;
alter table if exists public.membership_tiers add column if not exists benefits text[] default '{}'::text[] not null;
alter table if exists public.membership_tiers add column if not exists active boolean default true not null;
alter table if exists public.membership_tiers add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.membership_tiers add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.message_thread_state add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.message_thread_state add column if not exists owner_id uuid;
alter table if exists public.message_thread_state add column if not exists donor_id uuid;
alter table if exists public.message_thread_state add column if not exists archived boolean default false not null;
alter table if exists public.message_thread_state add column if not exists last_read_at timestamp with time zone;
alter table if exists public.message_thread_state add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.nonprofit_profiles add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.nonprofit_profiles add column if not exists owner_id uuid;
alter table if exists public.nonprofit_profiles add column if not exists name text;
alter table if exists public.nonprofit_profiles add column if not exists slug text;
alter table if exists public.nonprofit_profiles add column if not exists mission text;
alter table if exists public.nonprofit_profiles add column if not exists tax_id text;
alter table if exists public.nonprofit_profiles add column if not exists website_url text;
alter table if exists public.nonprofit_profiles add column if not exists verified boolean default false not null;
alter table if exists public.nonprofit_profiles add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.nonprofit_profiles add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.nonprofit_profiles add column if not exists verification_status text default 'unverified'::text not null;
alter table if exists public.nonprofit_profiles add column if not exists tax_receipt_enabled boolean default false not null;
alter table if exists public.nonprofit_profiles add column if not exists country text default 'US'::text not null;
alter table if exists public.nonprofit_profiles add column if not exists address text;
alter table if exists public.nonprofit_profiles add column if not exists public_profile_enabled boolean default true not null;
alter table if exists public.notifications add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.notifications add column if not exists user_id uuid;
alter table if exists public.notifications add column if not exists kind text;
alter table if exists public.notifications add column if not exists title text;
alter table if exists public.notifications add column if not exists body text;
alter table if exists public.notifications add column if not exists link text;
alter table if exists public.notifications add column if not exists read_at timestamp with time zone;
alter table if exists public.notifications add column if not exists meta jsonb default '{}'::jsonb not null;
alter table if exists public.notifications add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.organizer_sends add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.organizer_sends add column if not exists campaign_id uuid;
alter table if exists public.organizer_sends add column if not exists organizer_id uuid;
alter table if exists public.organizer_sends add column if not exists template_key text;
alter table if exists public.organizer_sends add column if not exists target_group text;
alter table if exists public.organizer_sends add column if not exists subject text;
alter table if exists public.organizer_sends add column if not exists body text;
alter table if exists public.organizer_sends add column if not exists recipient_count integer default 0 not null;
alter table if exists public.organizer_sends add column if not exists sent_count integer default 0 not null;
alter table if exists public.organizer_sends add column if not exists suppressed_count integer default 0 not null;
alter table if exists public.organizer_sends add column if not exists status text default 'sent'::text not null;
alter table if exists public.organizer_sends add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.outbound_webhook_endpoints add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.outbound_webhook_endpoints add column if not exists owner_id uuid;
alter table if exists public.outbound_webhook_endpoints add column if not exists url text;
alter table if exists public.outbound_webhook_endpoints add column if not exists events text[] default '{}'::text[] not null;
alter table if exists public.outbound_webhook_endpoints add column if not exists secret_hash text;
alter table if exists public.outbound_webhook_endpoints add column if not exists active boolean default true not null;
alter table if exists public.outbound_webhook_endpoints add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.outbound_webhook_endpoints add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.payment_processors add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.payment_processors add column if not exists processor text;
alter table if exists public.payment_processors add column if not exists display_name text;
alter table if exists public.payment_processors add column if not exists status text default 'disabled'::text not null;
alter table if exists public.payment_processors add column if not exists dashboard_url text;
alter table if exists public.payment_processors add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.payment_processors add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.payment_processors add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.payment_processors add column if not exists created_by uuid;
alter table if exists public.payment_processors add column if not exists updated_by uuid;
alter table if exists public.payment_processors add column if not exists deleted_at timestamp with time zone;
alter table if exists public.payouts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.payouts add column if not exists campaign_id uuid;
alter table if exists public.payouts add column if not exists user_id uuid;
alter table if exists public.payouts add column if not exists connected_account_id uuid;
alter table if exists public.payouts add column if not exists amount_cents bigint;
alter table if exists public.payouts add column if not exists payout_speed text;
alter table if exists public.payouts add column if not exists fee_cents bigint default 0 not null;
alter table if exists public.payouts add column if not exists status text default 'requested'::text not null;
alter table if exists public.payouts add column if not exists risk_score integer default 0 not null;
alter table if exists public.payouts add column if not exists stripe_payout_id text;
alter table if exists public.payouts add column if not exists admin_note text;
alter table if exists public.payouts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.payouts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.payouts add column if not exists note text;
alter table if exists public.payouts add column if not exists stripe_transfer_id text;
alter table if exists public.peer_fundraisers add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.peer_fundraisers add column if not exists parent_campaign_id uuid;
alter table if exists public.peer_fundraisers add column if not exists fundraiser_id uuid;
alter table if exists public.peer_fundraisers add column if not exists slug text;
alter table if exists public.peer_fundraisers add column if not exists title text;
alter table if exists public.peer_fundraisers add column if not exists goal_amount bigint;
alter table if exists public.peer_fundraisers add column if not exists raised_amount bigint default 0 not null;
alter table if exists public.peer_fundraisers add column if not exists status text default 'active'::text not null;
alter table if exists public.peer_fundraisers add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.peer_fundraisers add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.platform_fees add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.platform_fees add column if not exists campaign_id uuid;
alter table if exists public.platform_fees add column if not exists amount_cents bigint;
alter table if exists public.platform_fees add column if not exists fee_type text;
alter table if exists public.platform_fees add column if not exists stripe_payment_intent_id text;
alter table if exists public.platform_fees add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.platform_settings add column if not exists id integer default 1 not null;
alter table if exists public.platform_settings add column if not exists config jsonb default '{}'::jsonb not null;
alter table if exists public.platform_settings add column if not exists updated_by uuid;
alter table if exists public.platform_settings add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.privacy_requests add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.privacy_requests add column if not exists user_id uuid;
alter table if exists public.privacy_requests add column if not exists type text;
alter table if exists public.privacy_requests add column if not exists status text default 'pending'::text not null;
alter table if exists public.privacy_requests add column if not exists note text;
alter table if exists public.privacy_requests add column if not exists resolution_note text;
alter table if exists public.privacy_requests add column if not exists resolver_id uuid;
alter table if exists public.privacy_requests add column if not exists resolved_at timestamp with time zone;
alter table if exists public.privacy_requests add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.privacy_requests add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.processor_accounts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.processor_accounts add column if not exists processor text;
alter table if exists public.processor_accounts add column if not exists account_scope text default 'campaign_owner'::text not null;
alter table if exists public.processor_accounts add column if not exists owner_id uuid;
alter table if exists public.processor_accounts add column if not exists connected_account_id uuid;
alter table if exists public.processor_accounts add column if not exists processor_account_id text;
alter table if exists public.processor_accounts add column if not exists status text default 'pending'::text not null;
alter table if exists public.processor_accounts add column if not exists charges_enabled boolean default false not null;
alter table if exists public.processor_accounts add column if not exists payouts_enabled boolean default false not null;
alter table if exists public.processor_accounts add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.processor_accounts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.processor_accounts add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.processor_accounts add column if not exists created_by uuid;
alter table if exists public.processor_accounts add column if not exists updated_by uuid;
alter table if exists public.processor_accounts add column if not exists deleted_at timestamp with time zone;
alter table if exists public.product_orders add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.product_orders add column if not exists product_id uuid;
alter table if exists public.product_orders add column if not exists buyer_id uuid;
alter table if exists public.product_orders add column if not exists buyer_email text;
alter table if exists public.product_orders add column if not exists amount_cents bigint;
alter table if exists public.product_orders add column if not exists stripe_payment_intent_id text;
alter table if exists public.product_orders add column if not exists fulfillment_status text default 'paid'::text not null;
alter table if exists public.product_orders add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.profiles add column if not exists id uuid;
alter table if exists public.profiles add column if not exists email text;
alter table if exists public.profiles add column if not exists full_name text;
alter table if exists public.profiles add column if not exists avatar_url text;
alter table if exists public.profiles add column if not exists roles jsonb default '["donor"]'::jsonb not null;
alter table if exists public.profiles add column if not exists identity_verified boolean default false not null;
alter table if exists public.profiles add column if not exists trust_passport_score integer default 0 not null;
alter table if exists public.profiles add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.profiles add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.profiles add column if not exists notification_email boolean default true not null;
alter table if exists public.profiles add column if not exists notification_updates boolean default true not null;
alter table if exists public.profiles add column if not exists notification_marketing boolean default false not null;
alter table if exists public.rate_limit_hits add column if not exists key text;
alter table if exists public.rate_limit_hits add column if not exists count integer default 0 not null;
alter table if exists public.rate_limit_hits add column if not exists reset_at timestamp with time zone;
alter table if exists public.rate_limit_hits add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.reconciliation_exceptions add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.reconciliation_exceptions add column if not exists kind text;
alter table if exists public.reconciliation_exceptions add column if not exists status text default 'open'::text not null;
alter table if exists public.reconciliation_exceptions add column if not exists description text;
alter table if exists public.reconciliation_exceptions add column if not exists campaign_id uuid;
alter table if exists public.reconciliation_exceptions add column if not exists donation_id uuid;
alter table if exists public.reconciliation_exceptions add column if not exists stripe_ref text;
alter table if exists public.reconciliation_exceptions add column if not exists expected_cents bigint;
alter table if exists public.reconciliation_exceptions add column if not exists actual_cents bigint;
alter table if exists public.reconciliation_exceptions add column if not exists difference_cents bigint;
alter table if exists public.reconciliation_exceptions add column if not exists assignee_id uuid;
alter table if exists public.reconciliation_exceptions add column if not exists resolution_note text;
alter table if exists public.reconciliation_exceptions add column if not exists resolved_at timestamp with time zone;
alter table if exists public.reconciliation_exceptions add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.reconciliation_exceptions add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.recurring_donations add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.recurring_donations add column if not exists donor_id uuid;
alter table if exists public.recurring_donations add column if not exists campaign_id uuid;
alter table if exists public.recurring_donations add column if not exists nonprofit_id uuid;
alter table if exists public.recurring_donations add column if not exists amount_cents bigint;
alter table if exists public.recurring_donations add column if not exists cadence text default 'monthly'::text not null;
alter table if exists public.recurring_donations add column if not exists status text default 'active'::text not null;
alter table if exists public.recurring_donations add column if not exists stripe_subscription_id text;
alter table if exists public.recurring_donations add column if not exists next_bill_at timestamp with time zone;
alter table if exists public.recurring_donations add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.recurring_donations add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.refunds add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.refunds add column if not exists donation_id uuid;
alter table if exists public.refunds add column if not exists amount_cents bigint;
alter table if exists public.refunds add column if not exists reason text;
alter table if exists public.refunds add column if not exists status text default 'requested'::text not null;
alter table if exists public.refunds add column if not exists stripe_refund_id text;
alter table if exists public.refunds add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.reward_tiers add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.reward_tiers add column if not exists campaign_id uuid;
alter table if exists public.reward_tiers add column if not exists title text;
alter table if exists public.reward_tiers add column if not exists description text;
alter table if exists public.reward_tiers add column if not exists amount_cents bigint;
alter table if exists public.reward_tiers add column if not exists quantity_limit integer;
alter table if exists public.reward_tiers add column if not exists claimed_count integer default 0 not null;
alter table if exists public.reward_tiers add column if not exists estimated_delivery date;
alter table if exists public.reward_tiers add column if not exists fulfillment_status text default 'open'::text not null;
alter table if exists public.reward_tiers add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.reward_tiers add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.risk_flags add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.risk_flags add column if not exists campaign_id uuid;
alter table if exists public.risk_flags add column if not exists user_id uuid;
alter table if exists public.risk_flags add column if not exists code text;
alter table if exists public.risk_flags add column if not exists label text;
alter table if exists public.risk_flags add column if not exists severity text;
alter table if exists public.risk_flags add column if not exists status text default 'open'::text not null;
alter table if exists public.risk_flags add column if not exists metadata jsonb default '{}'::jsonb not null;
alter table if exists public.risk_flags add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.risk_flags add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.risk_flags add column if not exists flag_type text;
alter table if exists public.risk_flags add column if not exists description text;
alter table if exists public.risk_flags add column if not exists resolved boolean default false not null;
alter table if exists public.risk_flags add column if not exists resolved_by uuid;
alter table if exists public.risk_flags add column if not exists resolved_at timestamp with time zone;
alter table if exists public.saved_campaigns add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.saved_campaigns add column if not exists user_id uuid;
alter table if exists public.saved_campaigns add column if not exists campaign_id uuid;
alter table if exists public.saved_campaigns add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.share_events add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.share_events add column if not exists campaign_id uuid;
alter table if exists public.share_events add column if not exists sharer_id uuid;
alter table if exists public.share_events add column if not exists team_member_id uuid;
alter table if exists public.share_events add column if not exists channel text default 'link'::text not null;
alter table if exists public.share_events add column if not exists utm_source text;
alter table if exists public.share_events add column if not exists utm_medium text;
alter table if exists public.share_events add column if not exists utm_campaign text;
alter table if exists public.share_events add column if not exists utm_content text;
alter table if exists public.share_events add column if not exists referrer text;
alter table if exists public.share_events add column if not exists ip_hash text;
alter table if exists public.share_events add column if not exists converted boolean default false not null;
alter table if exists public.share_events add column if not exists donation_id uuid;
alter table if exists public.share_events add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.sms_campaigns add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.sms_campaigns add column if not exists owner_id uuid;
alter table if exists public.sms_campaigns add column if not exists nonprofit_id uuid;
alter table if exists public.sms_campaigns add column if not exists campaign_id uuid;
alter table if exists public.sms_campaigns add column if not exists keyword text;
alter table if exists public.sms_campaigns add column if not exists body text;
alter table if exists public.sms_campaigns add column if not exists status text default 'draft'::text not null;
alter table if exists public.sms_campaigns add column if not exists scheduled_at timestamp with time zone;
alter table if exists public.sms_campaigns add column if not exists sent_at timestamp with time zone;
alter table if exists public.sms_campaigns add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.sms_campaigns add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.sponsors add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.sponsors add column if not exists name text;
alter table if exists public.sponsors add column if not exists logo_url text;
alter table if exists public.sponsors add column if not exists website text;
alter table if exists public.sponsors add column if not exists active boolean default true not null;
alter table if exists public.sponsors add column if not exists sort_order integer default 0 not null;
alter table if exists public.sponsors add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.sponsors add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.sponsorship_opportunities add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.sponsorship_opportunities add column if not exists organizer_id uuid;
alter table if exists public.sponsorship_opportunities add column if not exists campaign_id uuid;
alter table if exists public.sponsorship_opportunities add column if not exists title text;
alter table if exists public.sponsorship_opportunities add column if not exists description text;
alter table if exists public.sponsorship_opportunities add column if not exists category text default 'Community'::text not null;
alter table if exists public.sponsorship_opportunities add column if not exists benefits text;
alter table if exists public.sponsorship_opportunities add column if not exists min_amount_cents bigint default 0 not null;
alter table if exists public.sponsorship_opportunities add column if not exists target_amount_cents bigint;
alter table if exists public.sponsorship_opportunities add column if not exists raised_amount_cents bigint default 0 not null;
alter table if exists public.sponsorship_opportunities add column if not exists currency text default 'USD'::text not null;
alter table if exists public.sponsorship_opportunities add column if not exists status text default 'open'::text not null;
alter table if exists public.sponsorship_opportunities add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.sponsorship_opportunities add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.sponsorship_requests add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.sponsorship_requests add column if not exists opportunity_id uuid;
alter table if exists public.sponsorship_requests add column if not exists sponsor_id uuid;
alter table if exists public.sponsorship_requests add column if not exists company_name text;
alter table if exists public.sponsorship_requests add column if not exists amount_cents bigint;
alter table if exists public.sponsorship_requests add column if not exists message text;
alter table if exists public.sponsorship_requests add column if not exists benefits_requested text;
alter table if exists public.sponsorship_requests add column if not exists status text default 'pending'::text not null;
alter table if exists public.sponsorship_requests add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.sponsorship_requests add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.subscriptions add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.subscriptions add column if not exists user_id uuid;
alter table if exists public.subscriptions add column if not exists tier text;
alter table if exists public.subscriptions add column if not exists status text default 'active'::text not null;
alter table if exists public.subscriptions add column if not exists stripe_subscription_id text;
alter table if exists public.subscriptions add column if not exists current_period_end timestamp with time zone;
alter table if exists public.subscriptions add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.subscriptions add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.support_cases add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.support_cases add column if not exists submitter_id uuid;
alter table if exists public.support_cases add column if not exists campaign_id uuid;
alter table if exists public.support_cases add column if not exists donation_id uuid;
alter table if exists public.support_cases add column if not exists subject text;
alter table if exists public.support_cases add column if not exists body text;
alter table if exists public.support_cases add column if not exists status text default 'open'::text not null;
alter table if exists public.support_cases add column if not exists assigned_to uuid;
alter table if exists public.support_cases add column if not exists priority text default 'normal'::text not null;
alter table if exists public.support_cases add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.support_cases add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.support_cases add column if not exists resolved_at timestamp with time zone;
alter table if exists public.support_cases add column if not exists escalated_at timestamp with time zone;
alter table if exists public.support_cases add column if not exists source text default 'web'::text not null;
alter table if exists public.support_cases add column if not exists ai_triage jsonb;
alter table if exists public.support_cases add column if not exists ai_generation_id uuid;
alter table if exists public.support_notes add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.support_notes add column if not exists case_id uuid;
alter table if exists public.support_notes add column if not exists author_id uuid;
alter table if exists public.support_notes add column if not exists body text;
alter table if exists public.support_notes add column if not exists internal boolean default false not null;
alter table if exists public.support_notes add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.supported_countries add column if not exists id uuid default gen_random_uuid() not null;
alter table if exists public.supported_countries add column if not exists name text;
alter table if exists public.supported_countries add column if not exists flag_emoji text default ''::text not null;
alter table if exists public.supported_countries add column if not exists iso_code text default ''::text not null;
alter table if exists public.supported_countries add column if not exists can_fundraise boolean default false not null;
alter table if exists public.supported_countries add column if not exists can_donate boolean default true not null;
alter table if exists public.supported_countries add column if not exists currency_code text default 'USD'::text not null;
alter table if exists public.supported_countries add column if not exists notes text;
alter table if exists public.supported_countries add column if not exists active boolean default true not null;
alter table if exists public.supported_countries add column if not exists sort_order integer default 0 not null;
alter table if exists public.supported_countries add column if not exists created_at timestamp with time zone default now();
alter table if exists public.tax_receipts add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.tax_receipts add column if not exists donation_id uuid;
alter table if exists public.tax_receipts add column if not exists donor_id uuid;
alter table if exists public.tax_receipts add column if not exists nonprofit_id uuid;
alter table if exists public.tax_receipts add column if not exists receipt_number text;
alter table if exists public.tax_receipts add column if not exists amount_cents bigint;
alter table if exists public.tax_receipts add column if not exists emailed_at timestamp with time zone;
alter table if exists public.tax_receipts add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.team_members add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.team_members add column if not exists campaign_id uuid;
alter table if exists public.team_members add column if not exists nonprofit_id uuid;
alter table if exists public.team_members add column if not exists user_id uuid;
alter table if exists public.team_members add column if not exists role text default 'member'::text not null;
alter table if exists public.team_members add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.team_members add column if not exists invite_token text default substr(md5(((random())::text || (clock_timestamp())::text)), 1, 32);
alter table if exists public.team_members add column if not exists invite_email text;
alter table if exists public.team_members add column if not exists invite_sent_at timestamp with time zone;
alter table if exists public.team_members add column if not exists permissions jsonb default '{"view_donors": true, "view_ledger": false, "post_updates": true, "thank_donors": true, "manage_payout": false}'::jsonb not null;
alter table if exists public.transparency_ledger_items add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.transparency_ledger_items add column if not exists campaign_id uuid;
alter table if exists public.transparency_ledger_items add column if not exists item_type text;
alter table if exists public.transparency_ledger_items add column if not exists title text;
alter table if exists public.transparency_ledger_items add column if not exists description text;
alter table if exists public.transparency_ledger_items add column if not exists category text default 'Other'::text not null;
alter table if exists public.transparency_ledger_items add column if not exists amount_cents bigint;
alter table if exists public.transparency_ledger_items add column if not exists receipt_url text;
alter table if exists public.transparency_ledger_items add column if not exists status text default 'published'::text not null;
alter table if exists public.transparency_ledger_items add column if not exists ai_summary text;
alter table if exists public.transparency_ledger_items add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.transparency_ledger_items add column if not exists risk_score numeric;
alter table if exists public.transparency_ledger_items add column if not exists review_status text default 'auto_approved'::text not null;
alter table if exists public.transparency_ledger_items add column if not exists reviewed_by uuid;
alter table if exists public.transparency_ledger_items add column if not exists reviewed_at timestamp with time zone;
alter table if exists public.transparency_ledger_items add column if not exists ai_generation_id uuid;
alter table if exists public.trust_scores add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.trust_scores add column if not exists campaign_id uuid;
alter table if exists public.trust_scores add column if not exists score integer;
alter table if exists public.trust_scores add column if not exists status text;
alter table if exists public.trust_scores add column if not exists signals jsonb default '[]'::jsonb not null;
alter table if exists public.trust_scores add column if not exists model text default 'deterministic'::text not null;
alter table if exists public.trust_scores add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.user_badges add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.user_badges add column if not exists user_id uuid;
alter table if exists public.user_badges add column if not exists badge_id text;
alter table if exists public.user_badges add column if not exists awarded_at timestamp with time zone default now() not null;
alter table if exists public.verification_documents add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.verification_documents add column if not exists user_id uuid;
alter table if exists public.verification_documents add column if not exists campaign_id uuid;
alter table if exists public.verification_documents add column if not exists document_type text;
alter table if exists public.verification_documents add column if not exists storage_path text;
alter table if exists public.verification_documents add column if not exists status text default 'pending'::text not null;
alter table if exists public.verification_documents add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_applications add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.volunteer_applications add column if not exists opportunity_id uuid;
alter table if exists public.volunteer_applications add column if not exists applicant_user_id uuid;
alter table if exists public.volunteer_applications add column if not exists message text;
alter table if exists public.volunteer_applications add column if not exists status text default 'applied'::text not null;
alter table if exists public.volunteer_applications add column if not exists hours_logged numeric(7,2) default 0 not null;
alter table if exists public.volunteer_applications add column if not exists hours_verified boolean default false not null;
alter table if exists public.volunteer_applications add column if not exists applied_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_applications add column if not exists decided_at timestamp with time zone;
alter table if exists public.volunteer_applications add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_applications add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_applications add column if not exists deleted_at timestamp with time zone;
alter table if exists public.volunteer_opportunities add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.volunteer_opportunities add column if not exists slug text;
alter table if exists public.volunteer_opportunities add column if not exists title text;
alter table if exists public.volunteer_opportunities add column if not exists org_name text;
alter table if exists public.volunteer_opportunities add column if not exists summary text;
alter table if exists public.volunteer_opportunities add column if not exists description text;
alter table if exists public.volunteer_opportunities add column if not exists category text;
alter table if exists public.volunteer_opportunities add column if not exists skills text[] default '{}'::text[] not null;
alter table if exists public.volunteer_opportunities add column if not exists location text;
alter table if exists public.volunteer_opportunities add column if not exists country text;
alter table if exists public.volunteer_opportunities add column if not exists is_remote boolean default false not null;
alter table if exists public.volunteer_opportunities add column if not exists starts_at timestamp with time zone;
alter table if exists public.volunteer_opportunities add column if not exists ends_at timestamp with time zone;
alter table if exists public.volunteer_opportunities add column if not exists slots integer;
alter table if exists public.volunteer_opportunities add column if not exists slots_filled integer default 0 not null;
alter table if exists public.volunteer_opportunities add column if not exists time_commitment text;
alter table if exists public.volunteer_opportunities add column if not exists contact_url text;
alter table if exists public.volunteer_opportunities add column if not exists campaign_id uuid;
alter table if exists public.volunteer_opportunities add column if not exists status text default 'open'::text not null;
alter table if exists public.volunteer_opportunities add column if not exists verified boolean default false not null;
alter table if exists public.volunteer_opportunities add column if not exists created_by uuid;
alter table if exists public.volunteer_opportunities add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_opportunities add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_opportunities add column if not exists deleted_at timestamp with time zone;
alter table if exists public.volunteer_profiles add column if not exists user_id uuid;
alter table if exists public.volunteer_profiles add column if not exists headline text;
alter table if exists public.volunteer_profiles add column if not exists bio text;
alter table if exists public.volunteer_profiles add column if not exists skills text[] default '{}'::text[] not null;
alter table if exists public.volunteer_profiles add column if not exists interests text[] default '{}'::text[] not null;
alter table if exists public.volunteer_profiles add column if not exists location text;
alter table if exists public.volunteer_profiles add column if not exists country text;
alter table if exists public.volunteer_profiles add column if not exists availability text;
alter table if exists public.volunteer_profiles add column if not exists remote_ok boolean default true not null;
alter table if exists public.volunteer_profiles add column if not exists is_public boolean default true not null;
alter table if exists public.volunteer_profiles add column if not exists created_at timestamp with time zone default now() not null;
alter table if exists public.volunteer_profiles add column if not exists updated_at timestamp with time zone default now() not null;
alter table if exists public.webhook_events add column if not exists id uuid default uuid_generate_v4() not null;
alter table if exists public.webhook_events add column if not exists stripe_event_id text;
alter table if exists public.webhook_events add column if not exists event_type text;
alter table if exists public.webhook_events add column if not exists payload jsonb;
alter table if exists public.webhook_events add column if not exists processed_at timestamp with time zone;
alter table if exists public.webhook_events add column if not exists processing_error text;
alter table if exists public.webhook_events add column if not exists created_at timestamp with time zone default now() not null;


-- ============ 20260525000000_initial_schema.sql ============
-- CharitMe production schema
create extension if not exists "uuid-ossp";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and roles ? 'admin'
  );
$$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  roles jsonb not null default '["donor"]'::jsonb,
  identity_verified boolean not null default false,
  trust_passport_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connected_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  verification_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  beneficiary_profile_id uuid references profiles(id) on delete set null,
  slug text not null unique,
  title text not null,
  tagline text,
  description text not null,
  category text not null,
  goal_amount bigint not null,
  raised_amount bigint not null default 0,
  backer_count int not null default 0,
  deadline date,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','rejected','frozen')),
  beneficiary_name text,
  beneficiary_relationship text,
  cover_image_url text,
  trust_status text not null default 'Needs More Info',
  campaign_health_score int not null default 0,
  payout_frozen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_media (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  uploader_id uuid not null references profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','document')),
  storage_path text not null,
  public_url text,
  reuse_risk_score int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists campaign_updates (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  body text not null,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists donations (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  message text,
  anonymous boolean not null default false,
  stripe_payment_intent_id text,
  status text not null default 'completed' check (status in ('pending','completed','refunded','failed')),
  created_at timestamptz not null default now()
);

create table if not exists donor_tips (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete set null,
  donor_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists platform_fees (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete set null,
  amount_cents bigint not null,
  fee_type text not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  connected_account_id uuid references connected_accounts(id) on delete set null,
  amount_cents bigint not null,
  payout_speed text not null check (payout_speed in ('standard','same_day','instant')),
  fee_cents bigint not null default 0,
  status text not null default 'requested' check (status in ('requested','approved','paid','failed','frozen','released')),
  risk_score int not null default 0,
  stripe_payout_id text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trust_scores (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  score int not null,
  status text not null,
  signals jsonb not null default '[]'::jsonb,
  model text not null default 'deterministic',
  created_at timestamptz not null default now()
);

create table if not exists risk_flags (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  code text not null,
  label text not null,
  severity text not null check (severity in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists verification_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists transparency_ledger_items (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  item_type text not null check (item_type in ('milestone','receipt','expense','payout','impact_update')),
  title text not null,
  description text,
  category text not null default 'Other',
  amount_cents bigint,
  receipt_url text,
  status text not null default 'published',
  ai_summary text,
  created_at timestamptz not null default now()
);

create table if not exists donor_messages (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid references donations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  message text not null,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  tier text not null,
  status text not null default 'active',
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_reviews (
  id uuid primary key default uuid_generate_v4(),
  reviewer_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  review_type text not null,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refunds (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid not null references donations(id) on delete cascade,
  amount_cents bigint not null,
  reason text,
  status text not null default 'requested',
  stripe_refund_id text,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default uuid_generate_v4(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create table if not exists ai_generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  generation_type text not null,
  prompt jsonb not null,
  output jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaign_reports (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_status_idx on campaigns(status);
create index if not exists campaigns_user_id_idx on campaigns(user_id);
create index if not exists campaigns_slug_idx on campaigns(slug);
create index if not exists donations_campaign_id_idx on donations(campaign_id);
create index if not exists donations_donor_id_idx on donations(donor_id);
create unique index if not exists donations_stripe_payment_intent_id_uidx on donations(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists donor_tips_stripe_payment_intent_id_uidx on donor_tips(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists platform_fees_stripe_payment_intent_id_uidx on platform_fees(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists payouts_campaign_id_idx on payouts(campaign_id);
create index if not exists risk_flags_status_idx on risk_flags(status);
create index if not exists ledger_campaign_id_idx on transparency_ledger_items(campaign_id);

create or replace function increment_campaign_stats(p_campaign_id uuid, p_amount bigint)
returns void language plpgsql security definer as $$
begin
  update campaigns
  set raised_amount = raised_amount + p_amount,
      backer_count = backer_count + 1,
      updated_at = now()
  where id = p_campaign_id;
end;
$$;

create or replace function increment_campaign_stats_after_donation()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' then
    update campaigns
    set raised_amount = raised_amount + new.amount_cents,
        backer_count = backer_count + 1,
        updated_at = now()
    where id = new.campaign_id;
  end if;
  return new;
end;
$$;

drop trigger if exists donations_increment_campaign_stats on donations;
drop trigger if exists donations_increment_campaign_stats on donations;
create trigger donations_increment_campaign_stats
  after insert on donations
  for each row execute function increment_campaign_stats_after_donation();

drop trigger if exists profiles_set_updated_at on profiles;
drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
drop trigger if exists connected_accounts_set_updated_at on connected_accounts;
drop trigger if exists connected_accounts_set_updated_at on connected_accounts;
create trigger connected_accounts_set_updated_at before update on connected_accounts for each row execute function set_updated_at();
drop trigger if exists campaigns_set_updated_at on campaigns;
drop trigger if exists campaigns_set_updated_at on campaigns;
create trigger campaigns_set_updated_at before update on campaigns for each row execute function set_updated_at();
drop trigger if exists payouts_set_updated_at on payouts;
drop trigger if exists payouts_set_updated_at on payouts;
create trigger payouts_set_updated_at before update on payouts for each row execute function set_updated_at();
drop trigger if exists risk_flags_set_updated_at on risk_flags;
drop trigger if exists risk_flags_set_updated_at on risk_flags;
create trigger risk_flags_set_updated_at before update on risk_flags for each row execute function set_updated_at();
drop trigger if exists subscriptions_set_updated_at on subscriptions;
drop trigger if exists subscriptions_set_updated_at on subscriptions;
create trigger subscriptions_set_updated_at before update on subscriptions for each row execute function set_updated_at();
drop trigger if exists admin_reviews_set_updated_at on admin_reviews;
drop trigger if exists admin_reviews_set_updated_at on admin_reviews;
create trigger admin_reviews_set_updated_at before update on admin_reviews for each row execute function set_updated_at();
drop trigger if exists campaign_reports_set_updated_at on campaign_reports;
drop trigger if exists campaign_reports_set_updated_at on campaign_reports;
create trigger campaign_reports_set_updated_at before update on campaign_reports for each row execute function set_updated_at();

alter table profiles enable row level security;
alter table connected_accounts enable row level security;
alter table campaigns enable row level security;
alter table campaign_media enable row level security;
alter table campaign_updates enable row level security;
alter table donations enable row level security;
alter table donor_tips enable row level security;
alter table platform_fees enable row level security;
alter table payouts enable row level security;
alter table trust_scores enable row level security;
alter table risk_flags enable row level security;
alter table verification_documents enable row level security;
alter table transparency_ledger_items enable row level security;
alter table donor_messages enable row level security;
alter table subscriptions enable row level security;
alter table admin_reviews enable row level security;
alter table refunds enable row level security;
alter table webhook_events enable row level security;
alter table ai_generations enable row level security;
alter table campaign_reports enable row level security;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);
drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update using (auth.uid() = id or is_admin());

drop policy if exists campaigns_public_read on campaigns;
create policy campaigns_public_read on campaigns for select using (status = 'active' or auth.uid() = user_id or is_admin());
drop policy if exists campaigns_insert_own on campaigns;
create policy campaigns_insert_own on campaigns for insert with check (auth.uid() = user_id);
drop policy if exists campaigns_update_own on campaigns;
create policy campaigns_update_own on campaigns for update using (auth.uid() = user_id or is_admin());

drop policy if exists donations_donor_or_owner_read on donations;
create policy donations_donor_or_owner_read on donations for select using (
  auth.uid() = donor_id or is_admin() or exists (select 1 from campaigns where campaigns.id = donations.campaign_id and campaigns.user_id = auth.uid())
);
drop policy if exists donations_insert_service on donations;
create policy donations_insert_service on donations for insert with check (true);

drop policy if exists donor_tips_owner_read on donor_tips;
create policy donor_tips_owner_read on donor_tips for select using (
  auth.uid() = donor_id or is_admin() or exists (select 1 from campaigns where campaigns.id = donor_tips.campaign_id and campaigns.user_id = auth.uid())
);
drop policy if exists donor_tips_insert_service on donor_tips;
create policy donor_tips_insert_service on donor_tips for insert with check (true);

drop policy if exists platform_fees_owner_read on platform_fees;
create policy platform_fees_owner_read on platform_fees for select using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = platform_fees.campaign_id and campaigns.user_id = auth.uid())
);
drop policy if exists platform_fees_insert_service on platform_fees;
create policy platform_fees_insert_service on platform_fees for insert with check (true);

drop policy if exists payouts_owner_admin_read on payouts;
create policy payouts_owner_admin_read on payouts for select using (auth.uid() = user_id or is_admin());
drop policy if exists payouts_owner_insert on payouts;
create policy payouts_owner_insert on payouts for insert with check (auth.uid() = user_id);
drop policy if exists payouts_admin_update on payouts;
create policy payouts_admin_update on payouts for update using (is_admin());

drop policy if exists private_owner_admin on verification_documents;
create policy private_owner_admin on verification_documents for select using (auth.uid() = user_id or is_admin());
drop policy if exists private_owner_admin_insert on verification_documents;
create policy private_owner_admin_insert on verification_documents for insert with check (auth.uid() = user_id or is_admin());

drop policy if exists ledger_public_read on transparency_ledger_items;
create policy ledger_public_read on transparency_ledger_items for select using (true);
drop policy if exists ledger_owner_write on transparency_ledger_items;
create policy ledger_owner_write on transparency_ledger_items for insert with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

drop policy if exists admin_all_risk on risk_flags;
create policy admin_all_risk on risk_flags for all using (is_admin()) with check (is_admin());
drop policy if exists admin_all_reviews on admin_reviews;
create policy admin_all_reviews on admin_reviews for all using (is_admin()) with check (is_admin());
drop policy if exists admin_all_webhooks on webhook_events;
create policy admin_all_webhooks on webhook_events for all using (is_admin()) with check (is_admin());

drop policy if exists reports_insert_public on campaign_reports;
create policy reports_insert_public on campaign_reports for insert with check (true);
drop policy if exists reports_admin_read on campaign_reports;
create policy reports_admin_read on campaign_reports for select using (is_admin());

drop policy if exists own_subscriptions on subscriptions;
create policy own_subscriptions on subscriptions for select using (auth.uid() = user_id or is_admin());
drop policy if exists own_ai_generations on ai_generations;
create policy own_ai_generations on ai_generations for select using (auth.uid() = user_id or is_admin());
drop policy if exists public_trust_scores on trust_scores;
create policy public_trust_scores on trust_scores for select using (true);
drop policy if exists public_updates on campaign_updates;
create policy public_updates on campaign_updates for select using (true);
drop policy if exists owner_updates on campaign_updates;
create policy owner_updates on campaign_updates for insert with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));


-- ---- catch-up supplement: tables referenced by migrations but created only in
-- ---- schema.sql / manually (feature_flags) or nowhere (admin_settings). ----
create table if not exists public.feature_flags (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  enabled boolean not null default false,
  description text,
  rollout_pct int not null default 100 check (rollout_pct between 0 and 100),
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.admin_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
-- RLS: admin-config tables — admin-only (service role bypasses).
alter table public.feature_flags  enable row level security;
alter table public.admin_settings enable row level security;
drop policy if exists feature_flags_admin_all on public.feature_flags;
create policy feature_flags_admin_all on public.feature_flags for all using (is_admin()) with check (is_admin());
drop policy if exists admin_settings_admin_all on public.admin_settings;
create policy admin_settings_admin_all on public.admin_settings for all using (is_admin()) with check (is_admin());


-- ============ 20240001_support_cases.sql ============
-- ── support_cases ─────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to enable the Support admin page.
create table if not exists public.support_cases (
  id           uuid primary key default uuid_generate_v4(),
  submitter_id uuid references profiles(id) on delete set null,
  subject      text not null,
  body         text,
  priority     text not null default 'normal'
                 check (priority in ('low','normal','high','urgent')),
  status       text not null default 'open'
                 check (status in ('open','in_progress','resolved','closed')),
  assigned_to  uuid references profiles(id) on delete set null,
  source       text not null default 'web'
                 check (source in ('web','email','api')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_support_cases_status     on support_cases(status);
create index if not exists idx_support_cases_priority   on support_cases(priority);
create index if not exists idx_support_cases_submitter  on support_cases(submitter_id);
create index if not exists idx_support_cases_created    on support_cases(created_at desc);

alter table support_cases enable row level security;

-- Admins can read/write all cases
do $$ begin
  if not exists (select 1 from pg_policies where tablename='support_cases' and policyname='support_admin_all') then
    drop policy if exists support_admin_all on support_cases;
create policy support_admin_all on support_cases for all using (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename='support_cases' and policyname='support_own_read') then
    drop policy if exists support_own_read on support_cases;
create policy support_own_read on support_cases for select using (auth.uid() = submitter_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='support_cases' and policyname='support_own_insert') then
    drop policy if exists support_own_insert on support_cases;
create policy support_own_insert on support_cases for insert with check (auth.uid() = submitter_id);
  end if;
end $$;

drop trigger if exists set_updated_at_support on support_cases;
create trigger set_updated_at_support
  before update on support_cases
  for each row execute function set_updated_at();


-- ============ 20260525001000_storage_buckets.sql ============
-- CharitMe storage buckets and policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('campaign-media', 'campaign-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('verification-documents', 'verification-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "campaign media public read" on storage.objects;
create policy "campaign media public read" on storage.objects for select
using (bucket_id = 'campaign-media');

drop policy if exists "campaign media owner upload" on storage.objects;
create policy "campaign media owner upload" on storage.objects for insert
with check (
  bucket_id = 'campaign-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "campaign media owner update" on storage.objects;
create policy "campaign media owner update" on storage.objects for update
using (
  bucket_id = 'campaign-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "campaign media owner delete" on storage.objects;
create policy "campaign media owner delete" on storage.objects for delete
using (
  bucket_id = 'campaign-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "verification documents owner admin read" on storage.objects;
create policy "verification documents owner admin read" on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_admin()
  )
);

drop policy if exists "verification documents owner upload" on storage.objects;
create policy "verification documents owner upload" on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "receipts owner admin read" on storage.objects;
create policy "receipts owner admin read" on storage.objects for select
using (
  bucket_id = 'receipts'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.is_admin()
    or exists (
      select 1
      from public.campaigns
      where campaigns.user_id = auth.uid()
      and campaigns.id::text = (storage.foldername(storage.objects.name))[2]
    )
  )
);

drop policy if exists "receipts owner upload" on storage.objects;
create policy "receipts owner upload" on storage.objects for insert
with check (
  bucket_id = 'receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
);


-- ============ 20260525002000_competitor_parity_features.sql ============
-- Competitor parity modules: projects/perks, memberships, nonprofit CRM, events, creator commerce, integrations, and analytics.

create table if not exists creator_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text,
  hero_image_url text,
  website_url text,
  brand_color text default '#059669',
  accepts_tips boolean not null default true,
  accepts_commissions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_launch_settings (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null unique references campaigns(id) on delete cascade,
  funding_model text not null default 'flexible' check (funding_model in ('flexible','fixed')),
  launch_type text not null default 'fundraiser' check (launch_type in ('fundraiser','project','product','indemand')),
  currency text not null default 'usd',
  country text not null default 'US',
  is_indemand boolean not null default false,
  product_stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reward_tiers (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  description text not null,
  amount_cents bigint not null,
  quantity_limit int,
  claimed_count int not null default 0,
  estimated_delivery date,
  fulfillment_status text not null default 'open' check (fulfillment_status in ('open','in_progress','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nonprofit_profiles (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  mission text,
  tax_id text,
  website_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donation_forms (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  slug text not null unique,
  default_amounts_cents bigint[] not null default array[2500,5000,10000,25000],
  recurring_enabled boolean not null default true,
  currencies text[] not null default array['usd'],
  embed_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recurring_donations (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid references profiles(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  amount_cents bigint not null,
  cadence text not null default 'monthly' check (cadence in ('weekly','monthly','quarterly','annual')),
  status text not null default 'active' check (status in ('active','paused','cancelled','past_due')),
  stripe_subscription_id text unique,
  next_bill_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donor_crm_contacts (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  tags text[] not null default '{}',
  lifetime_value_cents bigint not null default 0,
  last_donated_at timestamptz,
  consent_email boolean not null default true,
  consent_sms boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donor_segments (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid not null references nonprofit_profiles(id) on delete cascade,
  name text not null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donor_segment_members (
  segment_id uuid not null references donor_segments(id) on delete cascade,
  contact_id uuid not null references donor_crm_contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  unique (campaign_id, nonprofit_id, user_id)
);

create table if not exists peer_fundraisers (
  id uuid primary key default uuid_generate_v4(),
  parent_campaign_id uuid not null references campaigns(id) on delete cascade,
  fundraiser_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique,
  title text not null,
  goal_amount bigint not null,
  raised_amount bigint not null default 0,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fundraising_events (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  slug text not null unique,
  event_type text not null default 'fundraiser' check (event_type in ('fundraiser','gala','giving_day','livestream','auction','registration')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  virtual_url text,
  status text not null default 'draft' check (status in ('draft','published','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_tickets (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references fundraising_events(id) on delete cascade,
  title text not null,
  price_cents bigint not null,
  quantity_limit int,
  sold_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists event_registrations (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references fundraising_events(id) on delete cascade,
  ticket_id uuid references event_tickets(id) on delete set null,
  attendee_id uuid references profiles(id) on delete set null,
  attendee_email text,
  attendee_name text,
  quantity int not null default 1,
  amount_cents bigint not null default 0,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists auction_items (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references fundraising_events(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  starting_bid_cents bigint not null,
  current_bid_cents bigint not null default 0,
  closes_at timestamptz,
  status text not null default 'open' check (status in ('open','closed','fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auction_bids (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references auction_items(id) on delete cascade,
  bidder_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  status text not null default 'active' check (status in ('active','outbid','winning','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists giving_days (
  id uuid primary key default uuid_generate_v4(),
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  goal_amount bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists livestreams (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references fundraising_events(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  stream_url text not null,
  starts_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists membership_tiers (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  title text not null,
  description text not null,
  amount_cents bigint not null,
  interval text not null default 'month' check (interval in ('month','year')),
  benefits text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists member_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  tier_id uuid not null references membership_tiers(id) on delete cascade,
  member_id uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','cancelled','past_due')),
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exclusive_posts (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  visibility text not null default 'members' check (visibility in ('public','members','tier')),
  minimum_tier_id uuid references membership_tiers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists direct_messages (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists digital_products (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  title text not null,
  description text,
  price_cents bigint not null,
  storage_path text,
  preview_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_orders (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references digital_products(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete set null,
  buyer_email text,
  amount_cents bigint not null,
  stripe_payment_intent_id text,
  fulfillment_status text not null default 'paid' check (fulfillment_status in ('pending','paid','delivered','refunded')),
  created_at timestamptz not null default now()
);

create table if not exists commission_requests (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  requester_id uuid references profiles(id) on delete set null,
  requester_email text,
  title text not null,
  brief text not null,
  budget_cents bigint,
  status text not null default 'requested' check (status in ('requested','quoted','accepted','in_progress','delivered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creator_tips (
  id uuid primary key default uuid_generate_v4(),
  creator_profile_id uuid not null references creator_profiles(id) on delete cascade,
  supporter_id uuid references profiles(id) on delete set null,
  amount_cents bigint not null,
  message text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists embedded_buttons (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  donation_form_id uuid references donation_forms(id) on delete cascade,
  label text not null default 'Support CharitMe',
  button_type text not null default 'donate' check (button_type in ('donate','tip','membership','product')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tax_receipts (
  id uuid primary key default uuid_generate_v4(),
  donation_id uuid references donations(id) on delete cascade,
  donor_id uuid references profiles(id) on delete set null,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  receipt_number text not null unique,
  amount_cents bigint not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists email_campaigns (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sms_campaigns (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  keyword text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics_snapshots (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  nonprofit_id uuid references nonprofit_profiles(id) on delete cascade,
  creator_profile_id uuid references creator_profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists campaign_analytics_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  event_type text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists integration_connections (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  status text not null default 'connected' check (status in ('connected','paused','revoked','error')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists outbound_webhook_endpoints (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  secret_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_profiles_user_id_idx on creator_profiles(user_id);
create index if not exists reward_tiers_campaign_id_idx on reward_tiers(campaign_id);
create index if not exists nonprofit_profiles_owner_id_idx on nonprofit_profiles(owner_id);
create index if not exists donation_forms_nonprofit_id_idx on donation_forms(nonprofit_id);
create index if not exists recurring_donations_donor_id_idx on recurring_donations(donor_id);
create index if not exists donor_crm_contacts_nonprofit_id_idx on donor_crm_contacts(nonprofit_id);
create index if not exists peer_fundraisers_parent_campaign_id_idx on peer_fundraisers(parent_campaign_id);
create index if not exists fundraising_events_nonprofit_id_idx on fundraising_events(nonprofit_id);
create index if not exists membership_tiers_creator_profile_id_idx on membership_tiers(creator_profile_id);
create index if not exists digital_products_creator_profile_id_idx on digital_products(creator_profile_id);
create index if not exists analytics_snapshots_campaign_id_idx on analytics_snapshots(campaign_id);
create index if not exists campaign_analytics_events_campaign_id_idx on campaign_analytics_events(campaign_id);

alter table creator_profiles enable row level security;
alter table campaign_launch_settings enable row level security;
alter table reward_tiers enable row level security;
alter table nonprofit_profiles enable row level security;
alter table donation_forms enable row level security;
alter table recurring_donations enable row level security;
alter table donor_crm_contacts enable row level security;
alter table donor_segments enable row level security;
alter table donor_segment_members enable row level security;
alter table team_members enable row level security;
alter table peer_fundraisers enable row level security;
alter table fundraising_events enable row level security;
alter table event_tickets enable row level security;
alter table event_registrations enable row level security;
alter table auction_items enable row level security;
alter table auction_bids enable row level security;
alter table giving_days enable row level security;
alter table livestreams enable row level security;
alter table membership_tiers enable row level security;
alter table member_subscriptions enable row level security;
alter table exclusive_posts enable row level security;
alter table direct_messages enable row level security;
alter table digital_products enable row level security;
alter table product_orders enable row level security;
alter table commission_requests enable row level security;
alter table creator_tips enable row level security;
alter table embedded_buttons enable row level security;
alter table tax_receipts enable row level security;
alter table email_campaigns enable row level security;
alter table sms_campaigns enable row level security;
alter table analytics_snapshots enable row level security;
alter table campaign_analytics_events enable row level security;
alter table integration_connections enable row level security;
alter table api_keys enable row level security;
alter table outbound_webhook_endpoints enable row level security;

drop policy if exists public_creator_profiles_read on creator_profiles;
create policy public_creator_profiles_read on creator_profiles for select using (true);
drop policy if exists creator_profiles_owner_write on creator_profiles;
create policy creator_profiles_owner_write on creator_profiles for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin());

drop policy if exists public_campaign_launch_read on campaign_launch_settings;
create policy public_campaign_launch_read on campaign_launch_settings for select using (true);
drop policy if exists campaign_launch_owner_write on campaign_launch_settings;
create policy campaign_launch_owner_write on campaign_launch_settings for all using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_launch_settings.campaign_id and campaigns.user_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_launch_settings.campaign_id and campaigns.user_id = auth.uid())
);

drop policy if exists public_reward_tiers_read on reward_tiers;
create policy public_reward_tiers_read on reward_tiers for select using (true);
drop policy if exists reward_tiers_owner_write on reward_tiers;
create policy reward_tiers_owner_write on reward_tiers for all using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = reward_tiers.campaign_id and campaigns.user_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from campaigns where campaigns.id = reward_tiers.campaign_id and campaigns.user_id = auth.uid())
);

drop policy if exists public_nonprofit_profiles_read on nonprofit_profiles;
create policy public_nonprofit_profiles_read on nonprofit_profiles for select using (true);
drop policy if exists nonprofit_profiles_owner_write on nonprofit_profiles;
create policy nonprofit_profiles_owner_write on nonprofit_profiles for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

drop policy if exists public_donation_forms_read on donation_forms;
create policy public_donation_forms_read on donation_forms for select using (true);
drop policy if exists donation_forms_owner_write on donation_forms;
create policy donation_forms_owner_write on donation_forms for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donation_forms.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donation_forms.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);

drop policy if exists recurring_donations_private on recurring_donations;
create policy recurring_donations_private on recurring_donations for select using (
  auth.uid() = donor_id or is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = recurring_donations.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
drop policy if exists recurring_donations_insert_own on recurring_donations;
create policy recurring_donations_insert_own on recurring_donations for insert with check (auth.uid() = donor_id or is_admin());

drop policy if exists donor_crm_owner_private on donor_crm_contacts;
create policy donor_crm_owner_private on donor_crm_contacts for all using (
  auth.uid() = owner_id or is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_crm_contacts.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  auth.uid() = owner_id or is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_crm_contacts.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);

drop policy if exists donor_segments_owner_private on donor_segments;
create policy donor_segments_owner_private on donor_segments for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_segments.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = donor_segments.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);

drop policy if exists donor_segment_members_owner_private on donor_segment_members;
create policy donor_segment_members_owner_private on donor_segment_members for all using (
  is_admin() or exists (
    select 1
    from donor_segments
    join nonprofit_profiles on nonprofit_profiles.id = donor_segments.nonprofit_id
    where donor_segments.id = donor_segment_members.segment_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin() or exists (
    select 1
    from donor_segments
    join nonprofit_profiles on nonprofit_profiles.id = donor_segments.nonprofit_id
    where donor_segments.id = donor_segment_members.segment_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);

drop policy if exists team_members_visible_to_team on team_members;
create policy team_members_visible_to_team on team_members for select using (auth.uid() = user_id or is_admin());
drop policy if exists team_members_admin_owner_write on team_members;
create policy team_members_admin_owner_write on team_members for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id or is_admin());

drop policy if exists public_peer_fundraisers_read on peer_fundraisers;
create policy public_peer_fundraisers_read on peer_fundraisers for select using (true);
drop policy if exists peer_fundraisers_owner_write on peer_fundraisers;
create policy peer_fundraisers_owner_write on peer_fundraisers for all using (auth.uid() = fundraiser_id or is_admin()) with check (auth.uid() = fundraiser_id or is_admin());

drop policy if exists public_events_read on fundraising_events;
create policy public_events_read on fundraising_events for select using (status = 'published' or is_admin());
drop policy if exists events_owner_write on fundraising_events;
create policy events_owner_write on fundraising_events for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = fundraising_events.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = fundraising_events.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
drop policy if exists public_event_tickets_read on event_tickets;
create policy public_event_tickets_read on event_tickets for select using (true);
drop policy if exists event_tickets_owner_write on event_tickets;
create policy event_tickets_owner_write on event_tickets for all using (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = event_tickets.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = event_tickets.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);
drop policy if exists event_registrations_private on event_registrations;
create policy event_registrations_private on event_registrations for select using (auth.uid() = attendee_id or is_admin());
drop policy if exists event_registrations_insert_own on event_registrations;
create policy event_registrations_insert_own on event_registrations for insert with check (auth.uid() = attendee_id or attendee_id is null or is_admin());
drop policy if exists public_auction_items_read on auction_items;
create policy public_auction_items_read on auction_items for select using (true);
drop policy if exists auction_items_owner_write on auction_items;
create policy auction_items_owner_write on auction_items for all using (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = auction_items.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin() or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = auction_items.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);
drop policy if exists auction_bids_private on auction_bids;
create policy auction_bids_private on auction_bids for select using (auth.uid() = bidder_id or is_admin());
drop policy if exists auction_bids_insert_own on auction_bids;
create policy auction_bids_insert_own on auction_bids for insert with check (auth.uid() = bidder_id or bidder_id is null or is_admin());
drop policy if exists public_giving_days_read on giving_days;
create policy public_giving_days_read on giving_days for select using (true);
drop policy if exists giving_days_owner_write on giving_days;
create policy giving_days_owner_write on giving_days for all using (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = giving_days.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = giving_days.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
drop policy if exists public_livestreams_read on livestreams;
create policy public_livestreams_read on livestreams for select using (true);
drop policy if exists livestreams_owner_write on livestreams;
create policy livestreams_owner_write on livestreams for all using (
  is_admin()
  or exists (select 1 from campaigns where campaigns.id = livestreams.campaign_id and campaigns.user_id = auth.uid())
  or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = livestreams.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
) with check (
  is_admin()
  or exists (select 1 from campaigns where campaigns.id = livestreams.campaign_id and campaigns.user_id = auth.uid())
  or exists (
    select 1
    from fundraising_events
    join nonprofit_profiles on nonprofit_profiles.id = fundraising_events.nonprofit_id
    where fundraising_events.id = livestreams.event_id
    and nonprofit_profiles.owner_id = auth.uid()
  )
);

drop policy if exists public_membership_tiers_read on membership_tiers;
create policy public_membership_tiers_read on membership_tiers for select using (active or is_admin());
drop policy if exists membership_tiers_owner_write on membership_tiers;
create policy membership_tiers_owner_write on membership_tiers for all using (
  is_admin()
  or exists (select 1 from creator_profiles where creator_profiles.id = membership_tiers.creator_profile_id and creator_profiles.user_id = auth.uid())
  or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = membership_tiers.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
) with check (
  is_admin()
  or exists (select 1 from creator_profiles where creator_profiles.id = membership_tiers.creator_profile_id and creator_profiles.user_id = auth.uid())
  or exists (select 1 from nonprofit_profiles where nonprofit_profiles.id = membership_tiers.nonprofit_id and nonprofit_profiles.owner_id = auth.uid())
);
drop policy if exists member_subscriptions_private on member_subscriptions;
create policy member_subscriptions_private on member_subscriptions for select using (auth.uid() = member_id or is_admin());
drop policy if exists member_subscriptions_insert_own on member_subscriptions;
create policy member_subscriptions_insert_own on member_subscriptions for insert with check (auth.uid() = member_id or is_admin());
drop policy if exists public_exclusive_posts_read on exclusive_posts;
create policy public_exclusive_posts_read on exclusive_posts for select using (visibility = 'public' or is_admin());
drop policy if exists exclusive_posts_author_write on exclusive_posts;
create policy exclusive_posts_author_write on exclusive_posts for all using (auth.uid() = author_id or is_admin()) with check (auth.uid() = author_id or is_admin());
drop policy if exists direct_messages_private on direct_messages;
create policy direct_messages_private on direct_messages for select using (auth.uid() = sender_id or auth.uid() = recipient_id or is_admin());
drop policy if exists direct_messages_send on direct_messages;
create policy direct_messages_send on direct_messages for insert with check (auth.uid() = sender_id or is_admin());

drop policy if exists public_digital_products_read on digital_products;
create policy public_digital_products_read on digital_products for select using (active or is_admin());
drop policy if exists digital_products_creator_write on digital_products;
create policy digital_products_creator_write on digital_products for all using (
  is_admin() or exists (select 1 from creator_profiles where creator_profiles.id = digital_products.creator_profile_id and creator_profiles.user_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from creator_profiles where creator_profiles.id = digital_products.creator_profile_id and creator_profiles.user_id = auth.uid())
);
drop policy if exists product_orders_private on product_orders;
create policy product_orders_private on product_orders for select using (auth.uid() = buyer_id or is_admin());
drop policy if exists product_orders_insert_own on product_orders;
create policy product_orders_insert_own on product_orders for insert with check (auth.uid() = buyer_id or buyer_id is null or is_admin());
drop policy if exists commission_requests_private on commission_requests;
create policy commission_requests_private on commission_requests for select using (auth.uid() = requester_id or is_admin());
drop policy if exists commission_requests_insert_own on commission_requests;
create policy commission_requests_insert_own on commission_requests for insert with check (auth.uid() = requester_id or requester_id is null or is_admin());
drop policy if exists public_creator_tips_read on creator_tips;
create policy public_creator_tips_read on creator_tips for select using (true);
drop policy if exists creator_tips_insert_public on creator_tips;
create policy creator_tips_insert_public on creator_tips for insert with check (true);
drop policy if exists public_embedded_buttons_read on embedded_buttons;
create policy public_embedded_buttons_read on embedded_buttons for select using (true);
drop policy if exists embedded_buttons_owner_write on embedded_buttons;
create policy embedded_buttons_owner_write on embedded_buttons for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

drop policy if exists tax_receipts_private on tax_receipts;
create policy tax_receipts_private on tax_receipts for select using (auth.uid() = donor_id or is_admin());
drop policy if exists email_campaigns_owner_private on email_campaigns;
create policy email_campaigns_owner_private on email_campaigns for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
drop policy if exists sms_campaigns_owner_private on sms_campaigns;
create policy sms_campaigns_owner_private on sms_campaigns for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
drop policy if exists analytics_owner_private on analytics_snapshots;
create policy analytics_owner_private on analytics_snapshots for select using (auth.uid() = owner_id or is_admin());
drop policy if exists campaign_analytics_owner_private on campaign_analytics_events;
create policy campaign_analytics_owner_private on campaign_analytics_events for select using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_analytics_events.campaign_id and campaigns.user_id = auth.uid())
);
drop policy if exists integrations_owner_private on integration_connections;
create policy integrations_owner_private on integration_connections for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
drop policy if exists api_keys_owner_private on api_keys;
create policy api_keys_owner_private on api_keys for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());
drop policy if exists outbound_webhooks_owner_private on outbound_webhook_endpoints;
create policy outbound_webhooks_owner_private on outbound_webhook_endpoints for all using (auth.uid() = owner_id or is_admin()) with check (auth.uid() = owner_id or is_admin());

drop trigger if exists creator_profiles_set_updated_at on creator_profiles;
drop trigger if exists creator_profiles_set_updated_at on creator_profiles;
create trigger creator_profiles_set_updated_at before update on creator_profiles for each row execute function set_updated_at();
drop trigger if exists campaign_launch_settings_set_updated_at on campaign_launch_settings;
drop trigger if exists campaign_launch_settings_set_updated_at on campaign_launch_settings;
create trigger campaign_launch_settings_set_updated_at before update on campaign_launch_settings for each row execute function set_updated_at();
drop trigger if exists reward_tiers_set_updated_at on reward_tiers;
drop trigger if exists reward_tiers_set_updated_at on reward_tiers;
create trigger reward_tiers_set_updated_at before update on reward_tiers for each row execute function set_updated_at();
drop trigger if exists nonprofit_profiles_set_updated_at on nonprofit_profiles;
drop trigger if exists nonprofit_profiles_set_updated_at on nonprofit_profiles;
create trigger nonprofit_profiles_set_updated_at before update on nonprofit_profiles for each row execute function set_updated_at();
drop trigger if exists donation_forms_set_updated_at on donation_forms;
drop trigger if exists donation_forms_set_updated_at on donation_forms;
create trigger donation_forms_set_updated_at before update on donation_forms for each row execute function set_updated_at();
drop trigger if exists recurring_donations_set_updated_at on recurring_donations;
drop trigger if exists recurring_donations_set_updated_at on recurring_donations;
create trigger recurring_donations_set_updated_at before update on recurring_donations for each row execute function set_updated_at();
drop trigger if exists donor_crm_contacts_set_updated_at on donor_crm_contacts;
drop trigger if exists donor_crm_contacts_set_updated_at on donor_crm_contacts;
create trigger donor_crm_contacts_set_updated_at before update on donor_crm_contacts for each row execute function set_updated_at();
drop trigger if exists fundraising_events_set_updated_at on fundraising_events;
drop trigger if exists fundraising_events_set_updated_at on fundraising_events;
create trigger fundraising_events_set_updated_at before update on fundraising_events for each row execute function set_updated_at();
drop trigger if exists membership_tiers_set_updated_at on membership_tiers;
drop trigger if exists membership_tiers_set_updated_at on membership_tiers;
create trigger membership_tiers_set_updated_at before update on membership_tiers for each row execute function set_updated_at();
drop trigger if exists digital_products_set_updated_at on digital_products;
drop trigger if exists digital_products_set_updated_at on digital_products;
create trigger digital_products_set_updated_at before update on digital_products for each row execute function set_updated_at();


-- ============ 20260525130000_auth_profile_bootstrap.sql ============
-- Create public profiles automatically for new Supabase Auth users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_roles jsonb;
begin
  requested_roles := coalesce(new.raw_user_meta_data -> 'roles', '["donor"]'::jsonb);

  if jsonb_typeof(requested_roles) <> 'array' then
    requested_roles := '["donor"]'::jsonb;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    roles
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    requested_roles
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert
  with check (auth.uid() = id or public.is_admin());


-- ============ 20260527123000_contact_messages.sql ============
create table if not exists contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewing','closed','spam')),
  source text not null default 'contact_page',
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

drop policy if exists contact_messages_insert_public on contact_messages;
create policy contact_messages_insert_public on contact_messages
  for insert
  with check (true);

drop policy if exists contact_messages_admin_read on contact_messages;
create policy contact_messages_admin_read on contact_messages
  for select
  using (is_admin());

drop policy if exists contact_messages_admin_update on contact_messages;
create policy contact_messages_admin_update on contact_messages
  for update
  using (is_admin())
  with check (is_admin());

drop trigger if exists contact_messages_set_updated_at on contact_messages;
drop trigger if exists contact_messages_set_updated_at on contact_messages;
create trigger contact_messages_set_updated_at
  before update on contact_messages
  for each row execute function set_updated_at();


-- ============ 20260527140000_add_image_urls_to_campaigns.sql ============
-- Add image_urls array to campaigns table
-- Stores all uploaded campaign image CDN URLs (cover is still in cover_image_url for compat)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';


-- ============ 20260528113000_admin_settings_and_audit.sql ============
create table if not exists platform_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on audit_logs(actor_id);
create index if not exists audit_logs_target_idx on audit_logs(target_type, target_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

alter table platform_settings enable row level security;
alter table audit_logs enable row level security;

drop policy if exists platform_settings_admin_all on platform_settings;
drop policy if exists platform_settings_admin_all on platform_settings;
create policy platform_settings_admin_all on platform_settings
  for all using (is_admin()) with check (is_admin());

drop policy if exists audit_logs_admin_read on audit_logs;
drop policy if exists audit_logs_admin_read on audit_logs;
create policy audit_logs_admin_read on audit_logs
  for select using (is_admin());

drop policy if exists audit_logs_admin_insert on audit_logs;
drop policy if exists audit_logs_admin_insert on audit_logs;
create policy audit_logs_admin_insert on audit_logs
  for insert with check (is_admin());


-- ============ 20260528150000_campaigns_featured_pinned.sql ============
-- Add featured and pinned flags to campaigns for admin controls
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned   boolean NOT NULL DEFAULT false;


-- ============ 20260528160000_donations_extra_fields.sql ============
-- Add extra admin columns to donations table
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS payment_method  text,
  ADD COLUMN IF NOT EXISTS source          text,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS is_spam         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at     timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason   text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz;

-- Index for spam filtering
CREATE INDEX IF NOT EXISTS idx_donations_is_spam ON donations(is_spam) WHERE is_spam = true;


-- ============ 20260530000000_sponsors_table.sql ============
-- Sponsors table for homepage rotating logo bar
create table if not exists public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  website     text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.sponsors enable row level security;

-- Public read for active sponsors with logos
drop policy if exists "sponsors public read" on public.sponsors;
create policy "sponsors public read" on public.sponsors for select
  using (active = true);

-- Admin full access
drop policy if exists "sponsors admin all" on public.sponsors;
create policy "sponsors admin all" on public.sponsors for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists sponsors_updated_at on public.sponsors;
create trigger sponsors_updated_at
  before update on public.sponsors
  for each row execute function public.set_updated_at();


-- ============ 20260530100000_charitme_rebrand.sql ============
-- CharitMe rebrand migration
-- Safe: only renames columns/values, no data loss

-- Update default support email in admin_settings if it exists
update public.admin_settings
set value = replace(value::text, 'eli54u.com', 'charitme.com')::jsonb
where key in ('supportEmail', 'fromEmail', 'siteUrl', 'appUrl')
  and value::text ilike '%eli54u%';

-- Update any hardcoded GiveRise/eli54u references in branding settings
update public.admin_settings
set value = replace(replace(value::text, 'GiveRise', 'CharitMe'), 'eli54u.com', 'charitme.com')::jsonb
where value::text ilike '%GiveRise%' or value::text ilike '%eli54u%';

-- Update company_name in settings
insert into public.admin_settings (key, value, updated_at)
values
  ('companyName',    '"CharitMe"'::jsonb,                          now()),
  ('domain',         '"charitme.com"'::jsonb,                      now()),
  ('tagline',        '"The AI Fundraising Platform"'::jsonb,       now()),
  ('primaryMessage', '"Raise More. Faster. With AI."'::jsonb,      now()),
  ('supportEmail',   '"support@charitme.com"'::jsonb,              now()),
  ('fromEmail',      '"CharitMe <hello@charitme.com>"'::jsonb,     now()),
  ('siteUrl',        '"https://www.charitme.com"'::jsonb,          now())
on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;


-- ============ 20260530200000_clean_fake_stripe_accounts.sql ============
-- Remove fake/seed Stripe Connect account IDs that don't exist in production.
-- Seed data used sequential fake IDs like acct_d3d9446802a44259.
-- Real Stripe Connect accounts always start with 'acct_' followed by 16 alphanum chars.
-- We keep only accounts whose IDs look like real Stripe Connect accounts.
-- Safe: fundraisers can re-connect via /dashboard/payouts.

delete from public.connected_accounts
where stripe_account_id not similar to 'acct_[A-Za-z0-9]{16}';


-- ============ 20260531000000_update_campaign_categories.sql ============
-- Migrate campaign categories to the new 18-category taxonomy and add a CHECK constraint.
-- Old values that no longer exist are remapped to the closest equivalent.

-- 1. Remap old category values
update public.campaigns set category = 'Memorial'  where category = 'Memorial/Funeral';
update public.campaigns set category = 'Animal'    where category = 'Animal/Pet';
update public.campaigns set category = 'Sports'    where category = 'Sports/Teams';
-- 'Disaster Relief' folds into 'Emergency' (closest match)
update public.campaigns set category = 'Emergency' where category = 'Disaster Relief';
-- 'Other' has no direct equivalent; map to 'Community' as the broadest catch-all
update public.campaigns set category = 'Community' where category = 'Other';

-- 2. Add CHECK constraint enforcing the new allowed values
alter table public.campaigns drop constraint if exists campaigns_category_check;
alter table public.campaigns add constraint campaigns_category_check
  check (category in (
    'Medical','Memorial','Emergency','Nonprofit','Education','Animal',
    'Environment','Business','Community','Competition','Creative','Event',
    'Faith','Family','Sports','Travel','Volunteer','Wishes'
  ));


-- ============ 20260608000000_production_hardening.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Production hardening migration — 2026-06-08
-- Adds: decrement_campaign_stats, ledger entries on donation, notifications
-- Extended donation statuses, contacts table, platform_tips
-- ─────────────────────────────────────────────────────────────────────────────

-- ── decrement_campaign_stats RPC ─────────────────────────────────────────────
create or replace function public.decrement_campaign_stats(
  p_campaign_id uuid,
  p_amount_cents bigint
) returns void language plpgsql security definer as $$
begin
  update public.campaigns
  set raised_amount = greatest(0, raised_amount - p_amount_cents),
      backer_count  = greatest(0, backer_count  - 1),
      updated_at    = now()
  where id = p_campaign_id;
end; $$;

-- ── notifications table ───────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,  -- receipt, payout_paid, payout_failed, campaign_review, etc.
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_read_at on notifications(read_at) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notif_own_all on public.notifications;
create policy notif_own_all on public.notifications for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ── support_cases table ───────────────────────────────────────────────────────
create table if not exists public.support_cases (
  id            uuid primary key default uuid_generate_v4(),
  submitter_id  uuid references public.profiles(id) on delete set null,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  donation_id   uuid references public.donations(id) on delete set null,
  subject       text not null,
  body          text not null,
  status        text not null default 'open'
                  check (status in ('open','in_progress','resolved','closed')),
  assigned_to   uuid references public.profiles(id) on delete set null,
  priority      text not null default 'normal'
                  check (priority in ('low','normal','high','urgent')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.support_cases enable row level security;
drop policy if exists support_own_read on public.support_cases;
create policy support_own_read on public.support_cases for select
  using (auth.uid() = submitter_id or public.is_admin());
drop policy if exists support_own_insert on public.support_cases;
create policy support_own_insert on public.support_cases for insert
  with check (true);
drop policy if exists support_admin_update on public.support_cases;
create policy support_admin_update on public.support_cases for update
  using (public.is_admin());
drop trigger if exists set_updated_at_support_cases on public.support_cases;
create trigger set_updated_at_support_cases before update on public.support_cases
  for each row execute function public.set_updated_at();

-- ── support_notes table ───────────────────────────────────────────────────────
create table if not exists public.support_notes (
  id         uuid primary key default uuid_generate_v4(),
  case_id    uuid not null references public.support_cases(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  internal   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.support_notes enable row level security;
drop policy if exists notes_admin_all on public.support_notes;
create policy notes_admin_all on public.support_notes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists notes_own_read on public.support_notes;
create policy notes_own_read on public.support_notes for select
  using (not internal and exists (
    select 1 from public.support_cases sc
    where sc.id = case_id and sc.submitter_id = auth.uid()
  ));

-- ── beneficiary_invites table ─────────────────────────────────────────────────
create table if not exists public.beneficiary_invites (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  invited_by   uuid not null references public.profiles(id) on delete cascade,
  email        text not null,
  token        text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 32),
  accepted_at  timestamptz,
  beneficiary_id uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days')
);
alter table public.beneficiary_invites enable row level security;
drop policy if exists bi_own_read on public.beneficiary_invites;
create policy bi_own_read on public.beneficiary_invites for select
  using (auth.uid() = invited_by or auth.uid() = beneficiary_id or public.is_admin());
drop policy if exists bi_own_insert on public.beneficiary_invites;
create policy bi_own_insert on public.beneficiary_invites for insert
  with check (auth.uid() = invited_by or public.is_admin());
drop policy if exists bi_own_update on public.beneficiary_invites;
create policy bi_own_update on public.beneficiary_invites for update
  using (auth.uid() = beneficiary_id or public.is_admin());

-- ── Add missing donor_crm_contacts policies ───────────────────────────────────
-- (already done in schema.sql, safe to skip with IF NOT EXISTS guard)

-- ── Grant permissions on new tables ──────────────────────────────────────────
grant all on public.notifications         to anon, authenticated, service_role;
grant all on public.support_cases         to anon, authenticated, service_role;
grant all on public.support_notes         to anon, authenticated, service_role;
grant all on public.beneficiary_invites   to anon, authenticated, service_role;


-- ============ 20260608010000_admin_system_resource_usage.sql ============
create or replace function public.get_admin_system_resource_usage()
returns table(label text, value int, color text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with db as (
    select
      greatest(numbackends, 0)::numeric as active_connections,
      greatest(blks_hit, 0)::numeric as blks_hit,
      greatest(blks_read, 0)::numeric as blks_read
    from pg_stat_database
    where datname = current_database()
  ),
  limits as (
    select greatest(current_setting('max_connections')::numeric, 1) as max_connections
  ),
  webhook_health as (
    select
      count(*)::numeric as total_events,
      count(*) filter (where processing_error is null)::numeric as successful_events
    from public.webhook_events
    where created_at >= now() - interval '24 hours'
  )
  select
    'DB Connections'::text,
    least(100, round((db.active_connections / limits.max_connections) * 100)::int),
    '#6c35ff'::text
  from db, limits
  union all
  select
    'Cache Hit Rate'::text,
    case
      when db.blks_hit + db.blks_read = 0 then 100
      else least(100, round((db.blks_hit / (db.blks_hit + db.blks_read)) * 100)::int)
    end,
    '#19b86a'::text
  from db
  union all
  select
    'Webhook Success'::text,
    case
      when webhook_health.total_events = 0 then 100
      else least(100, round((webhook_health.successful_events / webhook_health.total_events) * 100)::int)
    end,
    '#2f80ed'::text
  from webhook_health;
$$;

grant execute on function public.get_admin_system_resource_usage() to authenticated;
grant execute on function public.get_admin_system_resource_usage() to service_role;


-- ============ 20260608010000_campaign_photos.sql ============
-- Migration: replace fake Unsplash seed URLs with real, free-to-use photo IDs
-- All photos licensed under the Unsplash License (free for commercial use, no attribution required)
-- https://unsplash.com/license

-- Helper: update campaigns by category using ARRAY syntax for image_urls
UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1504813184591-a058ada88eca?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Medical';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1588776814546-1ffbb172ef8c?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Emergency';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1487700160041-9253caa4b8de?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541804060688-9d8a5f44c0b8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Memorial';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607748851687-ba9a45146cd4?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Nonprofit';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488190211105-8fb0d4d54f0b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1513258496099-ee67191f698a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Education';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1450778869180-b6cd2c73b7e4?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518155317743-a8ff43ea6a5f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1548199973-ec2cb9df83fd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1561037393-60df89cbff99?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Animal';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1500534314209-a157a0f250c5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1573167243872-43c6433b9d40?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521335629791-ee9686c6bcb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1567521464027-f127ff144326?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Environment';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Business';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607748851687-ba9a45146cd4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Community';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1543326727-cf6c39bbae7c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560272564-d940dfc96483?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Competition';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1517697471339-4aa32003c11a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Creative';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1540575467537-65e2f10b68fc?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1529543544282-ea669407fca3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1511632765153-9b08cf6f0f1a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1501281668745-f7f57925be31?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Event';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1541804060688-9d8a5f44c0b8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1577083288073-40da2c536a75?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Faith';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1511895426328-dc8714191011?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1531983372617-9b612d2110c4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1476703993599-0035dd2b1397?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1609220361534-ebbe05e08d04?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Family';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1543326727-cf6c39bbae7c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560272564-d940dfc96483?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Sports';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1488085061851-1e7cf5c3b1e2?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Travel';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607748851687-ba9a45146cd4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Volunteer';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1511895426328-dc8714191011?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607748851687-ba9a45146cd4?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Wishes';

-- Fallback: any campaign with a NULL or empty cover that didn't match a category
UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607748851687-ba9a45146cd4?auto=format&fit=crop&w=800&q=80'
  ]
WHERE (cover_image_url IS NULL OR cover_image_url = '' OR cover_image_url LIKE '%1500000%')
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL OR array_length(image_urls, 1) = 0);


-- ============ 20260608020000_campaign_payment_observability.sql ============
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
drop trigger if exists audit_campaign_payments_write on public.campaign_payments;
create trigger audit_campaign_payments_write
  after insert or update on public.campaign_payments
  for each row execute function public.audit_campaign_payment_change();

drop trigger if exists audit_campaign_payment_reconciliation_write on public.campaign_payment_reconciliation;
drop trigger if exists audit_campaign_payment_reconciliation_write on public.campaign_payment_reconciliation;
create trigger audit_campaign_payment_reconciliation_write
  after insert or update on public.campaign_payment_reconciliation
  for each row execute function public.audit_campaign_payment_change();

drop policy if exists payment_processors_admin_all on public.payment_processors;
drop policy if exists payment_processors_admin_all on public.payment_processors;
create policy payment_processors_admin_all on public.payment_processors for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists payment_processors_owner_read on public.payment_processors;
drop policy if exists payment_processors_owner_read on public.payment_processors;
create policy payment_processors_owner_read on public.payment_processors for select using (auth.uid() is not null);

drop policy if exists processor_accounts_admin_all on public.processor_accounts;
drop policy if exists processor_accounts_admin_all on public.processor_accounts;
create policy processor_accounts_admin_all on public.processor_accounts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists processor_accounts_owner_read on public.processor_accounts;
drop policy if exists processor_accounts_owner_read on public.processor_accounts;
create policy processor_accounts_owner_read on public.processor_accounts for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists campaign_payments_admin_all on public.campaign_payments;
drop policy if exists campaign_payments_admin_all on public.campaign_payments;
create policy campaign_payments_admin_all on public.campaign_payments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_payments_owner_read on public.campaign_payments;
drop policy if exists campaign_payments_owner_read on public.campaign_payments;
create policy campaign_payments_owner_read on public.campaign_payments for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

drop policy if exists campaign_payment_breakdowns_admin_all on public.campaign_payment_breakdowns;
drop policy if exists campaign_payment_breakdowns_admin_all on public.campaign_payment_breakdowns;
create policy campaign_payment_breakdowns_admin_all on public.campaign_payment_breakdowns for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_payment_breakdowns_owner_read on public.campaign_payment_breakdowns;
drop policy if exists campaign_payment_breakdowns_owner_read on public.campaign_payment_breakdowns;
create policy campaign_payment_breakdowns_owner_read on public.campaign_payment_breakdowns for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

drop policy if exists campaign_owner_transfers_admin_all on public.campaign_owner_transfers;
drop policy if exists campaign_owner_transfers_admin_all on public.campaign_owner_transfers;
create policy campaign_owner_transfers_admin_all on public.campaign_owner_transfers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_owner_transfers_owner_read on public.campaign_owner_transfers;
drop policy if exists campaign_owner_transfers_owner_read on public.campaign_owner_transfers;
create policy campaign_owner_transfers_owner_read on public.campaign_owner_transfers for select using (public.campaign_payment_owner_can_read(campaign_id, campaign_owner_id));

drop policy if exists campaign_owner_payouts_admin_all on public.campaign_owner_payouts;
drop policy if exists campaign_owner_payouts_admin_all on public.campaign_owner_payouts;
create policy campaign_owner_payouts_admin_all on public.campaign_owner_payouts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_owner_payouts_owner_read on public.campaign_owner_payouts;
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


-- ============ 20260608020000_campaign_photos_fix.sql ============
-- Fix broken Unsplash photo IDs — all IDs in this migration have been verified HTTP 200.
-- Replaces previous migration 20260608010000_campaign_photos.sql for any category
-- that had broken images.

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Medical';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Emergency';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Memorial';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Nonprofit';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Education';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1518155317743-a8ff43ea6a5f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Animal';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1573167243872-43c6433b9d40?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1567521464027-f127ff144326?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Environment';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Business';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Community';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Competition';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1517697471339-4aa32003c11a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Creative';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Event';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Faith';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Family';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Sports';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Travel';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Volunteer';

UPDATE campaigns SET
  cover_image_url = 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=85',
  image_urls = ARRAY[
    'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'
  ]
WHERE category = 'Wishes';


-- ============ 20260608030000_grant_campaign_payment_observability_privileges.sql ============
-- Migration 20260608020000_campaign_payment_observability.sql created the campaign payment
-- observability tables but never granted table-level privileges to anon/authenticated/service_role
-- (unlike the base schema, which grants `all on all tables in schema public` once at setup time —
-- that grant does not retroactively apply to tables created by later migrations).
--
-- Result: supabaseAdmin (service_role) queries against these tables fail with
-- "permission denied for table campaign_payments" (42501), which payment-admin-data.ts
-- silently swallows (`const { data } = await query`), making /admin/payments/campaign-flows
-- render an all-zero empty state even when rows exist.
--
-- This grants the same privileges the base schema grants to existing tables, and sets
-- default privileges so future tables created by `postgres` are not affected by this gap again.

grant all on table
  public.payment_processors,
  public.processor_accounts,
  public.campaign_payments,
  public.campaign_payment_breakdowns,
  public.campaign_payment_events,
  public.campaign_processor_fees,
  public.campaign_platform_fees,
  public.campaign_owner_transfers,
  public.campaign_owner_payouts,
  public.campaign_payment_refunds,
  public.campaign_payment_disputes,
  public.campaign_payment_reconciliation,
  public.campaign_payment_webhook_events,
  public.campaign_payment_audit_logs,
  public.campaign_payment_admin_notes,
  public.campaign_payment_exports,
  public.campaign_payment_settings
to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to anon, authenticated, service_role;


-- ============ 20260608060000_supported_countries.sql ============
-- ── Supported Countries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supported_countries (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  flag_emoji   text        NOT NULL DEFAULT '',
  iso_code     text        NOT NULL DEFAULT '',
  can_fundraise boolean    NOT NULL DEFAULT false,
  can_donate   boolean     NOT NULL DEFAULT true,
  currency_code text       NOT NULL DEFAULT 'USD',
  notes        text,
  active       boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.supported_countries ENABLE ROW LEVEL SECURITY;

-- Public read (anyone can see the list)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'supported_countries'
      AND policyname = 'public_read_countries'
  ) THEN
    drop policy if exists "public_read_countries" on public.supported_countries;
create policy "public_read_countries" on public.supported_countries FOR SELECT USING (true);
  END IF;
END $$;

-- Only service role can write (admin API uses supabaseAdmin which bypasses RLS)
GRANT SELECT ON public.supported_countries TO anon, authenticated;


-- ============ 20260609000000_gofundme_audit_gaps.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- GoFundMe Parity Audit — Gap Remediation Migration
-- Date: 2026-06-09
-- Adds: accept_donations, deleted_at, visibility, UTM tracking, share_events,
--       donation_receipts, admin_notes, campaign_status_log, extended statuses
-- ─────────────────────────────────────────────────────────────────────────────

-- ── campaigns: accept_donations toggle ───────────────────────────────────────
alter table public.campaigns
  add column if not exists accept_donations boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','unlisted','private'));

-- Update public-read policy to exclude deleted campaigns and respect visibility
drop policy if exists campaigns_public_read on public.campaigns;
drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns for select using (
  (
    status = 'active'
    and visibility = 'public'
    and deleted_at is null
  )
  or auth.uid() = user_id
  or is_admin()
  or exists (
    select 1 from public.team_members tm
    where tm.campaign_id = id and tm.user_id = auth.uid()
  )
);

comment on column public.campaigns.accept_donations is
  'When false, the campaign page remains visible but the Donate button is hidden.';
comment on column public.campaigns.deleted_at is
  'Soft-delete timestamp. NULL = not deleted. Kept for compliance audit trail.';
comment on column public.campaigns.visibility is
  'public = discoverable; unlisted = only via direct link; private = organizer+team only';

-- ── donations: UTM / source attribution ──────────────────────────────────────
alter table public.donations
  add column if not exists source_utm jsonb not null default '{}'::jsonb;

comment on column public.donations.source_utm is
  'UTM parameters captured at donation time: {utm_source, utm_medium, utm_campaign, utm_content, referrer}';

-- ── refunds: extend status enum ──────────────────────────────────────────────
-- PostgreSQL CHECK constraints cannot be altered in-place; we must drop and recreate.
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check
  check (status in ('requested','under_review','approved','declined','processing','processed','failed','canceled'));

-- ── campaign_reports: extend status enum ─────────────────────────────────────
alter table public.campaign_reports drop constraint if exists campaign_reports_status_check;
alter table public.campaign_reports drop constraint if exists campaign_reports_status_check;
alter table public.campaign_reports add constraint campaign_reports_status_check
  check (status in ('open','triaged','investigating','info_requested','action_taken','resolved','dismissed','escalated'));

-- ── share_events ─────────────────────────────────────────────────────────────
create table if not exists public.share_events (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  sharer_id    uuid references public.profiles(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  channel      text not null default 'link'
                 check (channel in ('link','email','sms','facebook','twitter','instagram','linkedin','whatsapp','qr','other')),
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  referrer     text,
  ip_hash      text,
  converted    boolean not null default false,
  donation_id  uuid references public.donations(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_share_events_campaign on public.share_events(campaign_id, created_at desc);
create index if not exists idx_share_events_sharer on public.share_events(sharer_id) where sharer_id is not null;
alter table public.share_events enable row level security;
drop policy if exists share_insert_any on public.share_events;
create policy share_insert_any on public.share_events for insert with check (true);
drop policy if exists share_owner_read on public.share_events;
create policy share_owner_read on public.share_events for select
  using (
    is_admin()
    or auth.uid() = sharer_id
    or exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.campaign_id = share_events.campaign_id and tm.user_id = auth.uid())
  );
grant all on public.share_events to anon, authenticated, service_role;

-- ── donation_receipts ─────────────────────────────────────────────────────────
create table if not exists public.donation_receipts (
  id              uuid primary key default uuid_generate_v4(),
  donation_id     uuid not null references public.donations(id) on delete cascade,
  donor_id        uuid references public.profiles(id) on delete set null,
  campaign_id     uuid references public.campaigns(id) on delete cascade,
  receipt_number  text not null unique default 'RCP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 8),
  amount_cents    bigint not null,
  tip_cents       bigint not null default 0,
  processing_fee_cents bigint not null default 0,
  currency        text not null default 'usd',
  is_tax_deductible boolean not null default false,
  nonprofit_ein   text,
  campaign_title  text not null,
  donor_name      text,
  donor_email     text,
  email_sent_at   timestamptz,
  resent_at       timestamptz,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  receipt_type    text not null default 'donation'
                    check (receipt_type in ('donation','recurring','refund','tip')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_receipts_donation on public.donation_receipts(donation_id);
create index if not exists idx_receipts_donor on public.donation_receipts(donor_id) where donor_id is not null;
create index if not exists idx_receipts_campaign on public.donation_receipts(campaign_id);
alter table public.donation_receipts enable row level security;
drop policy if exists receipts_own_read on public.donation_receipts;
create policy receipts_own_read on public.donation_receipts for select
  using (auth.uid() = donor_id or is_admin()
         or exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid()));
drop policy if exists receipts_svc_insert on public.donation_receipts;
create policy receipts_svc_insert on public.donation_receipts for insert with check (true);
drop policy if exists receipts_admin_update on public.donation_receipts;
create policy receipts_admin_update on public.donation_receipts for update using (is_admin());
grant all on public.donation_receipts to anon, authenticated, service_role;

-- ── admin_notes ───────────────────────────────────────────────────────────────
create table if not exists public.admin_notes (
  id          uuid primary key default uuid_generate_v4(),
  author_id   uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('user','campaign','donation','payout','refund','dispute','support_case','report')),
  target_id   uuid not null,
  body        text not null,
  internal    boolean not null default true,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_admin_notes_target on public.admin_notes(target_type, target_id, created_at desc);
alter table public.admin_notes enable row level security;
drop policy if exists admin_notes_admin_all on public.admin_notes;
create policy admin_notes_admin_all on public.admin_notes for all using (is_admin()) with check (is_admin());
grant all on public.admin_notes to anon, authenticated, service_role;

-- ── campaign_status_log ───────────────────────────────────────────────────────
create table if not exists public.campaign_status_log (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  changed_by  uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status   text not null,
  reason      text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_status_log_campaign on public.campaign_status_log(campaign_id, created_at desc);
alter table public.campaign_status_log enable row level security;
drop policy if exists status_log_owner_read on public.campaign_status_log;
create policy status_log_owner_read on public.campaign_status_log for select
  using (is_admin() or exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid()));
drop policy if exists status_log_svc_insert on public.campaign_status_log;
create policy status_log_svc_insert on public.campaign_status_log for insert with check (true);
grant all on public.campaign_status_log to anon, authenticated, service_role;

-- ── nonprofit_profiles: add EIN verification status ──────────────────────────
alter table public.nonprofit_profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  add column if not exists tax_receipt_enabled boolean not null default false,
  add column if not exists country text not null default 'US',
  add column if not exists address text,
  add column if not exists public_profile_enabled boolean not null default true;

-- ── team_members: add invite token for co-organizer links ────────────────────
alter table public.team_members
  add column if not exists invite_token text unique default substr(md5(random()::text || clock_timestamp()::text), 1, 32),
  add column if not exists invite_email text,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists permissions jsonb not null default '{"post_updates":true,"thank_donors":true,"view_donors":true,"view_ledger":false,"manage_payout":false}'::jsonb;

comment on column public.team_members.permissions is
  'Fine-grained permission overrides for this team member beyond their role.';

-- ── Re-grant to PostgREST roles ───────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');


-- ============ 20260610000000_campaign_reward_tiers.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Campaign Reward / Perk Tiers (Kickstarter-style)
-- Date: 2026-06-10
-- Adds: campaign_rewards table, donations.reward_id, claim_campaign_reward RPC
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.campaign_rewards (
  id                 uuid primary key default uuid_generate_v4(),
  campaign_id        uuid not null references public.campaigns(id) on delete cascade,
  title              text not null,
  description        text,
  amount_cents       bigint not null check (amount_cents > 0),
  estimated_delivery text,
  item_limit         int check (item_limit is null or item_limit > 0),
  claimed_count      int not null default 0,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists idx_campaign_rewards_campaign on public.campaign_rewards(campaign_id, sort_order);

alter table public.campaign_rewards enable row level security;
drop policy if exists rewards_public_read on public.campaign_rewards;
create policy rewards_public_read on public.campaign_rewards for select using (true);
drop policy if exists rewards_owner_write on public.campaign_rewards;
create policy rewards_owner_write on public.campaign_rewards for insert with check
  (is_admin() or exists (select 1 from public.campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
drop policy if exists rewards_owner_update on public.campaign_rewards;
create policy rewards_owner_update on public.campaign_rewards for update using
  (is_admin() or exists (select 1 from public.campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
drop policy if exists rewards_owner_delete on public.campaign_rewards;
create policy rewards_owner_delete on public.campaign_rewards for delete using
  (is_admin() or exists (select 1 from public.campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));
grant all on public.campaign_rewards to anon, authenticated, service_role;

-- ── donations: link to claimed reward tier ───────────────────────────────────
alter table public.donations
  add column if not exists reward_id uuid references public.campaign_rewards(id) on delete set null;

comment on column public.donations.reward_id is
  'Reward/perk tier selected at checkout, if any (campaign_rewards.id).';

-- ── claim_campaign_reward RPC: atomically increments claimed_count ───────────
create or replace function public.claim_campaign_reward(p_reward_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.campaign_rewards set claimed_count = claimed_count + 1 where id = p_reward_id;
$$;
grant execute on function public.claim_campaign_reward(uuid) to anon, authenticated, service_role;

-- ── feature flag ──────────────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, description, rollout_pct) values
  ('reward_tiers', true, 'Kickstarter-style reward/perk tiers on campaigns', 100)
on conflict (key) do nothing;

-- ── Re-grant to PostgREST roles ───────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');


-- ============ 20260610000000_marketing_engine.sql ============
-- ═══════════════════════════════════════════════════════════════
-- CharitMe Marketing Engine — core schema
-- Contacts, identity resolution, events, segments, campaigns,
-- automations, templates, referrals, UTM, forms, consent, audit.
-- ═══════════════════════════════════════════════════════════════

-- ── Contacts: one row per person (identity-resolved) ──
create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  phone text,
  first_name text,
  last_name text,
  client_type text not null default 'visitor',          -- visitor|donor|repeat_donor|recurring_donor|high_value_donor|organizer|draft_organizer|beneficiary|nonprofit|newsletter|support|lead
  lifecycle_stage text not null default 'subscriber',   -- subscriber|lead|engaged|customer|champion|dormant
  country text,
  region text,
  preferred_causes text[] default '{}',
  preferred_channel text default 'email',
  first_touch_source text,
  first_touch_medium text,
  first_touch_campaign text,
  last_touch_source text,
  last_touch_medium text,
  last_touch_campaign text,
  landing_page text,
  lead_score int not null default 0,
  engagement_score int not null default 0,
  donor_value_cents bigint not null default 0,
  donation_count int not null default 0,
  churn_risk text default 'unknown',                    -- low|medium|high|unknown
  last_active_at timestamptz,
  status text not null default 'active',                -- active|unsubscribed|suppressed|archived
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketing_contacts_email_uq on public.marketing_contacts (lower(email)) where email is not null;
create index if not exists marketing_contacts_user_idx on public.marketing_contacts (user_id);
create index if not exists marketing_contacts_type_idx on public.marketing_contacts (client_type);
create index if not exists marketing_contacts_stage_idx on public.marketing_contacts (lifecycle_stage);
create index if not exists marketing_contacts_score_idx on public.marketing_contacts (lead_score desc);

-- ── Identities: every identifier that maps to a contact (stitching) ──
create table if not exists public.marketing_identities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  kind text not null,                                   -- email|phone|user_id|device_id|cookie_id
  value text not null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);
create index if not exists marketing_identities_contact_idx on public.marketing_identities (contact_id);

-- ── Events: behavioral stream feeding segments/scores/attribution ──
create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.marketing_contacts(id) on delete cascade,
  event_type text not null,                             -- page_viewed|campaign_viewed|donation_started|donation_abandoned|donation_completed|...
  campaign_id uuid,                                     -- fundraising campaign (campaigns.id)
  marketing_campaign_id uuid,                           -- marketing campaign
  amount_cents bigint,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  url text,
  device text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists marketing_events_contact_idx on public.marketing_events (contact_id, created_at desc);
create index if not exists marketing_events_type_idx on public.marketing_events (event_type, created_at desc);

-- ── Segments: dynamic rule-based audiences ──
create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '{"logic":"and","conditions":[]}',
  is_system boolean not null default false,
  member_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_segment_members (
  segment_id uuid not null references public.marketing_segments(id) on delete cascade,
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

-- ── Marketing campaigns (email/sms/social/multichannel) ──
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null default 'email',          -- email|sms|social|multichannel
  goal text,                                            -- reactivation|abandoned_donation|organizer_activation|...
  segment_id uuid references public.marketing_segments(id) on delete set null,
  template_id uuid,
  subject text,
  preview_text text,
  body text,
  status text not null default 'draft',                 -- draft|scheduled|sending|sent|paused|archived
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count int not null default 0,
  open_count int not null default 0,
  click_count int not null default 0,
  conversion_count int not null default 0,
  revenue_cents bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_status_idx on public.marketing_campaigns (status);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  status text not null default 'pending',               -- pending|sent|opened|clicked|converted|bounced|suppressed
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index if not exists marketing_recipients_campaign_idx on public.marketing_campaign_recipients (campaign_id, status);

-- ── Automations: trigger → action workflows ──
create table if not exists public.marketing_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_event text not null,                          -- donation_abandoned|campaign_published|payout_setup_incomplete|...
  trigger_config jsonb not null default '{}',           -- e.g. {"inactive_days": 30}
  action_type text not null,                            -- send_email|send_sms|create_task|add_to_segment|update_score|notify_admin
  action_config jsonb not null default '{}',            -- e.g. {"template_id": "..."}
  enabled boolean not null default false,
  run_count int not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.marketing_automations(id) on delete cascade,
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  status text not null default 'success',               -- success|skipped|failed
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_runs_automation_idx on public.marketing_automation_runs (automation_id, created_at desc);

-- ── Email templates ──
create table if not exists public.marketing_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general',             -- welcome|abandoned|reactivation|receipt_followup|seasonal|...
  subject text not null default '',
  preview_text text,
  body text not null default '',
  variables text[] default '{first_name,campaign_title,donation_amount}',
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── UTM links + referrals ──
create table if not exists public.marketing_utm_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination_url text not null,
  utm_source text not null,
  utm_medium text not null,
  utm_campaign text not null,
  utm_term text, utm_content text,
  short_code text unique,
  click_count int not null default 0,
  conversion_count int not null default 0,
  revenue_cents bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_contact_id uuid references public.marketing_contacts(id) on delete set null,
  code text not null unique,
  kind text not null default 'donor',                   -- donor|organizer|ambassador|corporate
  click_count int not null default 0,
  signup_count int not null default 0,
  donation_count int not null default 0,
  revenue_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ── Forms + submissions ──
create table if not exists public.marketing_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_type text not null default 'lead',               -- lead|newsletter|organizer_interest|nonprofit_interest|survey|popup
  fields jsonb not null default '["email"]',
  status text not null default 'active',
  submission_count int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references public.marketing_forms(id) on delete set null,
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  data jsonb not null default '{}',
  url text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_submissions_form_idx on public.marketing_form_submissions (form_id, created_at desc);

-- ── Consent + suppression ──
create table if not exists public.marketing_consent (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  channel text not null,                                -- email|sms
  granted boolean not null,
  source text,                                          -- form|checkout|preference_page|unsubscribe_link
  created_at timestamptz not null default now()
);
create index if not exists marketing_consent_contact_idx on public.marketing_consent (contact_id, channel, created_at desc);

create table if not exists public.marketing_suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  reason text not null default 'unsubscribed',          -- unsubscribed|bounced|complaint|manual
  created_at timestamptz not null default now()
);
create unique index if not exists marketing_suppression_email_uq on public.marketing_suppression_list (lower(email)) where email is not null;

-- ── Audit log ──
create table if not exists public.marketing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ── updated_at triggers ──
create or replace function public.marketing_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['marketing_contacts','marketing_segments','marketing_campaigns','marketing_automations','marketing_email_templates','marketing_forms']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.marketing_touch_updated_at()', t, t);
  end loop;
end $$;

-- ── RLS: marketing data is admin/service-role only; public writes go
--    through API routes using the service role after validation. ──
do $$
declare t text;
begin
  foreach t in array array[
    'marketing_contacts','marketing_identities','marketing_events','marketing_segments',
    'marketing_segment_members','marketing_campaigns','marketing_campaign_recipients',
    'marketing_automations','marketing_automation_runs','marketing_email_templates',
    'marketing_utm_links','marketing_referrals','marketing_forms','marketing_form_submissions',
    'marketing_consent','marketing_suppression_list','marketing_audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- No anon/authenticated policies: service role bypasses RLS, everyone else is denied.
  end loop;
end $$;

-- ── Seed: system segments ──
insert into public.marketing_segments (name, description, rules, is_system)
values
  ('Donors (one-time)', 'Contacts with exactly one completed donation',
   '{"logic":"and","conditions":[{"field":"donation_count","op":"eq","value":1}]}', true),
  ('Repeat donors', 'Contacts with 2+ completed donations',
   '{"logic":"and","conditions":[{"field":"donation_count","op":"gte","value":2}]}', true),
  ('High-value donors', 'Lifetime giving of $500+',
   '{"logic":"and","conditions":[{"field":"donor_value_cents","op":"gte","value":50000}]}', true),
  ('Abandoned donations', 'Started but never completed a donation',
   '{"logic":"and","conditions":[{"field":"event","op":"has","value":"donation_started"},{"field":"event","op":"not_has","value":"donation_completed"}]}', true),
  ('Draft organizers', 'Created a campaign draft but never published',
   '{"logic":"and","conditions":[{"field":"client_type","op":"eq","value":"draft_organizer"}]}', true),
  ('Dormant contacts', 'No activity in 60+ days',
   '{"logic":"and","conditions":[{"field":"inactive_days","op":"gte","value":60}]}', true),
  ('Newsletter subscribers', 'Opted in to the newsletter',
   '{"logic":"and","conditions":[{"field":"client_type","op":"eq","value":"newsletter"}]}', true)
on conflict do nothing;

-- ── Seed: system email templates ──
insert into public.marketing_email_templates (name, category, subject, preview_text, body, is_system)
values
  ('Welcome donor', 'welcome', 'Thank you for your generosity, {{first_name}}!', 'Your donation is already making a difference.',
   'Hi {{first_name}},\n\nThank you for supporting {{campaign_title}}. Your gift of {{donation_amount}} is on its way to the people who need it.\n\nFollow the campaign for updates — and know that 100% of your donation goes directly to the cause.\n\nWith gratitude,\nThe CharitMe Team', true),
  ('Abandoned donation reminder', 'abandoned', 'Your donation to {{campaign_title}} is waiting', 'It takes 30 seconds to finish.',
   'Hi {{first_name}},\n\nYou were about to support {{campaign_title}} — your donation is still waiting. It takes less than a minute to complete, and every dollar goes directly to the cause.\n\nFinish your donation: {{campaign_url}}\n\nThe CharitMe Team', true),
  ('Dormant donor reactivation', 'reactivation', 'The causes you care about still need you', 'See what changed since your last gift.',
   'Hi {{first_name}},\n\nIt has been a while! The {{preferred_cause}} campaigns you supported have new updates — and new neighbors who need help.\n\nSee campaigns near you: {{browse_url}}\n\nThe CharitMe Team', true),
  ('Campaign update reminder', 'organizer', 'Campaigns with updates raise 3x more', 'Post a 2-minute update today.',
   'Hi {{first_name}},\n\nYour campaign {{campaign_title}} has supporters waiting to hear from you. Campaigns that post weekly updates raise about 3x more.\n\nPost an update: {{update_url}}\n\nThe CharitMe Team', true),
  ('Payout setup reminder', 'beneficiary', 'Finish payout setup to receive your funds', 'Your money is ready — connect an account.',
   'Hi {{first_name}},\n\n{{campaign_title}} has raised funds for you, but your payout method is not connected yet. Connect a bank account, Venmo, Google Pay, or PayPal in under 2 minutes.\n\nFinish setup: {{payout_url}}\n\nThe CharitMe Team', true),
  ('Recurring upgrade ask', 'recurring', 'Make your impact monthly, {{first_name}}', '0% fees on monthly giving.',
   'Hi {{first_name}},\n\nYou have supported {{campaign_title}} before — a monthly gift of even $10 provides steady support organizers can count on, with 0% platform fees.\n\nGive monthly: {{campaign_url}}\n\nThe CharitMe Team', true),
  ('Seasonal giving appeal', 'seasonal', 'This season, your kindness goes further', 'Local campaigns that need help right now.',
   'Hi {{first_name}},\n\nThe giving season is here. These campaigns near you need a final push to reach their goals before the end of the year.\n\nBrowse campaigns: {{browse_url}}\n\nThe CharitMe Team', true)
on conflict do nothing;

-- ── Seed: starter automations (disabled until admin enables) ──
insert into public.marketing_automations (name, trigger_event, trigger_config, action_type, action_config, enabled)
values
  ('Abandoned donation rescue', 'donation_abandoned', '{"delay_hours": 4}', 'send_email', '{"template_category": "abandoned"}', false),
  ('Welcome new donors', 'donation_completed', '{"first_donation_only": true}', 'send_email', '{"template_category": "welcome"}', false),
  ('Dormant donor reactivation', 'donor_inactive', '{"inactive_days": 60}', 'send_email', '{"template_category": "reactivation"}', false),
  ('Organizer update nudge', 'no_update_posted', '{"days_since_update": 7}', 'send_email', '{"template_category": "organizer"}', false),
  ('Payout setup chaser', 'payout_setup_incomplete', '{"delay_hours": 24}', 'send_email', '{"template_category": "beneficiary"}', false),
  ('Recurring upgrade prompt', 'donation_completed', '{"min_donations": 2}', 'send_email', '{"template_category": "recurring"}', false)
on conflict do nothing;


-- ============ 20260610100000_multi_currency.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-currency expansion
-- Date: 2026-06-10
-- Adds: donations.currency so each donation records the currency it was
--       charged in (campaign currency comes from campaign_launch_settings).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.donations
  add column if not exists currency text not null default 'usd';

comment on column public.donations.currency is
  'ISO 4217 currency (lowercase) the donation was charged in via Stripe.';

-- ── feature flag ──────────────────────────────────────────────────────────────
insert into public.feature_flags (key, enabled, description, rollout_pct) values
  ('multi_currency', true, 'Campaign-level currency selection across 24 currencies', 100)
on conflict (key) do nothing;

-- ── Re-grant to PostgREST roles ───────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
select pg_notify('pgrst', 'reload schema');


-- ============ 20260610110000_enable_embedded_forms.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable embeddable donation widget for all users
-- Date: 2026-06-10
-- The /campaigns/[slug]/embed iframe page has been stable in production;
-- graduate the feature flag from 25% rollout to fully enabled.
-- ─────────────────────────────────────────────────────────────────────────────

update public.feature_flags
set enabled = true, rollout_pct = 100
where key = 'embedded_forms';

insert into public.feature_flags (key, enabled, description, rollout_pct) values
  ('embedded_forms', true, 'Embeddable donation widget', 100)
on conflict (key) do nothing;


-- ============ 20260611000000_ai_impact_ledger_and_trust_repair.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- AI Impact Ledger + Trust & Safety schema repair — 2026-06-11
--
-- 1. risk_flags: the live application code (admin/trust-safety page, the
--    /api/admin/trust/flags/[id]/resolve route, and the apply-schema tool)
--    reads/writes flag_type, description, resolved, resolved_by, resolved_at —
--    columns that were never added by the initial schema migration. Add them
--    and backfill flag_type from the legacy `code` column so the existing
--    Trust & Safety dashboard starts returning real data.
-- 2. admin_reviews: /api/admin/trust/reviews reads/writes an `action` column
--    that the initial schema never created. Add it.
-- 3. transparency_ledger_items: add AI summary / risk-review columns so the
--    Impact Ledger can be scored and gated by the new
--    /api/ai/impact-summary endpoint, and extend item_type to cover the
--    values the dashboard ledger UI already offers.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── risk_flags repair ─────────────────────────────────────────────────────────
alter table risk_flags
  add column if not exists flag_type text,
  add column if not exists description text,
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_by uuid references profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;

update risk_flags set flag_type = code where flag_type is null;
alter table risk_flags alter column flag_type set not null;

alter table risk_flags drop constraint if exists risk_flags_severity_check;
alter table risk_flags drop constraint if exists risk_flags_severity_check;
alter table risk_flags add constraint risk_flags_severity_check
  check (severity in ('low','medium','high','critical'));

create index if not exists risk_flags_flag_type_idx on risk_flags(flag_type);
create index if not exists risk_flags_resolved_idx on risk_flags(resolved);

-- ── admin_reviews repair ──────────────────────────────────────────────────────
alter table admin_reviews
  add column if not exists action text;

alter table admin_reviews drop constraint if exists admin_reviews_action_check;
alter table admin_reviews drop constraint if exists admin_reviews_action_check;
alter table admin_reviews add constraint admin_reviews_action_check
  check (action is null or action in ('approved','rejected','flagged','held','released'));

-- ── transparency_ledger_items: AI summary + review gating ───────────────────────
alter table transparency_ledger_items
  add column if not exists risk_score numeric,
  add column if not exists review_status text not null default 'auto_approved',
  add column if not exists reviewed_by uuid references profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists ai_generation_id uuid references ai_generations(id) on delete set null;

alter table transparency_ledger_items drop constraint if exists transparency_ledger_items_review_status_check;
alter table transparency_ledger_items drop constraint if exists transparency_ledger_items_review_status_check;
alter table transparency_ledger_items add constraint transparency_ledger_items_review_status_check
  check (review_status in ('auto_approved','pending_review','approved','rejected'));

alter table transparency_ledger_items drop constraint if exists transparency_ledger_items_item_type_check;
alter table transparency_ledger_items drop constraint if exists transparency_ledger_items_item_type_check;
alter table transparency_ledger_items add constraint transparency_ledger_items_item_type_check
  check (item_type in ('milestone','receipt','expense','payout','impact_update','offline_donation','other'));

create index if not exists ledger_review_status_idx on transparency_ledger_items(review_status);

-- ── transparency_ledger_items RLS: gate visibility on review_status ────────────
drop policy if exists ledger_public_read on transparency_ledger_items;
drop policy if exists ledger_public_read on transparency_ledger_items;
create policy ledger_public_read on transparency_ledger_items for select using (
  review_status in ('auto_approved','approved')
  or is_admin()
  or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid())
);

drop policy if exists ledger_owner_update on transparency_ledger_items;
drop policy if exists ledger_owner_update on transparency_ledger_items;
create policy ledger_owner_update on transparency_ledger_items for update
  using (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()))
  with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

drop policy if exists ledger_owner_delete on transparency_ledger_items;
drop policy if exists ledger_owner_delete on transparency_ledger_items;
create policy ledger_owner_delete on transparency_ledger_items for delete using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid())
);


-- ============ 20260611000000_organizer_marketing.sql ============
-- ═══════════════════════════════════════════════════════════════
-- Organizer Marketing — "My Supporters" + template-based
-- re-engagement sends, scoped to a single campaign.
-- Sends are template-constrained and recorded here for rate
-- limiting, history, and abuse review.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.organizer_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,              -- thank_recent|update_blast|lapsed_nudge|monthly_upgrade
  target_group text not null,              -- recent_donors|all_donors|lapsed_donors|one_time_donors
  subject text not null,
  body text not null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  suppressed_count int not null default 0,
  status text not null default 'sent',     -- sent|partial|failed
  created_at timestamptz not null default now()
);

create index if not exists organizer_sends_campaign_idx on public.organizer_sends (campaign_id, created_at desc);
create index if not exists organizer_sends_organizer_idx on public.organizer_sends (organizer_id, created_at desc);

alter table public.organizer_sends enable row level security;

-- Organizers can read their own send history; writes go through the API (service role).
drop policy if exists organizer_sends_select_own on public.organizer_sends;
drop policy if exists organizer_sends_select_own on public.organizer_sends;
create policy organizer_sends_select_own on public.organizer_sends
  for select using (auth.uid() = organizer_id);


-- ============ 20260611010000_payout_concierge.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- AI Payout Concierge + payouts schema repair — 2026-06-11
--
-- POST /api/payouts inserts `note` and updates `stripe_transfer_id` on the
-- payouts table, but the initial schema never created either column —
-- every payout request currently fails at the database layer. Add both
-- columns so the existing "Request Payout" flow works.
-- ─────────────────────────────────────────────────────────────────────────────

alter table payouts
  add column if not exists note text,
  add column if not exists stripe_transfer_id text;

create index if not exists payouts_stripe_transfer_id_idx on payouts(stripe_transfer_id);


-- ============ 20260611020000_ai_complaint_resolver.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- AI Complaint Resolver + support_cases schema repair — 2026-06-11
--
-- /api/admin/support/[id] sets status='escalated' and writes resolved_at /
-- escalated_at, none of which exist on support_cases. Two competing
-- `create table if not exists support_cases` definitions also leave
-- campaign_id / donation_id / assigned_to in question depending on
-- migration order. Repair the table additively so the existing admin
-- support flow works, then add columns for AI Complaint Resolver output.
-- ─────────────────────────────────────────────────────────────────────────────

alter table support_cases
  add column if not exists campaign_id uuid references campaigns(id) on delete set null,
  add column if not exists donation_id uuid references donations(id) on delete set null,
  add column if not exists assigned_to uuid references profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists source text not null default 'web',
  add column if not exists ai_triage jsonb,
  add column if not exists ai_generation_id uuid references ai_generations(id) on delete set null;

alter table support_cases drop constraint if exists support_cases_status_check;
alter table support_cases drop constraint if exists support_cases_status_check;
alter table support_cases add constraint support_cases_status_check
  check (status in ('open','in_progress','resolved','closed','escalated'));

alter table support_cases drop constraint if exists support_cases_source_check;
alter table support_cases drop constraint if exists support_cases_source_check;
alter table support_cases add constraint support_cases_source_check
  check (source in ('web','email','api'));

create index if not exists support_cases_campaign_id_idx on support_cases(campaign_id);
create index if not exists support_cases_assigned_to_idx on support_cases(assigned_to);
create index if not exists support_cases_status_idx on support_cases(status);


-- ============ 20260611030000_saved_campaigns.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Saved / favorited campaigns — donor-facing "save for later" feature
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists saved_campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, campaign_id)
);

create index if not exists saved_campaigns_user_id_idx on saved_campaigns(user_id);
create index if not exists saved_campaigns_campaign_id_idx on saved_campaigns(campaign_id);

alter table saved_campaigns enable row level security;

drop policy if exists saved_campaigns_owner_all on saved_campaigns;
drop policy if exists saved_campaigns_owner_all on saved_campaigns;
create policy saved_campaigns_owner_all on saved_campaigns for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());


-- ============ 20260611040000_donor_email_preferences.sql ============
-- Donor-facing email/notification preferences on profiles.
alter table profiles
  add column if not exists notification_email      boolean not null default true,
  add column if not exists notification_updates    boolean not null default true,
  add column if not exists notification_marketing  boolean not null default false;


-- ============ 20260611050000_donor_message_likes.sql ============
-- Likes/reactions on donor wall comments (donor_messages).
create table if not exists donor_message_likes (
  id                uuid primary key default uuid_generate_v4(),
  donor_message_id  uuid not null references donor_messages(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (donor_message_id, user_id)
);

create index if not exists donor_message_likes_message_id_idx on donor_message_likes(donor_message_id);
create index if not exists donor_message_likes_user_id_idx on donor_message_likes(user_id);

alter table donor_message_likes enable row level security;

drop policy if exists donor_message_likes_read_all on donor_message_likes;
drop policy if exists donor_message_likes_read_all on donor_message_likes;
create policy donor_message_likes_read_all on donor_message_likes for select using (true);

drop policy if exists donor_message_likes_owner_write on donor_message_likes;
drop policy if exists donor_message_likes_owner_write on donor_message_likes;
create policy donor_message_likes_owner_write on donor_message_likes for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());


-- ============ 20260611060000_avatars_bucket.sql ============
-- Storage bucket for user profile avatars, uploaded via POST /api/upload/profile-image.
-- Path convention: <user_id>/avatar.<ext> — mirrors the campaign-media bucket policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars owner upload" on storage.objects;
create policy "avatars owner upload" on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);


-- ============ 20260612000000_message_thread_state.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Message thread state — per-organizer read/archive tracking for donor
-- message threads shown on /dashboard/messages (Inbox / Unread / Archived tabs)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists message_thread_state (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  donor_id uuid not null references profiles(id) on delete cascade,
  archived boolean not null default false,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id, donor_id)
);

create index if not exists message_thread_state_owner_id_idx on message_thread_state(owner_id);

alter table message_thread_state enable row level security;

drop policy if exists message_thread_state_owner_all on message_thread_state;
drop policy if exists message_thread_state_owner_all on message_thread_state;
create policy message_thread_state_owner_all on message_thread_state for all
  using (auth.uid() = owner_id or is_admin())
  with check (auth.uid() = owner_id or is_admin());


-- ============ 20260612100000_business_leads.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- New Customers / Business Lead pipeline — 2026-06-12
--
-- Powers the Admin → "New Customers" page. Implements the lead pipeline:
--   New LLC filed → store here → AI enriches website/email/phone →
--   score lead → alert admin (via notifications).
--
-- 100% free: data is ingested from free sources (manual paste, the free
-- OpenCorporates tier, or generated sample filings) and enrichment uses the
-- platform's existing OpenAI integration with a deterministic free fallback.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.business_leads (
  id                uuid primary key default uuid_generate_v4(),

  -- ── Filing facts (from Secretary of State / free aggregators) ──
  business_name     text not null,
  entity_type       text,                       -- LLC, Corporation, etc.
  state             text,                       -- 2-letter state code
  filing_date       date,
  filing_status     text,                       -- Active, Pending, etc.
  registered_agent  text,
  owner_name        text,                       -- member / manager
  industry          text,
  address           text,
  source            text not null default 'manual',  -- manual | opencorporates | sample | api
  source_ref        text,                       -- external id / URL when available

  -- ── AI-enriched contact info ──
  website           text,
  email             text,
  phone             text,
  enrichment_notes  text,
  enrichment_model  text,                       -- 'fallback' or the OpenAI model id
  enriched_at       timestamptz,

  -- ── Lead scoring ──
  lead_score        integer not null default 0, -- 0-100
  lead_grade        text,                        -- A/B/C/D
  score_breakdown   jsonb not null default '{}'::jsonb,

  -- ── Pipeline workflow ──
  status            text not null default 'new'
                      check (status in ('new','enriched','contacted','qualified','converted','rejected')),
  alerted           boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Prevent duplicate filings for the same business in the same state.
create unique index if not exists business_leads_name_state_uniq
  on public.business_leads (lower(business_name), coalesce(upper(state), ''));

create index if not exists business_leads_status_idx      on public.business_leads (status);
create index if not exists business_leads_score_idx       on public.business_leads (lead_score desc);
create index if not exists business_leads_state_idx       on public.business_leads (state);
create index if not exists business_leads_created_at_idx  on public.business_leads (created_at desc);

alter table public.business_leads enable row level security;

-- Admin-only: this is internal BD data, never exposed to donors/organizers.
drop policy if exists business_leads_admin_all on public.business_leads;
drop policy if exists business_leads_admin_all on public.business_leads;
create policy business_leads_admin_all on public.business_leads for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists business_leads_set_updated_at on public.business_leads;
drop trigger if exists business_leads_set_updated_at on public.business_leads;
create trigger business_leads_set_updated_at before update on public.business_leads
  for each row execute function public.set_updated_at();

grant all on public.business_leads to anon, authenticated, service_role;


-- ============ 20260613000000_business_leads_marketing_link.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Tie New Customers business leads into the Marketing engine — 2026-06-13
--
-- When a lead is AI-enriched and a contact email is found, the lead gets
-- linked to a marketing_contacts row (client_type='lead', lifecycle_stage=
-- 'lead') so it can be targeted by Marketing → Campaigns. This migration:
--   1. adds business_leads.marketing_contact_id (set by lib/lead-enrichment),
--   2. seeds a system segment "New Business Leads" matching client_type='lead'.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.business_leads
  add column if not exists marketing_contact_id uuid references public.marketing_contacts(id) on delete set null;

create index if not exists business_leads_marketing_contact_idx on public.business_leads (marketing_contact_id);

insert into public.marketing_segments (name, description, rules, is_system)
values (
  'New Business Leads',
  'Newly-formed businesses discovered via state registry feeds and enriched with contact info — ready for outreach campaigns.',
  '{"logic":"and","conditions":[{"field":"client_type","op":"eq","value":"lead"}]}',
  true
)
on conflict do nothing;


-- ============ 20260613100000_marketing_campaign_tracking_links.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Per-campaign click-tracking links — 2026-06-13
--
-- Lets the campaign launch flow auto-create a /go/[code] tracking link per
-- marketing_campaigns row, so {{tracking_url}} in a campaign's body/subject
-- resolves to a unique, click-tracked URL that records link_clicked events
-- and marks marketing_campaign_recipients as 'clicked'.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.marketing_utm_links
  add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete cascade;

create unique index if not exists marketing_utm_links_campaign_id_key
  on public.marketing_utm_links (campaign_id)
  where campaign_id is not null;


-- ============ 20260614000000_lead_outreach.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Lead Outreach — Marketing → "Outreach" tab — 2026-06-14
--
-- Powers personal, 1:1 outreach to the New Customers / business-lead pipeline:
--   1. Each lead can be turned into an "outreach" with a UNIQUE tracking URL
--      (a /go/[code] short link), so we know exactly which lead clicked and
--      came back to the site.
--   2. The lead's email is validated (syntax, disposable/role-based domain,
--      MX best-effort) before we ever send.
--   3. Sends + clicks roll up onto the row so the admin sees the funnel:
--      drafted → ready → sent → clicked → converted.
--
-- Reuses the existing marketing engine: resolveContact() links the lead to a
-- marketing_contacts row, and marketing_utm_links + the /go/[code] route do the
-- click capture. This table is the per-lead outreach state on top of that.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.lead_outreach (
  id                   uuid primary key default uuid_generate_v4(),

  business_lead_id     uuid not null references public.business_leads(id) on delete cascade,
  marketing_contact_id uuid references public.marketing_contacts(id) on delete set null,
  utm_link_id          uuid references public.marketing_utm_links(id) on delete set null,
  short_code           text,

  channel              text not null default 'email',

  -- ── Composed message ──
  subject              text,
  body                 text,

  -- ── Email validation (heuristic + best-effort MX) ──
  email                text,                       -- snapshot of the address validated/sent to
  email_valid          boolean,
  email_validation     jsonb not null default '{}'::jsonb,
  email_validated_at   timestamptz,

  -- ── Funnel ──
  status               text not null default 'drafted'
                         check (status in ('drafted','ready','sent','clicked','converted','failed')),
  sent_at              timestamptz,
  first_click_at       timestamptz,
  last_click_at        timestamptz,
  click_count          integer not null default 0,

  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One active outreach record per lead (re-preparing upserts the same row).
create unique index if not exists lead_outreach_lead_uniq on public.lead_outreach (business_lead_id);
create index if not exists lead_outreach_status_idx        on public.lead_outreach (status);
create index if not exists lead_outreach_short_code_idx     on public.lead_outreach (short_code);
create index if not exists lead_outreach_contact_idx        on public.lead_outreach (marketing_contact_id);

alter table public.lead_outreach enable row level security;

-- Admin-only: internal BD data, never exposed to donors/organizers.
drop policy if exists lead_outreach_admin_all on public.lead_outreach;
drop policy if exists lead_outreach_admin_all on public.lead_outreach;
create policy lead_outreach_admin_all on public.lead_outreach for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists lead_outreach_set_updated_at on public.lead_outreach;
drop trigger if exists lead_outreach_set_updated_at on public.lead_outreach;
create trigger lead_outreach_set_updated_at before update on public.lead_outreach
  for each row execute function public.set_updated_at();

grant all on public.lead_outreach to anon, authenticated, service_role;


-- ============ 20260716000000_sponsorships.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Sponsorship marketplace — organizers post sponsorship opportunities; sponsors
-- (companies/individuals) send sponsorship requests with an offered amount.
--
-- Distinct from the admin-managed `sponsors` table (homepage logo strip). This is
-- a two-sided marketplace. Fully wired to Supabase with RLS + updated_at triggers.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── sponsorship_opportunities ────────────────────────────────────────────────
create table if not exists sponsorship_opportunities (
  id                  uuid primary key default uuid_generate_v4(),
  organizer_id        uuid not null references profiles(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete set null,
  title               text not null check (char_length(title) between 3 and 140),
  description         text not null check (char_length(description) between 10 and 8000),
  category            text not null default 'Community',
  benefits            text,
  min_amount_cents    bigint not null default 0 check (min_amount_cents >= 0),
  target_amount_cents bigint check (target_amount_cents is null or target_amount_cents >= 0),
  raised_amount_cents bigint not null default 0 check (raised_amount_cents >= 0),
  currency            text not null default 'USD',
  status              text not null default 'open'
                        check (status in ('draft','open','closed','fulfilled','cancelled')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (target_amount_cents is null or target_amount_cents >= min_amount_cents)
);

create index if not exists sponsorship_opportunities_status_idx    on sponsorship_opportunities(status);
create index if not exists sponsorship_opportunities_organizer_idx on sponsorship_opportunities(organizer_id);
create index if not exists sponsorship_opportunities_campaign_idx  on sponsorship_opportunities(campaign_id);

-- ── sponsorship_requests ─────────────────────────────────────────────────────
create table if not exists sponsorship_requests (
  id                 uuid primary key default uuid_generate_v4(),
  opportunity_id     uuid not null references sponsorship_opportunities(id) on delete cascade,
  sponsor_id         uuid not null references profiles(id) on delete cascade,
  company_name       text,
  amount_cents       bigint not null check (amount_cents > 0),
  message            text,
  benefits_requested text,
  status             text not null default 'pending'
                       check (status in ('pending','accepted','declined','withdrawn','fulfilled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (opportunity_id, sponsor_id)
);

create index if not exists sponsorship_requests_opportunity_idx on sponsorship_requests(opportunity_id);
create index if not exists sponsorship_requests_sponsor_idx     on sponsorship_requests(sponsor_id);
create index if not exists sponsorship_requests_status_idx      on sponsorship_requests(status);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists sponsorship_opportunities_updated_at on sponsorship_opportunities;
drop trigger if exists sponsorship_opportunities_updated_at on sponsorship_opportunities;
create trigger sponsorship_opportunities_updated_at before update on sponsorship_opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists sponsorship_requests_updated_at on sponsorship_requests;
drop trigger if exists sponsorship_requests_updated_at on sponsorship_requests;
create trigger sponsorship_requests_updated_at before update on sponsorship_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table sponsorship_opportunities enable row level security;
alter table sponsorship_requests      enable row level security;

-- opportunities: anyone may read publicly-listed ones; organizer/admin manage.
drop policy if exists sponsorship_opportunities_public_read on sponsorship_opportunities;
drop policy if exists sponsorship_opportunities_public_read on sponsorship_opportunities;
create policy sponsorship_opportunities_public_read on sponsorship_opportunities for select
  using (
    status in ('open','closed','fulfilled')
    or auth.uid() = organizer_id
    or is_admin()
  );

drop policy if exists sponsorship_opportunities_organizer_write on sponsorship_opportunities;
drop policy if exists sponsorship_opportunities_organizer_write on sponsorship_opportunities;
create policy sponsorship_opportunities_organizer_write on sponsorship_opportunities for all
  using (auth.uid() = organizer_id or is_admin())
  with check (auth.uid() = organizer_id or is_admin());

-- requests: readable by the sponsor, the opportunity's organizer, and admins.
drop policy if exists sponsorship_requests_read on sponsorship_requests;
drop policy if exists sponsorship_requests_read on sponsorship_requests;
create policy sponsorship_requests_read on sponsorship_requests for select
  using (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (
      select 1 from sponsorship_opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  );

drop policy if exists sponsorship_requests_insert on sponsorship_requests;
drop policy if exists sponsorship_requests_insert on sponsorship_requests;
create policy sponsorship_requests_insert on sponsorship_requests for insert
  with check (auth.uid() = sponsor_id);

drop policy if exists sponsorship_requests_update on sponsorship_requests;
drop policy if exists sponsorship_requests_update on sponsorship_requests;
create policy sponsorship_requests_update on sponsorship_requests for update
  using (
    auth.uid() = sponsor_id
    or is_admin()
    or exists (
      select 1 from sponsorship_opportunities o
      where o.id = opportunity_id and o.organizer_id = auth.uid()
    )
  );


-- ============ 20260718000000_privacy_requests.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Privacy request workflow (GDPR / CCPA) — data export + account deletion.
--
-- Users can request a data export (fulfilled immediately, self-serve) or account
-- deletion (queued for admin review + PII anonymization). Every request is an
-- auditable record. Fully wired with RLS.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists privacy_requests (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles(id) on delete cascade,
  type            text not null check (type in ('export','deletion')),
  status          text not null default 'pending'
                    check (status in ('pending','in_progress','completed','rejected','cancelled')),
  note            text,
  resolution_note text,
  resolver_id     uuid references profiles(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists privacy_requests_user_idx   on privacy_requests(user_id);
create index if not exists privacy_requests_status_idx on privacy_requests(status);

-- At most one active (pending/in_progress) request per user per type.
create unique index if not exists privacy_requests_active_uniq
  on privacy_requests(user_id, type)
  where status in ('pending','in_progress');

drop trigger if exists privacy_requests_updated_at on privacy_requests;
drop trigger if exists privacy_requests_updated_at on privacy_requests;
create trigger privacy_requests_updated_at before update on privacy_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table privacy_requests enable row level security;

-- Users read/manage their own requests; admins read/resolve all.
drop policy if exists privacy_requests_read on privacy_requests;
drop policy if exists privacy_requests_read on privacy_requests;
create policy privacy_requests_read on privacy_requests for select
  using (auth.uid() = user_id or is_admin());

drop policy if exists privacy_requests_insert on privacy_requests;
drop policy if exists privacy_requests_insert on privacy_requests;
create policy privacy_requests_insert on privacy_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists privacy_requests_update on privacy_requests;
drop policy if exists privacy_requests_update on privacy_requests;
create policy privacy_requests_update on privacy_requests for update
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());


-- ============ 20260719000000_grants.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Grants platform — grant discovery, AI matching, and application workflow
-- CHAR-0001. Additive: references existing profiles/campaigns only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Grant opportunities (public listings) ──────────────────────────────────────
create table if not exists grants (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text not null unique,
  title                 text not null,
  funder_name           text not null,
  funder_type           text not null default 'foundation'
                          check (funder_type in ('foundation','government','corporate','community','individual','other')),
  summary               text,
  description           text,
  category              text,
  focus_areas           text[] not null default '{}',
  eligibility           text,
  eligible_entity_types text[] not null default '{}',
  amount_min            bigint,           -- cents; null = unspecified
  amount_max            bigint,           -- cents; null = unspecified
  currency              text not null default 'USD',
  location              text,             -- human-readable geographic scope
  country               text,
  application_url       text,
  deadline_at           timestamptz,
  rolling_deadline      boolean not null default false,
  status                text not null default 'open'
                          check (status in ('open','upcoming','closed')),
  source                text,             -- provenance (import source / manual)
  created_by            uuid references profiles(id) on delete set null,
  verified              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint grants_amount_range check (amount_min is null or amount_max is null or amount_min <= amount_max)
);

create index if not exists grants_status_idx        on grants(status) where deleted_at is null;
create index if not exists grants_category_idx      on grants(category) where deleted_at is null;
create index if not exists grants_deadline_idx      on grants(deadline_at) where deleted_at is null;
create index if not exists grants_created_by_idx    on grants(created_by);
create index if not exists grants_focus_areas_gin   on grants using gin (focus_areas);

-- ── Additional deadlines / milestones per grant (LOI, full app, report) ─────────
create table if not exists grant_deadlines (
  id          uuid primary key default uuid_generate_v4(),
  grant_id    uuid not null references grants(id) on delete cascade,
  label       text not null,
  kind        text not null default 'application'
                check (kind in ('loi','application','report','award','other')),
  due_at      timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists grant_deadlines_grant_idx on grant_deadlines(grant_id);

-- ── Computed matches between a grant and a prospective applicant ────────────────
create table if not exists grant_matches (
  id          uuid primary key default uuid_generate_v4(),
  grant_id    uuid not null references grants(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  score       numeric(5,2) not null default 0,   -- 0..100
  reasons     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (grant_id, user_id, campaign_id)
);
create index if not exists grant_matches_user_idx  on grant_matches(user_id);
create index if not exists grant_matches_grant_idx on grant_matches(grant_id);

-- ── Grant applications ──────────────────────────────────────────────────────────
create table if not exists grant_applications (
  id                uuid primary key default uuid_generate_v4(),
  grant_id          uuid not null references grants(id) on delete cascade,
  applicant_user_id uuid not null references profiles(id) on delete cascade,
  campaign_id       uuid references campaigns(id) on delete set null,
  organization_name text,
  status            text not null default 'draft'
                      check (status in ('draft','submitted','under_review','awarded','rejected','withdrawn')),
  amount_requested  bigint,             -- cents
  narrative         text,
  answers           jsonb not null default '{}'::jsonb,
  submitted_at      timestamptz,
  decision_at       timestamptz,
  award_amount      bigint,             -- cents
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists grant_applications_applicant_idx on grant_applications(applicant_user_id) where deleted_at is null;
create index if not exists grant_applications_grant_idx     on grant_applications(grant_id) where deleted_at is null;
create index if not exists grant_applications_status_idx    on grant_applications(status) where deleted_at is null;

-- ── Documents attached to an application ────────────────────────────────────────
create table if not exists grant_documents (
  id             uuid primary key default uuid_generate_v4(),
  application_id uuid not null references grant_applications(id) on delete cascade,
  uploaded_by    uuid references profiles(id) on delete set null,
  file_url       text not null,
  file_name      text,
  doc_type       text,
  created_at     timestamptz not null default now()
);
create index if not exists grant_documents_application_idx on grant_documents(application_id);

-- ── updated_at triggers ─────────────────────────────────────────────────────────
drop trigger if exists grants_set_updated_at on grants;
drop trigger if exists grants_set_updated_at on grants;
create trigger grants_set_updated_at before update on grants
  for each row execute function set_updated_at();

drop trigger if exists grant_applications_set_updated_at on grant_applications;
drop trigger if exists grant_applications_set_updated_at on grant_applications;
create trigger grant_applications_set_updated_at before update on grant_applications
  for each row execute function set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────────
alter table grants             enable row level security;
alter table grant_deadlines    enable row level security;
alter table grant_matches      enable row level security;
alter table grant_applications enable row level security;
alter table grant_documents    enable row level security;

-- grants: anyone may read open/upcoming, non-deleted grants; creators manage their
-- own drafts/closed; admins manage everything.
drop policy if exists grants_public_read on grants;
drop policy if exists grants_public_read on grants;
create policy grants_public_read on grants for select
  using (deleted_at is null and status in ('open','upcoming'));

drop policy if exists grants_creator_read on grants;
drop policy if exists grants_creator_read on grants;
create policy grants_creator_read on grants for select
  using (created_by = auth.uid() or is_admin());

drop policy if exists grants_creator_write on grants;
drop policy if exists grants_creator_write on grants;
create policy grants_creator_write on grants for all
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- grant_deadlines: readable when the parent grant is visible; admin writes.
drop policy if exists grant_deadlines_read on grant_deadlines;
drop policy if exists grant_deadlines_read on grant_deadlines;
create policy grant_deadlines_read on grant_deadlines for select
  using (exists (select 1 from grants g where g.id = grant_id and g.deleted_at is null));

drop policy if exists grant_deadlines_admin_all on grant_deadlines;
drop policy if exists grant_deadlines_admin_all on grant_deadlines;
create policy grant_deadlines_admin_all on grant_deadlines for all
  using (is_admin()) with check (is_admin());

-- grant_matches: an applicant sees their own matches; admins see all.
drop policy if exists grant_matches_owner on grant_matches;
drop policy if exists grant_matches_owner on grant_matches;
create policy grant_matches_owner on grant_matches for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- grant_applications: applicant fully manages own; admins all.
drop policy if exists grant_applications_owner on grant_applications;
drop policy if exists grant_applications_owner on grant_applications;
create policy grant_applications_owner on grant_applications for all
  using (applicant_user_id = auth.uid() or is_admin())
  with check (applicant_user_id = auth.uid() or is_admin());

-- grant_documents: owner (via application) manages; admins all.
drop policy if exists grant_documents_owner on grant_documents;
drop policy if exists grant_documents_owner on grant_documents;
create policy grant_documents_owner on grant_documents for all
  using (
    exists (
      select 1 from grant_applications a
      where a.id = application_id and a.applicant_user_id = auth.uid()
    ) or is_admin()
  )
  with check (
    exists (
      select 1 from grant_applications a
      where a.id = application_id and a.applicant_user_id = auth.uid()
    ) or is_admin()
  );


-- ============ 20260719000000_matching_gifts.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Corporate matching gifts — companies run matching programs; employees submit
-- match claims for their donations; the company approves and the platform tracks
-- the matched amount against a per-employee annual cap. Fully wired with RLS.
--
-- (Prior state: only a static employer-match estimator widget existed — no
--  persistence, programs, claims, or approvals.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── matching_programs ────────────────────────────────────────────────────────
create table if not exists matching_programs (
  id                uuid primary key default uuid_generate_v4(),
  sponsor_id        uuid not null references profiles(id) on delete cascade,
  company_name      text not null check (char_length(company_name) between 2 and 160),
  description       text,
  match_ratio       numeric(6,2) not null default 1.0 check (match_ratio > 0 and match_ratio <= 100),
  annual_cap_cents  bigint not null default 0 check (annual_cap_cents >= 0),
  min_donation_cents bigint not null default 0 check (min_donation_cents >= 0),
  categories        text[] not null default '{}',
  currency          text not null default 'USD',
  status            text not null default 'active'
                      check (status in ('active','paused','closed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists matching_programs_status_idx  on matching_programs(status);
create index if not exists matching_programs_sponsor_idx on matching_programs(sponsor_id);

-- ── matching_claims ──────────────────────────────────────────────────────────
create table if not exists matching_claims (
  id                    uuid primary key default uuid_generate_v4(),
  program_id            uuid not null references matching_programs(id) on delete cascade,
  employee_id           uuid not null references profiles(id) on delete cascade,
  campaign_id           uuid references campaigns(id) on delete set null,
  donation_id           uuid references donations(id) on delete set null,
  donation_amount_cents bigint not null check (donation_amount_cents > 0),
  match_amount_cents    bigint not null default 0 check (match_amount_cents >= 0),
  status                text not null default 'pending'
                          check (status in ('pending','approved','declined','paid')),
  note                  text,
  reviewer_id           uuid references profiles(id) on delete set null,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists matching_claims_program_idx  on matching_claims(program_id);
create index if not exists matching_claims_employee_idx on matching_claims(employee_id);
create index if not exists matching_claims_status_idx   on matching_claims(status);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists matching_programs_updated_at on matching_programs;
drop trigger if exists matching_programs_updated_at on matching_programs;
create trigger matching_programs_updated_at before update on matching_programs
  for each row execute function public.set_updated_at();

drop trigger if exists matching_claims_updated_at on matching_claims;
drop trigger if exists matching_claims_updated_at on matching_claims;
create trigger matching_claims_updated_at before update on matching_claims
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table matching_programs enable row level security;
alter table matching_claims   enable row level security;

-- programs: anyone may read listed (active/paused/closed) programs; sponsor/admin manage.
drop policy if exists matching_programs_public_read on matching_programs;
drop policy if exists matching_programs_public_read on matching_programs;
create policy matching_programs_public_read on matching_programs for select
  using (status in ('active','paused','closed') or auth.uid() = sponsor_id or is_admin());

drop policy if exists matching_programs_sponsor_write on matching_programs;
drop policy if exists matching_programs_sponsor_write on matching_programs;
create policy matching_programs_sponsor_write on matching_programs for all
  using (auth.uid() = sponsor_id or is_admin())
  with check (auth.uid() = sponsor_id or is_admin());

-- claims: readable by the employee, the program sponsor, and admins.
drop policy if exists matching_claims_read on matching_claims;
drop policy if exists matching_claims_read on matching_claims;
create policy matching_claims_read on matching_claims for select
  using (
    auth.uid() = employee_id
    or is_admin()
    or exists (select 1 from matching_programs p where p.id = program_id and p.sponsor_id = auth.uid())
  );

drop policy if exists matching_claims_insert on matching_claims;
drop policy if exists matching_claims_insert on matching_claims;
create policy matching_claims_insert on matching_claims for insert
  with check (auth.uid() = employee_id);

drop policy if exists matching_claims_update on matching_claims;
drop policy if exists matching_claims_update on matching_claims;
create policy matching_claims_update on matching_claims for update
  using (
    auth.uid() = employee_id
    or is_admin()
    or exists (select 1 from matching_programs p where p.id = program_id and p.sponsor_id = auth.uid())
  );


-- ============ 20260719010000_volunteers.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Volunteers platform — opportunities, profiles, applications, hours (CHAR-0003)
-- Additive: references existing profiles/campaigns only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Volunteer opportunities (public listings) ──────────────────────────────────
create table if not exists volunteer_opportunities (
  id             uuid primary key default uuid_generate_v4(),
  slug           text not null unique,
  title          text not null,
  org_name       text not null,
  summary        text,
  description    text,
  category       text,
  skills         text[] not null default '{}',
  location       text,
  country        text,
  is_remote      boolean not null default false,
  starts_at      timestamptz,
  ends_at        timestamptz,
  slots          integer,                      -- null = unlimited
  slots_filled   integer not null default 0,
  time_commitment text,                        -- e.g. "4 hrs/week"
  contact_url    text,
  campaign_id    uuid references campaigns(id) on delete set null,
  status         text not null default 'open' check (status in ('open','upcoming','closed')),
  verified       boolean not null default false,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint volunteer_slots_nonneg check (slots is null or slots >= 0),
  constraint volunteer_dates check (starts_at is null or ends_at is null or starts_at <= ends_at)
);
create index if not exists vol_opp_status_idx   on volunteer_opportunities(status) where deleted_at is null;
create index if not exists vol_opp_category_idx on volunteer_opportunities(category) where deleted_at is null;
create index if not exists vol_opp_remote_idx   on volunteer_opportunities(is_remote) where deleted_at is null;
create index if not exists vol_opp_skills_gin   on volunteer_opportunities using gin (skills);
create index if not exists vol_opp_created_by_idx on volunteer_opportunities(created_by);

-- ── Volunteer profiles (one per user, optional) ────────────────────────────────
create table if not exists volunteer_profiles (
  user_id       uuid primary key references profiles(id) on delete cascade,
  headline      text,
  bio           text,
  skills        text[] not null default '{}',
  interests     text[] not null default '{}',
  location      text,
  country       text,
  availability  text,
  remote_ok     boolean not null default true,
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists vol_profile_skills_gin on volunteer_profiles using gin (skills);

-- ── Volunteer applications (user applies to an opportunity) ─────────────────────
create table if not exists volunteer_applications (
  id               uuid primary key default uuid_generate_v4(),
  opportunity_id   uuid not null references volunteer_opportunities(id) on delete cascade,
  applicant_user_id uuid not null references profiles(id) on delete cascade,
  message          text,
  status           text not null default 'applied'
                     check (status in ('applied','accepted','declined','withdrawn','completed')),
  hours_logged     numeric(7,2) not null default 0,
  hours_verified   boolean not null default false,
  applied_at       timestamptz not null default now(),
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (opportunity_id, applicant_user_id)
);
create index if not exists vol_app_applicant_idx on volunteer_applications(applicant_user_id) where deleted_at is null;
create index if not exists vol_app_opp_idx       on volunteer_applications(opportunity_id) where deleted_at is null;

-- ── updated_at triggers ─────────────────────────────────────────────────────────
drop trigger if exists vol_opp_set_updated_at on volunteer_opportunities;
drop trigger if exists vol_opp_set_updated_at on volunteer_opportunities;
create trigger vol_opp_set_updated_at before update on volunteer_opportunities
  for each row execute function set_updated_at();
drop trigger if exists vol_profile_set_updated_at on volunteer_profiles;
drop trigger if exists vol_profile_set_updated_at on volunteer_profiles;
create trigger vol_profile_set_updated_at before update on volunteer_profiles
  for each row execute function set_updated_at();
drop trigger if exists vol_app_set_updated_at on volunteer_applications;
drop trigger if exists vol_app_set_updated_at on volunteer_applications;
create trigger vol_app_set_updated_at before update on volunteer_applications
  for each row execute function set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────────
alter table volunteer_opportunities enable row level security;
alter table volunteer_profiles      enable row level security;
alter table volunteer_applications  enable row level security;

-- opportunities: public read of open/upcoming; creator + admin manage.
drop policy if exists vol_opp_public_read on volunteer_opportunities;
drop policy if exists vol_opp_public_read on volunteer_opportunities;
create policy vol_opp_public_read on volunteer_opportunities for select
  using (deleted_at is null and status in ('open','upcoming'));

drop policy if exists vol_opp_creator_read on volunteer_opportunities;
drop policy if exists vol_opp_creator_read on volunteer_opportunities;
create policy vol_opp_creator_read on volunteer_opportunities for select
  using (created_by = auth.uid() or is_admin());

drop policy if exists vol_opp_creator_write on volunteer_opportunities;
drop policy if exists vol_opp_creator_write on volunteer_opportunities;
create policy vol_opp_creator_write on volunteer_opportunities for all
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- profiles: public read when is_public; owner + admin manage own.
drop policy if exists vol_profile_public_read on volunteer_profiles;
drop policy if exists vol_profile_public_read on volunteer_profiles;
create policy vol_profile_public_read on volunteer_profiles for select
  using (is_public = true);

drop policy if exists vol_profile_owner on volunteer_profiles;
drop policy if exists vol_profile_owner on volunteer_profiles;
create policy vol_profile_owner on volunteer_profiles for all
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- applications: applicant + admin. (Opportunity-owner review access = follow-up.)
drop policy if exists vol_app_owner on volunteer_applications;
drop policy if exists vol_app_owner on volunteer_applications;
create policy vol_app_owner on volunteer_applications for all
  using (applicant_user_id = auth.uid() or is_admin())
  with check (applicant_user_id = auth.uid() or is_admin());


-- ============ 20260719120000_record_donation_idempotency_lock.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Fix a check-then-act race in record_donation that could double-count
-- donations when Stripe delivers the same webhook event concurrently.
--
-- record_donation previously did:
--   SELECT ... (idempotency read)  →  INSERT donation  →  UPDATE campaign totals
-- Two concurrent deliveries of the same checkout.session.completed could both
-- pass the SELECT, both INSERT, and both increment raised_amount/backer_count.
--
-- Fix: take a transaction-level advisory lock keyed on the payment identifiers
-- at the top of the function. Concurrent calls for the SAME donation serialize;
-- the second caller waits, then sees the already-inserted row and returns
-- 'already_processed' without touching campaign totals. Calls for DIFFERENT
-- donations hash to different keys and never block each other.
--
-- This intentionally avoids adding a UNIQUE constraint on donations, which
-- could fail to create against pre-existing rows that have NULL or duplicate
-- payment identifiers (e.g. offline/seed donations). The advisory lock is safe
-- to apply on any existing dataset.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.record_donation(
  p_stripe_event_id          text,
  p_campaign_id              uuid,
  p_donor_id                 uuid,
  p_amount_cents             bigint,
  p_tip_cents                bigint,
  p_processing_fee_cents     bigint,
  p_message                  text,
  p_anonymous                boolean,
  p_stripe_payment_intent_id text,
  p_stripe_checkout_session_id text
) returns jsonb language plpgsql security definer as $$
declare
  v_existing uuid;
  v_lock_key text;
begin
  -- Serialize concurrent processing of the SAME donation. Prefer the payment
  -- intent id, then the checkout session id, then the event id as the lock key
  -- so retried/duplicate deliveries collide while distinct donations do not.
  v_lock_key := coalesce(
    nullif(p_stripe_payment_intent_id, ''),
    nullif(p_stripe_checkout_session_id, ''),
    p_stripe_event_id
  );
  if v_lock_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
  end if;

  -- Idempotency check (now race-safe under the advisory lock above)
  select id into v_existing from donations
  where stripe_checkout_session_id = p_stripe_checkout_session_id
     or (stripe_payment_intent_id = p_stripe_payment_intent_id and p_stripe_payment_intent_id is not null)
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('status','already_processed','id', v_existing);
  end if;

  insert into donations (
    campaign_id, donor_id, amount_cents, tip_cents, processing_fee_cents,
    status, anonymous, message, stripe_payment_intent_id, stripe_checkout_session_id
  ) values (
    p_campaign_id, p_donor_id, p_amount_cents, p_tip_cents, p_processing_fee_cents,
    'completed', p_anonymous, p_message, p_stripe_payment_intent_id, p_stripe_checkout_session_id
  );

  update campaigns
  set raised_amount = raised_amount + p_amount_cents,
      backer_count  = backer_count  + 1,
      updated_at    = now()
  where id = p_campaign_id;

  insert into webhook_events (stripe_event_id, event_type, payload, processed_at)
  values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, now())
  on conflict (stripe_event_id) do nothing;

  return jsonb_build_object('status','recorded');
exception when others then
  insert into webhook_events (stripe_event_id, event_type, payload, processing_error)
  values (p_stripe_event_id, 'checkout.session.completed', '{}'::jsonb, sqlerrm)
  on conflict (stripe_event_id) do nothing;
  raise;
end; $$;


-- ============ 20260719130000_rate_limit_durable.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Durable, cross-instance rate limiting.
--
-- The application's in-memory rate limiter is per-serverless-instance, so on a
-- horizontally-scaled deployment the effective limit is multiplied by the
-- instance count. This table + RPC provide one shared counter so limits hold
-- across every instance. Called from lib/rate-limit-durable.ts via the service
-- role; there are no anon/authenticated policies (RLS on, service-role only).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limit_hits (
  key       text primary key,
  count     integer not null default 0,
  reset_at  timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_reset_at_idx on public.rate_limit_hits (reset_at);

alter table public.rate_limit_hits enable row level security;
-- No anon/authenticated policies: service role bypasses RLS, everyone else denied.

-- Atomic check-and-increment. A row lock (SELECT ... FOR UPDATE) serializes
-- concurrent calls for the same key so counting is race-free.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limit_hits;
begin
  select * into v_row from public.rate_limit_hits where key = p_key for update;

  if not found then
    insert into public.rate_limit_hits (key, count, reset_at, updated_at)
    values (p_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
    on conflict (key) do update
      set count = 1, reset_at = excluded.reset_at, updated_at = v_now;
    return true;
  end if;

  -- Window expired → start a fresh window.
  if v_row.reset_at <= v_now then
    update public.rate_limit_hits
      set count = 1, reset_at = v_now + make_interval(secs => p_window_seconds), updated_at = v_now
      where key = p_key;
    return true;
  end if;

  -- Within window and at/over the limit → deny.
  if v_row.count >= p_limit then
    return false;
  end if;

  update public.rate_limit_hits set count = count + 1, updated_at = v_now where key = p_key;
  return true;
end; $$;


-- ============ 20260720000000_events_platform.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Events product surface — extends the existing `fundraising_events` /
-- `event_tickets` / `event_registrations` data model (from the competitor-parity
-- migration) with the columns and check-in table needed for a self-serve,
-- organizer-owned events experience with free RSVP registration.
--
-- Additive + idempotent: safe on the live DB where the base tables already exist.
-- ─────────────────────────────────────────────────────────────────────────────

-- Organizer ownership + richer content on the existing events table.
alter table fundraising_events add column if not exists created_by  uuid references profiles(id) on delete set null;
alter table fundraising_events add column if not exists description  text;
alter table fundraising_events add column if not exists capacity     int;  -- null = unlimited
alter table fundraising_events add column if not exists cover_image_url text;

create index if not exists fundraising_events_created_by_idx on fundraising_events(created_by);
create index if not exists fundraising_events_status_starts_idx on fundraising_events(status, starts_at);

-- ── event_checkins ───────────────────────────────────────────────────────────
create table if not exists event_checkins (
  id              uuid primary key default uuid_generate_v4(),
  registration_id uuid not null unique references event_registrations(id) on delete cascade,
  event_id        uuid not null references fundraising_events(id) on delete cascade,
  checked_in_by   uuid references profiles(id) on delete set null,
  checked_in_at   timestamptz not null default now()
);

create index if not exists event_checkins_event_idx on event_checkins(event_id);

alter table event_checkins enable row level security;

-- Owner (event creator) + admin may read/write check-ins for their events.
drop policy if exists event_checkins_owner_all on event_checkins;
drop policy if exists event_checkins_owner_all on event_checkins;
create policy event_checkins_owner_all on event_checkins for all
  using (
    is_admin()
    or exists (select 1 from fundraising_events e where e.id = event_id and e.created_by = auth.uid())
  )
  with check (
    is_admin()
    or exists (select 1 from fundraising_events e where e.id = event_id and e.created_by = auth.uid())
  );

-- ── Owner-scoped policies on the existing tables (additive; OR'd with existing) ──
-- Event creators can manage their own events (existing policy already allows public
-- read of published events + admin).
drop policy if exists fundraising_events_owner_write on fundraising_events;
drop policy if exists fundraising_events_owner_write on fundraising_events;
create policy fundraising_events_owner_write on fundraising_events for all
  using (auth.uid() = created_by or is_admin())
  with check (auth.uid() = created_by or is_admin());

-- Registrations: the attendee, the event creator, and admins can read; attendees
-- create their own; the creator/admin can update (e.g. cancel).
drop policy if exists event_registrations_scoped_read on event_registrations;
drop policy if exists event_registrations_scoped_read on event_registrations;
create policy event_registrations_scoped_read on event_registrations for select
  using (
    auth.uid() = attendee_id
    or is_admin()
    or exists (select 1 from fundraising_events e where e.id = event_id and e.created_by = auth.uid())
  );

drop policy if exists event_registrations_attendee_insert on event_registrations;
drop policy if exists event_registrations_attendee_insert on event_registrations;
create policy event_registrations_attendee_insert on event_registrations for insert
  with check (auth.uid() = attendee_id or is_admin());


-- ============ 20260720120000_fix_profiles_pii_leak_and_campaigns_rls_recursion.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Security fix — two live-DB RLS defects found during anon-persona RLS
-- certification (2026-07-20). NOT auto-applied; apply deliberately after review.
--
-- FINDING A (HIGH — live PII/billing leak): profiles_read was `USING (true)`, so
--   any unauthenticated caller holding the public anon key (which ships in the
--   client bundle) could dump EVERY profile row — email, stripe_customer_id,
--   stripe_subscription_id, roles, plan, notification prefs — via
--   GET /rest/v1/profiles?select=email,... (502 rows returned in prod).
--   The app renders all public profile data via the service-role client
--   (supabaseAdmin), which bypasses RLS, so tightening the base-table policy to
--   own-or-admin does not change what the app displays; it only closes the
--   anon dump. If any TRULY public per-column profile surface is needed later,
--   add a dedicated view exposing only safe columns gated on show_public_profile.
--
-- FINDING B (MED — broken RLS / 500 landmine): campaigns_public_read recursed.
--   It did EXISTS(... team_members ...) while team_members.team_campaign_read
--   does EXISTS(... campaigns ...) → mutual recursion → 42P17 "infinite
--   recursion detected in policy for relation campaigns" on ANY RLS-enforced
--   SELECT of campaigns (anon or logged-in user). The app's public campaign
--   pages read via supabaseAdmin (RLS bypassed), so this is not a current
--   outage, but campaigns RLS is effectively non-functional and every anon/user
--   -key read of campaigns 500s. The subquery also had a bug:
--   `tm.campaign_id = tm.id` (should correlate to `campaigns.id`).
--   Fix: evaluate team membership through a SECURITY DEFINER helper (owner-
--   privileged, does not re-enter RLS), mirroring the existing is_admin() pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── FINDING A ────────────────────────────────────────────────────────────────
drop policy if exists profiles_read on profiles;
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  using (auth.uid() = id or is_admin());

-- ── FINDING B ────────────────────────────────────────────────────────────────
create or replace function public.is_campaign_team_member(p_campaign_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members tm
    where tm.campaign_id = p_campaign_id
      and tm.user_id = p_user_id
  );
$$;

drop policy if exists campaigns_public_read on campaigns;
drop policy if exists campaigns_public_read on campaigns;
create policy campaigns_public_read on campaigns for select
  using (
    (status = 'active' and visibility = 'public' and deleted_at is null)
    or auth.uid() = user_id
    or is_admin()
    or (auth.uid() is not null and public.is_campaign_team_member(id, auth.uid()))
  );


-- ============ 20260721000000_impact_tracking.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Impact tracking — how each campaign spends funds and the outcomes it delivers.
-- Powers the "Impact Intelligence" + "Transparency Score" pillars.
--
--   impact_plans        — one spending plan per campaign (planned budget)
--   impact_plan_items   — budget line items (planned vs actual spend)
--   impact_updates      — verified progress posts (optionally tied to spend)
--   impact_evidence     — proof attached to an update (receipt/photo/doc/link)
--   impact_metrics      — outcome metrics (target vs current)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ownership helper: does the current user own the given campaign?
create or replace function public.owns_campaign(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns c where c.id = cid and c.user_id = auth.uid());
$$;

-- ── impact_plans ─────────────────────────────────────────────────────────────
create table if not exists impact_plans (
  id                 uuid primary key default uuid_generate_v4(),
  campaign_id        uuid not null unique references campaigns(id) on delete cascade,
  created_by         uuid references profiles(id) on delete set null,
  title              text not null default 'Impact Plan',
  summary            text,
  total_budget_cents bigint not null default 0 check (total_budget_cents >= 0),
  status             text not null default 'draft' check (status in ('draft','published')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists impact_plan_items (
  id                  uuid primary key default uuid_generate_v4(),
  plan_id             uuid not null references impact_plans(id) on delete cascade,
  label               text not null,
  category            text,
  planned_amount_cents bigint not null default 0 check (planned_amount_cents >= 0),
  spent_amount_cents   bigint not null default 0 check (spent_amount_cents >= 0),
  sort                int not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists impact_plan_items_plan_idx on impact_plan_items(plan_id);

-- ── impact_updates + evidence ────────────────────────────────────────────────
create table if not exists impact_updates (
  id                uuid primary key default uuid_generate_v4(),
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  title             text not null check (char_length(title) between 2 and 200),
  body              text not null check (char_length(body) between 1 and 12000),
  amount_spent_cents bigint check (amount_spent_cents is null or amount_spent_cents >= 0),
  status            text not null default 'published' check (status in ('draft','published')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists impact_updates_campaign_idx on impact_updates(campaign_id);

create table if not exists impact_evidence (
  id         uuid primary key default uuid_generate_v4(),
  update_id  uuid not null references impact_updates(id) on delete cascade,
  kind       text not null default 'image' check (kind in ('image','receipt','video','document','link')),
  url        text not null,
  caption    text,
  created_at timestamptz not null default now()
);
create index if not exists impact_evidence_update_idx on impact_evidence(update_id);

-- ── impact_metrics ───────────────────────────────────────────────────────────
create table if not exists impact_metrics (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  label         text not null,
  unit          text,
  target_value  numeric,
  current_value numeric not null default 0,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists impact_metrics_campaign_idx on impact_metrics(campaign_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists impact_plans_updated_at on impact_plans;
drop trigger if exists impact_plans_updated_at on impact_plans;
create trigger impact_plans_updated_at before update on impact_plans
  for each row execute function public.set_updated_at();
drop trigger if exists impact_updates_updated_at on impact_updates;
drop trigger if exists impact_updates_updated_at on impact_updates;
create trigger impact_updates_updated_at before update on impact_updates
  for each row execute function public.set_updated_at();
drop trigger if exists impact_metrics_updated_at on impact_metrics;
drop trigger if exists impact_metrics_updated_at on impact_metrics;
create trigger impact_metrics_updated_at before update on impact_metrics
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — public read of published impact; campaign owner + admin write.
-- ─────────────────────────────────────────────────────────────────────────────
alter table impact_plans      enable row level security;
alter table impact_plan_items enable row level security;
alter table impact_updates    enable row level security;
alter table impact_evidence   enable row level security;
alter table impact_metrics    enable row level security;

drop policy if exists impact_plans_read on impact_plans;
drop policy if exists impact_plans_read on impact_plans;
create policy impact_plans_read on impact_plans for select
  using (status = 'published' or owns_campaign(campaign_id) or is_admin());
drop policy if exists impact_plans_write on impact_plans;
drop policy if exists impact_plans_write on impact_plans;
create policy impact_plans_write on impact_plans for all
  using (owns_campaign(campaign_id) or is_admin())
  with check (owns_campaign(campaign_id) or is_admin());

drop policy if exists impact_plan_items_read on impact_plan_items;
drop policy if exists impact_plan_items_read on impact_plan_items;
create policy impact_plan_items_read on impact_plan_items for select
  using (is_admin() or exists (
    select 1 from impact_plans p where p.id = plan_id
      and (p.status = 'published' or owns_campaign(p.campaign_id))));
drop policy if exists impact_plan_items_write on impact_plan_items;
drop policy if exists impact_plan_items_write on impact_plan_items;
create policy impact_plan_items_write on impact_plan_items for all
  using (is_admin() or exists (select 1 from impact_plans p where p.id = plan_id and owns_campaign(p.campaign_id)))
  with check (is_admin() or exists (select 1 from impact_plans p where p.id = plan_id and owns_campaign(p.campaign_id)));

drop policy if exists impact_updates_read on impact_updates;
drop policy if exists impact_updates_read on impact_updates;
create policy impact_updates_read on impact_updates for select
  using (status = 'published' or owns_campaign(campaign_id) or is_admin());
drop policy if exists impact_updates_write on impact_updates;
drop policy if exists impact_updates_write on impact_updates;
create policy impact_updates_write on impact_updates for all
  using (owns_campaign(campaign_id) or is_admin())
  with check (owns_campaign(campaign_id) or is_admin());

drop policy if exists impact_evidence_read on impact_evidence;
drop policy if exists impact_evidence_read on impact_evidence;
create policy impact_evidence_read on impact_evidence for select
  using (is_admin() or exists (
    select 1 from impact_updates u where u.id = update_id
      and (u.status = 'published' or owns_campaign(u.campaign_id))));
drop policy if exists impact_evidence_write on impact_evidence;
drop policy if exists impact_evidence_write on impact_evidence;
create policy impact_evidence_write on impact_evidence for all
  using (is_admin() or exists (select 1 from impact_updates u where u.id = update_id and owns_campaign(u.campaign_id)))
  with check (is_admin() or exists (select 1 from impact_updates u where u.id = update_id and owns_campaign(u.campaign_id)));

drop policy if exists impact_metrics_read on impact_metrics;
drop policy if exists impact_metrics_read on impact_metrics;
create policy impact_metrics_read on impact_metrics for select
  using (owns_campaign(campaign_id) or is_admin() or exists (
    select 1 from campaigns c where c.id = campaign_id and c.status = 'active' and c.visibility = 'public'));
drop policy if exists impact_metrics_write on impact_metrics;
drop policy if exists impact_metrics_write on impact_metrics;
create policy impact_metrics_write on impact_metrics for all
  using (owns_campaign(campaign_id) or is_admin())
  with check (owns_campaign(campaign_id) or is_admin());


-- ============ 20260722000000_gamification.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Gamification persistence — earned badges + community challenges.
--
-- The badge CATALOG stays in code (`lib/gamification.ts` DONOR_BADGES); this
-- persists which badges each user has EARNED, plus joinable challenges and
-- per-user progress. Badges/challenges are public recognition (public read).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── user_badges ──────────────────────────────────────────────────────────────
create table if not exists user_badges (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  badge_id   text not null,               -- matches DONOR_BADGES[].id in code
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
create index if not exists user_badges_user_idx on user_badges(user_id);

-- ── challenges ───────────────────────────────────────────────────────────────
create table if not exists challenges (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  title       text not null,
  description text,
  metric      text not null default 'donation_count'
                check (metric in ('donation_count','total_cents','campaign_count')),
  goal_value  bigint not null check (goal_value > 0),
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      text not null default 'active' check (status in ('draft','active','completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists challenges_status_idx on challenges(status);

-- ── challenge_participants ───────────────────────────────────────────────────
create table if not exists challenge_participants (
  id             uuid primary key default uuid_generate_v4(),
  challenge_id   uuid not null references challenges(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  progress_value bigint not null default 0 check (progress_value >= 0),
  joined_at      timestamptz not null default now(),
  completed_at   timestamptz,
  unique (challenge_id, user_id)
);
create index if not exists challenge_participants_challenge_idx on challenge_participants(challenge_id);
create index if not exists challenge_participants_user_idx on challenge_participants(user_id);

drop trigger if exists challenges_updated_at on challenges;
drop trigger if exists challenges_updated_at on challenges;
create trigger challenges_updated_at before update on challenges
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
alter table user_badges            enable row level security;
alter table challenges             enable row level security;
alter table challenge_participants enable row level security;

-- Badges are public recognition; the owner (and admin) manage their own rows.
drop policy if exists user_badges_public_read on user_badges;
drop policy if exists user_badges_public_read on user_badges;
create policy user_badges_public_read on user_badges for select using (true);
drop policy if exists user_badges_owner_write on user_badges;
drop policy if exists user_badges_owner_write on user_badges;
create policy user_badges_owner_write on user_badges for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- Challenges: public read of listed ones; admin-managed.
drop policy if exists challenges_public_read on challenges;
drop policy if exists challenges_public_read on challenges;
create policy challenges_public_read on challenges for select
  using (status in ('active','completed') or is_admin());
drop policy if exists challenges_admin_write on challenges;
drop policy if exists challenges_admin_write on challenges;
create policy challenges_admin_write on challenges for all
  using (is_admin()) with check (is_admin());

-- Participation is public (for leaderboards); the participant manages their row.
drop policy if exists challenge_participants_public_read on challenge_participants;
drop policy if exists challenge_participants_public_read on challenge_participants;
create policy challenge_participants_public_read on challenge_participants for select using (true);
drop policy if exists challenge_participants_owner_write on challenge_participants;
drop policy if exists challenge_participants_owner_write on challenge_participants;
create policy challenge_participants_owner_write on challenge_participants for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- ── Seed a few starter challenges (idempotent by slug) ───────────────────────
insert into challenges (slug, title, description, metric, goal_value, status)
values
  ('first-five-gifts', 'Give Five', 'Make five donations to any causes you care about.', 'donation_count', 5, 'active'),
  ('hundred-dollar-hero', '$100 Hero', 'Donate $100 in total across the community.', 'total_cents', 10000, 'active'),
  ('three-cause-champion', 'Three-Cause Champion', 'Support three different campaigns.', 'campaign_count', 3, 'active')
on conflict (slug) do nothing;


-- ============ 20260723000000_financial_ledger.sql ============
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
drop trigger if exists ledger_entries_no_update on ledger_entries;
create trigger ledger_entries_no_update before update on ledger_entries
  for each row execute function public.prevent_ledger_mutation();
drop trigger if exists ledger_entries_no_delete on ledger_entries;
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
drop trigger if exists reconciliation_exceptions_updated_at on reconciliation_exceptions;
create trigger reconciliation_exceptions_updated_at before update on reconciliation_exceptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — financial internals: admin only (service role bypasses).
-- ─────────────────────────────────────────────────────────────────────────────
alter table ledger_entries            enable row level security;
alter table reconciliation_exceptions enable row level security;

drop policy if exists ledger_entries_admin_read on ledger_entries;
drop policy if exists ledger_entries_admin_read on ledger_entries;
create policy ledger_entries_admin_read on ledger_entries for select using (is_admin());
-- No insert/update/delete policy for end users: writes happen via service role only,
-- and the immutability trigger blocks update/delete even for the service role.

drop policy if exists reconciliation_exceptions_admin_all on reconciliation_exceptions;
drop policy if exists reconciliation_exceptions_admin_all on reconciliation_exceptions;
create policy reconciliation_exceptions_admin_all on reconciliation_exceptions for all
  using (is_admin()) with check (is_admin());


-- ============ 20260723000000_rls_hardening_admin_tables.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS hardening — admin/finance/marketing tables (security audit, §6.2)
--
-- These 34 tables are accessed EXCLUSIVELY through the service-role client
-- (`supabaseAdmin`) in server-only API routes, libs, and the Stripe webhook —
-- verified: zero anon/authenticated (`createClient`/browser) access anywhere in
-- the app. Yet they had no `enable row level security` declaration, and the
-- schema-cache-reload path grants `anon`/`authenticated` broad table privileges,
-- so without RLS they could be read directly via PostgREST.
--
-- Enabling RLS with NO policies = deny-all except the service role, which BYPASSES
-- RLS. This is therefore non-breaking (every existing admin/webhook/marketing
-- path uses the service role) and closes the direct-PostgREST exposure while
-- making the intent explicit in-schema. Idempotent + guarded by table existence.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  admin_only_tables text[] := array[
    -- Campaign payment / finance (service-role only)
    'campaign_owner_payouts',
    'campaign_owner_transfers',
    'campaign_payment_admin_notes',
    'campaign_payment_audit_logs',
    'campaign_payment_breakdowns',
    'campaign_payment_disputes',
    'campaign_payment_events',
    'campaign_payment_exports',
    'campaign_payment_reconciliation',
    'campaign_payment_refunds',
    'campaign_payment_settings',
    'campaign_payment_webhook_events',
    'campaign_payments',
    'campaign_platform_fees',
    'campaign_processor_fees',
    'payment_processors',
    'processor_accounts',
    -- Marketing engine (service-role only)
    'marketing_audit_logs',
    'marketing_automation_runs',
    'marketing_automations',
    'marketing_campaign_recipients',
    'marketing_campaigns',
    'marketing_consent',
    'marketing_contacts',
    'marketing_email_templates',
    'marketing_events',
    'marketing_form_submissions',
    'marketing_forms',
    'marketing_identities',
    'marketing_referrals',
    'marketing_segment_members',
    'marketing_segments',
    'marketing_suppression_list',
    'marketing_utm_links'
  ];
begin
  foreach t in array admin_only_tables loop
    if to_regclass('public.' || t) is not null then
      -- Idempotent: no-op if RLS is already enabled. service_role bypasses RLS
      -- (BYPASSRLS); anon/authenticated are denied by the no-policy default.
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- No policies are created intentionally: with RLS enabled and no policies, only
-- the service role (which bypasses RLS) can read/write these tables — matching
-- the verified access pattern. If a future feature needs anon/authenticated
-- access to any of these, add an explicit, scoped policy in a new migration.


-- ============ 20260724000000_reconcile_legacy_column_drift.sql ============
-- ─────────────────────────────────────────────────────────────────────────────
-- Legacy column-drift reconciliation (LB-001)
--
-- The live database was created from an old schema snapshot, so some tables that
-- predate the nonprofit CRM features are missing columns that later migrations
-- (esp. 20260525002000_competitor_parity_features) assume exist. Those
-- migrations reference `nonprofit_id` in indexes/policies on EXISTING tables and
-- fail with 42703, rolling back all of their table creation.
--
-- This migration adds the missing columns idempotently so the feature migrations
-- can roll forward. Purely additive (add column if not exists) — no drops, no
-- data loss. Safe on clean and existing databases.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.donor_crm_contacts
  add column if not exists nonprofit_id uuid references public.nonprofit_profiles(id) on delete cascade;

alter table if exists public.recurring_donations
  add column if not exists nonprofit_id uuid references public.nonprofit_profiles(id) on delete cascade;
