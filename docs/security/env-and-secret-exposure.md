# Environment validation & secret-exposure guard (CHAR-0013)

Part of the P0 security-hardening backlog. Covers the env-schema and
secret-exposure portions; the security-headers/CSP portion was already in place
(see `apps/web/middleware.ts` and `next.config.js`) and is summarized at the end.

## Environment schema — `apps/web/lib/env.ts`

A single, documented source of truth for every env var the app reads, split by
trust level:

- **`publicEnvSchema`** — `NEXT_PUBLIC_*` values safe to reach the browser.
- **`serverSecretSchema`** — server-only secrets. Their names are exported as
  `SERVER_SECRET_KEYS` and enforced by the exposure guard below.
- **`serverConfigSchema`** — server-side non-secret config.

`validateEnv(source?, { production? })` returns a **non-throwing** structured
report (`{ ok, errors, warnings }`) so CI / a deploy preflight can surface every
problem at once. It never throws at import time, so it can't crash a build;
individual clients keep their own graceful fallbacks. Prod-only requirements
(`NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are
warnings in dev and errors in production.

### Preflight

```bash
npm run check:env              # validates current env; non-zero on blocking errors
npm run check:env --production # also enforces prod-only requirements
```

Run it in a deploy pipeline before `next build` to fail fast on misconfiguration.
Covered by `__tests__/env.test.ts`.

## Secret-exposure guard — `apps/web/__tests__/secret-exposure.test.ts`

A static test that walks every `'use client'` module and fails the build if it:

1. **reads a server secret value** — any `process.env.<SECRET>` from
   `SERVER_SECRET_KEYS` (bare name mentions in copy/errors are ignored — only
   value access leaks);
2. **reads any non-public `process.env` var** (only `NEXT_PUBLIC_*` and
   `NODE_ENV` are allowed client-side);
3. **imports a server-only module** — `lib/supabase` (service-role),
   `lib/stripe` (Stripe secret SDK), or `lib/openai`. (`lib/supabase-browser`
   and `-server` are correctly *not* flagged.)

### Fix shipped alongside the guard

The guard caught 4 client components importing `formatCents` from
`lib/stripe.ts`, which pulled the **Stripe server SDK into client bundles** just
to format money. `formatCents` was moved to the client-safe
`@shared/currencies` (it already depended on `normalizeCurrency` there);
`lib/stripe.ts` re-exports it for back-compat, and the client components now
import from `@shared/currencies`. Next.js replaces non-public env with
`undefined` client-side, so no secret *value* was leaking — but the SDK bloat
and the import smell are gone.

## Security headers / CSP (already in place — for reference)

`apps/web/middleware.ts` sets on every response: `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy:
frame-ancestors` (embed routes stay frameable, everything else `'self'`),
`X-Frame-Options`, and `Strict-Transport-Security` (production only).
`next.config.js` adds `X-Content-Type-Options` + `Referrer-Policy` as a static
baseline. A full `script-src`/`style-src` CSP is intentionally **not** added
without a browser to verify it doesn't break the inline-style design system —
tracked as a follow-up.
