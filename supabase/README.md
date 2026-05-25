# GiveRise Supabase Project

Project ref: `nengpvscsgukotheptri`

Dashboard:
`https://supabase.com/dashboard/project/nengpvscsgukotheptri`

Public API URL:
`https://nengpvscsgukotheptri.supabase.co`

## Files

- `config.toml` - Supabase CLI project configuration.
- `schema.sql` - current full schema snapshot.
- `seed.sql` - staging/demo seed data.
- `migrations/20260525000000_initial_schema.sql` - deployable initial schema migration.
- `migrations/20260525001000_storage_buckets.sql` - storage buckets and RLS policies.

## Apply Remotely

```bash
supabase link --project-ref nengpvscsgukotheptri
supabase db push
```

For staging/demo data only:

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
