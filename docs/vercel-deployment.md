# Vercel Deployment Guide

1. Import the GitHub repository into Vercel.
2. Set root directory to the monorepo root.
3. Set the production branch to the protected `master` branch. Feature branches
   should use preview deployments and merge through pull requests.
4. Build command:
   `npm run build`
5. Output is handled by Next.js.
6. Run `npm run provision` with `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` or `SUPABASE_DB_URL`, and `VERCEL_TOKEN` set.
7. Confirm Supabase production URL and keys were added to Vercel automatically.
8. Configure Stripe webhooks after deployment URL is assigned.
9. Supabase SQL is applied by `npm run provision`; use `supabase/seed.sql` for staging/demo only.

Production deploy checklist:
- `npm run typecheck`
- `npm run lint --workspace=apps/web`
- `npm run test --workspace=apps/web`
- `npm run build`
- Smoke test create, donate, auth, dashboard, admin review.
