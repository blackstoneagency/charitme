-- Remove fake/seed Stripe Connect account IDs that don't exist in production.
-- Seed data used sequential fake IDs like acct_d3d9446802a44259.
-- Real Stripe Connect accounts always start with 'acct_' followed by 16 alphanum chars.
-- We keep only accounts whose IDs look like real Stripe Connect accounts.
-- Safe: fundraisers can re-connect via /dashboard/payouts.

delete from public.connected_accounts
where stripe_account_id not similar to 'acct_[A-Za-z0-9]{16}';
