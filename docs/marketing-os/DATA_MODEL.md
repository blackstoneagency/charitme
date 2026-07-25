# Marketing OS — Data Model

## `marketing_goals` (shipped)

Migration: `supabase/migrations/20260729000000_marketing_goals.sql`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `title` | text NOT NULL | short label |
| `description` | text | |
| `objective` | text | plain-English business objective |
| `natural_language_input` | text | original NL prompt, if any |
| `target_metric` | text NOT NULL | CHECK enum (see below), default `custom` |
| `baseline_value` | numeric | value at goal creation (flow metrics baseline at 0) |
| `target_value` | numeric | |
| `unit` | text NOT NULL | CHECK `count｜cents｜percent｜ratio` |
| `deadline` | date | |
| `priority` | text NOT NULL | CHECK `low｜medium｜high｜critical` |
| `geography` | text | |
| `audience` | text | |
| `category` | text | maps to a `campaigns.category` value |
| `budget_cents` | bigint | `>= 0` |
| `channels` | text[] NOT NULL | default `{}` |
| `autonomy_level` | smallint NOT NULL | CHECK 1–4, default 1 |
| `constraints` | jsonb NOT NULL | default `{}` |
| `status` | text NOT NULL | CHECK `draft｜active｜paused｜achieved｜missed｜archived` |
| `confidence` | numeric | CHECK 0–1 or null |
| `forecast_value` | numeric | |
| `owner_id` | uuid → auth.users | on delete set null |
| `created_by` | uuid → auth.users | on delete set null |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

**`target_metric` enum:** `fundraiser_starts`, `donation_volume`,
`recurring_donors`, `donation_conversion`, `verified_charities`,
`donor_acquisition_cost`, `organizer_retention`, `aeo_visibility`,
`organic_traffic`, `custom`.

**Indexes:** `(status, priority)`, `(deadline)`, `(created_at desc)`, `(owner_id)`.

**RLS:** enabled, service-role only (no anon/authenticated policies).

**Soft delete:** goals are `status='archived'` rather than hard-deleted; the list
API excludes archived rows.

**Rollback:** `drop table public.marketing_goals cascade;` (documented in the
migration footer).

## Live measurement mapping

| Metric | Source | Query |
|--------|--------|-------|
| `fundraiser_starts` | `campaigns` | count where `created_at >= goal.created_at` and `status != 'draft'` (optionally `category = goal.category`) |
| `donation_volume` | `donations` | sum `amount_cents` where `status='completed'` and `created_at >= goal.created_at` |
| everything else | — | **measurement pending** (stored, honestly labelled; not computed) |

## Planned tables (not yet created)

The broader brief enumerates ~130 tables (organizations, brands, opportunities,
agents, integrations, experiments, attribution, forecasts, approvals, …). These
are intentionally **not** created in this branch to avoid shipping empty schema
ahead of the code that uses it. Each will land in its own migration alongside a
working feature, following the same RLS/audit conventions.
