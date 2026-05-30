# CharitMe Supabase Project

Project ref: `yanexccimwooursawynm`

Dashboard:
`https://supabase.com/dashboard/project/yanexccimwooursawynm`

Public API URL:
`https://yanexccimwooursawynm.supabase.co`

## Files

- `config.toml` - Supabase CLI project configuration.
- `schema.sql` - current full schema snapshot.
- `seed.sql` - staging/demo seed data.
- `migrations/20260525000000_initial_schema.sql` - deployable initial schema migration.
- `migrations/20260525001000_storage_buckets.sql` - storage buckets and RLS policies.
- `migrations/20260525130000_auth_profile_bootstrap.sql` - creates profiles and default roles for new Auth users.

## Apply Remotely

```bash
npm run provision
```

Required environment variables:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD` or `SUPABASE_DB_URL`

Optional Vercel automation:

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID` or `VERCEL_PROJECT_NAME` (defaults to `money-raise`)
- `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG` for team-owned projects
- `VERCEL_APP_URL` to set `APP_URL` and `NEXT_PUBLIC_APP_URL`

The provisioning script runs Supabase migrations, reads the Supabase anon and service role keys, updates Vercel build settings, and upserts Supabase-related Vercel environment variables.

For staging/demo data only, run after provisioning:

```bash
supabase db execute --file supabase/seed.sql
```

## Required Dashboard Configuration

- Authentication providers: enable Email, and enable Google only after OAuth credentials are configured.
- Site URL: your production Vercel URL.
- Redirect URL: `https://YOUR_DOMAIN/api/auth/callback`.
- Storage buckets are created by migration:
  - `campaign-media`
  - `verification-documents`
  - `receipts`
