# Stripe Setup Guide

1. Create a Stripe account and enable Checkout.
2. Enable Stripe Connect Express.
3. Add platform webhook endpoint:
   `https://YOUR_DOMAIN/api/stripe/webhook`
4. Add Connect webhook endpoint:
   `https://YOUR_DOMAIN/api/stripe/connect`
5. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
   - `payout.paid`
   - `payout.failed`
6. Copy secrets into:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_CONNECT_WEBHOOK_SECRET`

CharitMe uses 0% mandatory platform fees. Optional donor tips are collected as the application fee when destination charges are available.
