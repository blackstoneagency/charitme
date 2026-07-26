-- ─────────────────────────────────────────────────────────────────────────────
-- Generates the migration for the 61 columns that exist in the live database but
-- in no migration (see __tests__/fixtures/schema-migration-drift-baseline.json
-- and __tests__/migrations-reproduce-schema.test.ts).
--
-- These could not be written from the sandbox because the committed snapshot
-- stores column NAMES only. Types must come from the database itself -- guessing
-- 'tip_cents' as text rather than integer would yield a database that looks
-- correct and behaves differently.
--
-- HOW TO USE
--   1. Run this whole file in the Supabase SQL editor (or psql) against the LIVE
--      database. It only READS information_schema; it changes nothing.
--   2. Copy the single text column it returns.
--   3. Save it as supabase/migrations/<timestamp>_backfill_drifted_columns.sql
--   4. Run:  python3 scripts/build_catchup.py
--   5. Regenerate the drift baseline (it should become empty) and run the tests:
--        npm test --workspace=apps/web
--      migrations-reproduce-schema.test.ts will fail until the baseline is
--      shrunk, which is the intended nudge.
--
-- Every emitted statement is 'add column if not exists', so applying the result
-- to the live database is a no-op; it only matters for a fresh provision.
--
-- NOT EXECUTED: this file was written in a sandbox with no Postgres server
-- (psql is present but initdb/pg_ctl are not), so the query has been carefully
-- constructed but never run. It is read-only -- it touches only pg_catalog -- so
-- the worst case is a syntax error you see immediately.
-- ─────────────────────────────────────────────────────────────────────────────

with wanted(table_name, column_name) as (
  values
    ('ai_generations','result'),
    ('ai_generations','tokens_used'),
    ('audit_logs','ip_address'),
    ('audit_logs','user_agent'),
    ('campaign_media','alt_text'),
    ('campaign_media','caption'),
    ('campaign_media','sort_order'),
    ('campaign_reports','resolved_at'),
    ('campaign_reports','resolved_by'),
    ('campaign_updates','published_at'),
    ('campaign_updates','scheduled_at'),
    ('campaign_updates','updated_at'),
    ('campaigns','ai_generated'),
    ('campaigns','location'),
    ('campaigns','nonprofit_verified'),
    ('campaigns','thank_donors_sent_at'),
    ('campaigns','video_url'),
    ('connected_accounts','first_payout_hold_until'),
    ('donations','offline'),
    ('donations','offline_donor_email'),
    ('donations','offline_donor_name'),
    ('donations','offline_method'),
    ('donations','processing_fee_cents'),
    ('donations','stripe_checkout_session_id'),
    ('donations','tip_cents'),
    ('donor_crm_contacts','donor_id'),
    ('donor_crm_contacts','notes'),
    ('donor_messages','anonymous'),
    ('membership_tiers','interval'),
    ('nonprofit_profiles','ein'),
    ('nonprofit_profiles','logo_url'),
    ('nonprofit_profiles','verified_at'),
    ('payouts','paid_at'),
    ('payouts','requested_at'),
    ('platform_settings','created_at'),
    ('recurring_donations','cancelled_at'),
    ('refunds','notes'),
    ('refunds','processed_at'),
    ('refunds','requested_by'),
    ('subscriptions','cancel_at_period_end'),
    ('subscriptions','current_period_start'),
    ('subscriptions','plan'),
    ('subscriptions','stripe_customer_id'),
    ('tax_receipts','campaign_title'),
    ('tax_receipts','no_goods_or_services'),
    ('tax_receipts','nonprofit_ein'),
    ('tax_receipts','nonprofit_name'),
    ('team_members','accepted_at'),
    ('team_members','invited_by'),
    ('trust_scores','activity_score'),
    ('trust_scores','computed_at'),
    ('trust_scores','identity_score'),
    ('trust_scores','story_score'),
    ('trust_scores','transparency_score'),
    ('verification_documents','doc_type'),
    ('verification_documents','is_public'),
    ('verification_documents','notes'),
    ('verification_documents','public_url'),
    ('verification_documents','verified'),
    ('verification_documents','verified_at'),
    ('verification_documents','verified_by')
)
select string_agg(
         format(
           'alter table if exists public.%I add column if not exists %I %s%s;',
           w.table_name,
           w.column_name,
           -- format_type renders the REAL type, including enums, arrays and
           -- precision. information_schema.data_type cannot: it reports
           -- 'USER-DEFINED' for enums and 'ARRAY' for arrays, neither of which is
           -- a usable type name.
           format_type(a.atttypid, a.atttypmod),
           coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
         ),
         E'\n'
         order by w.table_name, a.attnum
       ) as migration_sql
from wanted w
join pg_class      cl on cl.relname = w.table_name
join pg_namespace  ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
join pg_attribute  a  on a.attrelid = cl.oid
                     and a.attname = w.column_name
                     and a.attnum > 0
                     and not a.attisdropped
left join pg_attrdef d on d.adrelid = cl.oid and d.adnum = a.attnum;
