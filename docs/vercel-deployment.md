# Vercel Deployment Guide

1. Import the GitHub repository into Vercel.
2. Set root directory to the monorepo root.
3. Build command:
   `npm run build`
4. Output is handled by Next.js.
5. Run `npm run provision` with `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` or `SUPABASE_DB_URL`, and `VERCEL_TOKEN` set.
6. Confirm Supabase production URL and keys were added to Vercel automatically.
7. Configure Stripe webhooks after deployment URL is assigned.
8. Supabase SQL is applied by `npm run provision`; use `supabase/seed.sql` for staging/demo only.

Production deploy checklist:
- `npm run typecheck`
- `npm run lint --workspace=apps/web`
- `npm run test --workspace=apps/web`
- `npm run build`
- Smoke test create, donate, auth, dashboard, admin review.

## Release workflow

Production releases run only from semantic version tags such as `v1.4.0`.
`.github/workflows/release.yml` verifies the app and a clean database replay,
applies migrations to staging, runs live RLS checks, deploys staging, and runs
the critical Playwright smoke, auth-gate, and security-header suites. The exact
staging-verified commit is then passed to the protected `production` environment.

Configure both the `staging` and `production` GitHub environments with:

- Secrets: `SUPABASE_PROJECT_REF`, `SUPABASE_PRODUCTION_PROJECT_REF`,
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ANON_KEY`,
  `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
- Staging-only secret: `CHARITME_RLS_TEST_USERS_JSON` with dedicated test
  personas using `name`, `email`, `password`, and expected `userId`. At least two
  personas are required so cross-user isolation is exercised.
- Variable: `APP_URL`.

The staging `SUPABASE_PROJECT_REF` must differ from
`SUPABASE_PRODUCTION_PROJECT_REF`. In the production environment they must
match. Configure required reviewers on the GitHub `production` environment so
the staging evidence is reviewed before migrations and deployment proceed.

Rollback the web deployment with `vercel rollback <deployment-url>`. Every
database migration in the release must retain its corresponding script under
`supabase/rollbacks/`.
