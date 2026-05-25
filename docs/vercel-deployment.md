# Vercel Deployment Guide

1. Import the GitHub repository into Vercel.
2. Set root directory to the monorepo root.
3. Build command:
   `npm run build`
4. Output is handled by Next.js.
5. Add all variables from `.env.example`.
6. Configure Supabase production URL and keys.
7. Configure Stripe webhooks after deployment URL is assigned.
8. Run Supabase SQL:
   - `supabase/schema.sql`
   - `supabase/seed.sql` for staging/demo only

Production deploy checklist:
- `npm run typecheck`
- `npm run lint --workspace=apps/web`
- `npm run test --workspace=apps/web`
- `npm run build`
- Smoke test create, donate, auth, dashboard, admin review.
