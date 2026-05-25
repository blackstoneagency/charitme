# Production Readiness Checklist

- Supabase RLS enabled on every application table.
- Stripe webhook signatures verified.
- Stripe Checkout uses idempotency keys.
- Public mutation endpoints use rate limiting.
- Admin routes check admin role or configured admin email.
- Verification documents are private to owner/admin.
- Payout records are owner/admin only.
- Campaign reports create admin review work.
- No secrets are exposed client-side.
- OpenAI endpoint has deterministic fallback for local development.
- Donor checkout shows donation, processing fee coverage, optional tip, and total.
- Standard payouts are free; same-day and instant payouts require verified eligibility.
- Seed data exists for staging demos.
- CI should run typecheck, lint, tests, and build before deploy.
