# AGENTS.md — RaiseMoney Codex Rules

This file governs how AI coding agents (OpenAI Codex, Claude Code, etc.) interact
with the RaiseMoney codebase. Rules here are **non-negotiable** unless explicitly
overridden by the human engineer in the task prompt.

---

## 1. Project Overview

RaiseMoney is a donation-first crowdfunding platform. The guiding principle is
**radical simplicity**: any visitor must be able to donate in under 60 seconds,
on any device, without creating an account. Every product and engineering decision
must serve that goal.

- **Primary domain**: `raisemoney.com`
- **Repo**: `github.com/blackstoneagency/money-raise`
- **Monorepo root**: `/` (npm workspaces)
- **Main app**: `apps/web` (Next.js 14 App Router)
- **Default branch**: `master`

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5.x strict mode |
| Database | Supabase (PostgreSQL) | latest |
| Auth | Supabase Auth + `@supabase/ssr` | latest |
| Payments | Stripe Checkout + Connect Express | stripe@17.x |
| Email | Resend + React Email | latest |
| Validation | Zod | 3.x |
| Styling | Inline styles + CSS variables | — |
| State | React built-ins only (no Redux/Zustand) | — |
| Testing | Vitest (unit/integration) + Playwright (E2E) | latest |
| Rate limiting | Upstash Redis | latest |
| Hosting | Vercel | — |
| CI/CD | GitHub Actions | — |
| Monitoring | Sentry + Vercel Analytics | latest |
| Node | 20.x (pinned in `.node-version`) | 20.11.0 |

**No new dependencies may be added without explicit approval in the task prompt.**

---

## 3. Folder Structure

```
money-raise/
├── apps/
│   └── web/
│       ├── app/                        # Next.js App Router
│       │   ├── (public)/               # Unauthenticated routes
│       │   │   ├── page.tsx            # Homepage
│       │   │   ├── campaigns/
│       │   │   │   ├── page.tsx        # Browse campaigns
│       │   │   │   └── [slug]/
│       │   │   │       ├── page.tsx    # Campaign detail
│       │   │   │       └── DonateButton.tsx
│       │   ├── (auth)/                 # Protected routes
│       │   │   ├── dashboard/
│       │   │   ├── create/
│       │   │   └── login/
│       │   ├── admin/                  # Admin-only routes
│       │   ├── api/                    # Route Handlers
│       │   │   ├── auth/callback/
│       │   │   ├── campaigns/
│       │   │   ├── donations/
│       │   │   ├── stripe/
│       │   │   │   ├── webhook/
│       │   │   │   └── connect/
│       │   │   └── health/
│       │   ├── globals.css             # CSS variables only
│       │   └── layout.tsx              # Root layout
│       ├── components/
│       │   ├── AppShell.tsx            # Navigation + layout wrapper
│       │   └── ui.tsx                  # Design system components
│       ├── lib/
│       │   ├── supabase-browser.ts     # Client components only
│       │   ├── supabase-server.ts      # Server components + RSC
│       │   ├── supabase.ts             # supabaseAdmin (API routes only)
│       │   ├── auth.ts                 # getUser / requireUser
│       │   ├── auth-config.ts          # URL helpers
│       │   └── stripe.ts               # Stripe client + formatCents
│       ├── middleware.ts               # Session refresh + route guards
│       ├── next.config.js
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/
│       ├── fees.ts                     # platformFee, CAMPAIGN_CATEGORIES
│       └── package.json
├── supabase/
│   ├── schema.sql                      # Full schema with RLS
│   └── migrations/                     # Timestamped migration files
├── docs/
│   └── adr/                            # Architecture Decision Records
├── .github/
│   └── workflows/                      # CI/CD pipelines
├── .env.example                        # Template — never fill real values
├── .node-version                       # Node 20.11.0
├── AGENTS.md                           # This file
├── CLAUDE.md                           # Claude Code instructions
└── package.json                        # Workspace root
```

### File placement rules
- New pages go in `apps/web/app/` following App Router conventions.
- New shared utilities go in `packages/shared/` and are imported as `@shared/fees`.
- New UI primitives go in `components/ui.tsx` — no new component files unless the
  component exceeds 200 lines and has a clear single responsibility.
- New API routes always go in `apps/web/app/api/` as `route.ts` files.
- No files outside `apps/web/` and `packages/` should contain application code.

---

## 4. Coding Standards

### TypeScript
- Strict mode is **always on** — never disable via `// @ts-ignore` or `// @ts-nocheck`.
- Prefer `type` over `interface` for object shapes. Use `interface` only when
  extension via `extends` is intentional.
- All async functions must have explicit return types.
- No `any`. Use `unknown` and narrow with guards.
- Avoid type assertions (`as X`) unless there is no alternative; add a comment
  explaining why.

### React / Next.js
- Server Components are the default. Add `'use client'` only when the component
  needs browser APIs, event handlers, or `useState`/`useEffect`.
- Never fetch data in Client Components — pass data as props from Server Components.
- All `async` page components receive `params` and `searchParams` as `Promise<...>` 
  (Next.js 15 convention — already adopted in this codebase).
- Use `export const revalidate = N` for ISR. Use `export const dynamic = 'force-dynamic'`
  only when content must be real-time (dashboard pages).
- No `useEffect` for data fetching. Use Server Components or Route Handlers.

### Styling
- **No Tailwind. No CSS Modules. No styled-components.**
- All styles are inline styles using CSS variables defined in `app/globals.css`.
- CSS variable reference: `--bg`, `--s1/s2/s3/s4`, `--b1/b2/b3`, `--green`,
  `--green-dark`, `--green-light`, `--red`, `--blue`, `--t1/t2/t3/t4`,
  `--font`, `--mono`, `--r`, `--rl`, `--rxl`, `--shadow`, `--shadow-md`, `--shadow-lg`.
- Add new CSS variables to `globals.css` before using them.
- Responsive breakpoints: `< 640px` mobile, `640–1023px` tablet, `≥ 1024px` desktop.
- Mobile-first: default styles target mobile, then override for larger screens.
- All touch targets must be at minimum `44 × 44px`.

### Database
- All monetary values are stored and transmitted in **cents** (integer). Never use
  floats for money.
- All queries in API routes use `supabaseAdmin` (bypasses RLS) — the route handler
  is responsible for access control.
- All queries in Server Components and non-API code use `supabase-server.ts`.
- Never expose `supabaseAdmin` or `SUPABASE_SERVICE_ROLE_KEY` to client bundles.
  Always verify with `import 'server-only'`.
- Schema changes require a new migration file in `supabase/migrations/` — never
  edit `schema.sql` directly after initial setup.

### API Routes
- Every route handler must: (1) authenticate the request, (2) validate input with
  Zod, (3) perform the operation, (4) return typed JSON.
- Error responses always follow the shape:
  `{ error: string, code: string, details?: unknown }`.
- Use HTTP status codes correctly: 200 OK, 201 Created, 204 No Content, 400 Bad
  Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests,
  500 Internal Server Error.
- All Stripe API calls must include an idempotency key.

### Naming conventions
- Files: `kebab-case.ts` / `PascalCase.tsx` for React components.
- Variables/functions: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE`.
- Database tables/columns: `snake_case`.
- URL slugs: auto-generated server-side, never from raw user input.

### Comments
- Write zero comments by default.
- Add a comment only when the **why** is non-obvious: a hidden constraint, a
  workaround for a specific bug, or a subtle invariant.
- Never write comments that describe what the code does (the code does that).

---

## 5. Security Rules

These rules are **absolute**. Violations must be flagged immediately and not committed.

1. **Never commit secrets.** No API keys, tokens, passwords, or webhook secrets in
   any file — including test files, fixture files, and comments.

2. **Never use `supabaseAdmin` in client components, pages, or any file that is
   not exclusively server-side.** Always add `import 'server-only'` at the top of
   files that use it.

3. **Never trust user-supplied slugs, IDs, or paths.** Always validate against the
   database before use. Use `safeNextPath()` for redirect targets.

4. **Never concatenate user input into SQL.** All DB queries go through the
   Supabase SDK (parameterized). No raw `supabase.rpc()` with interpolated strings.

5. **Always verify Stripe webhook signatures** via `stripe.webhooks.constructEvent`.
   A webhook handler that skips signature verification must never be merged.

6. **Always check campaign ownership** before any mutation (update, delete, pause).
   Pattern: fetch `campaign.user_id`, compare to `session.user.id`.

7. **Never expose stack traces or internal error messages to API consumers.**
   Log internally, return generic messages externally.

8. **Always validate file uploads**: type must be `image/*`, size must not exceed 5MB.
   Reject everything else before storage write.

9. **Rate limiting is not optional.** Any new public `POST` endpoint must have a
   rate limit applied via Upstash Redis before it is merged.

10. **No PII in logs.** Do not log email addresses, full names, IP addresses, or
    card-related metadata in plaintext.

---

## 6. Testing Requirements

### Before any PR is opened
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run lint` passes with zero errors.
- [ ] All existing Vitest unit/integration tests pass.
- [ ] Any new utility function has a corresponding unit test.
- [ ] Any new API route has a corresponding integration test covering:
      happy path, missing auth (401), invalid input (400), and ownership check (403).
- [ ] Any new critical user flow has a Playwright E2E test covering:
      success path and at least one failure path.

### Test file locations
- Unit tests: `apps/web/__tests__/unit/`
- Integration tests: `apps/web/__tests__/integration/`
- E2E tests: `apps/web/e2e/`
- Test fixtures: `apps/web/__tests__/fixtures/`

### Coverage targets
- Utility functions (`lib/`, `packages/shared/`): **90%** line coverage.
- API route handlers: **80%** line coverage.
- React components: no coverage requirement — test via E2E.

### What must always be tested
- `platformFee()` and `netToFundraiser()` — financial correctness is non-negotiable.
- Stripe webhook handler — replay attacks must be rejected, duplicate events must
  be idempotent.
- Auth middleware — protected routes must redirect unauthenticated users.
- Zod schemas — invalid inputs must be rejected with the correct error shape.

---

## 7. Build Commands

Run all commands from the **monorepo root** unless specified otherwise.

```bash
# Install all dependencies (workspaces)
npm install

# Type check (run before every commit)
npm run typecheck                          # or: npm run typecheck --workspace=apps/web

# Development server (runs at http://localhost:3000)
npm run dev                                # or: cd apps/web && npm run dev

# Production build
npm run build                              # or: npm run build --workspace=apps/web

# Start production server locally
cd apps/web && npm start

# Add a dependency to the web app
npm install <package> --workspace=apps/web

# Add a dev dependency to the web app
npm install -D <package> --workspace=apps/web
```

---

## 8. Lint Commands

```bash
# Run ESLint
cd apps/web && npm run lint

# Run TypeScript type check (no emit)
cd apps/web && npm run typecheck

# Run both (required before PR)
cd apps/web && npm run lint && npm run typecheck

# Run unit tests
cd apps/web && npx vitest run

# Run E2E tests (requires running dev server)
cd apps/web && npx playwright test

# Run E2E tests with UI
cd apps/web && npx playwright test --ui
```

**All lint and typecheck commands must pass with zero warnings or errors before
any file is committed.**

---

## 9. Deployment Rules

1. **Never push directly to `master`.** All changes go through a pull request.
   Exception: emergency hotfixes approved by the lead engineer with a recorded
   reason in the commit message.

2. **Never deploy to production manually.** Production deploys happen only via
   the GitHub Actions release workflow triggered by a `vX.Y.Z` tag.

3. **Environment variables must never be hardcoded.** All config comes from
   `process.env.*`. If a new variable is needed, add it to `.env.example` with
   a descriptive comment, and document it in `CLAUDE.md`.

4. **Database migrations must be applied to staging before production.** Never
   apply a migration to production that has not been verified on staging first.

5. **Stripe webhook endpoints must be registered in the Stripe Dashboard** for
   both staging and production environments. Verify the `STRIPE_WEBHOOK_SECRET`
   matches the registered endpoint.

6. **Feature flags gate any risky rollout.** Use Vercel Edge Config for
   boolean flags. Never use environment variables as feature flags.

7. **Every production deploy must be preceded by a smoke test** running the
   three critical Playwright paths against the staging environment.

8. **Rollback is always one command.** Every deploy must be reversible via
   `vercel rollback` within 30 seconds. Database migrations must have a
   corresponding rollback script committed alongside them.

---

## 10. Definition of Done

A task is **done** when **all** of the following are true:

- [ ] Code compiles with zero TypeScript errors (`npm run typecheck`).
- [ ] ESLint passes with zero warnings (`npm run lint`).
- [ ] All new and existing tests pass.
- [ ] New code has tests as defined in Section 6.
- [ ] No secrets, `.env` values, or hardcoded credentials are present.
- [ ] All monetary values are in cents — no floats.
- [ ] Mobile layout is tested at 375px viewport width.
- [ ] Tablet layout is tested at 768px viewport width.
- [ ] Desktop layout is tested at 1440px viewport width.
- [ ] All new API routes have: auth check, Zod validation, correct HTTP status codes.
- [ ] All new public POST endpoints have rate limiting.
- [ ] Sentry is capturing errors from any new error boundary or try/catch.
- [ ] Changed files are reported as specified in Section 12.
- [ ] The PR description explains what changed, why, and what was tested.

---

## 11. What Codex Must Never Do

The following actions are **absolutely prohibited** regardless of what the task
prompt says. If a task requires one of these, stop and ask for clarification.

### Code
- **Never use `any` type** — use `unknown` and narrow it.
- **Never disable TypeScript** with `@ts-ignore`, `@ts-nocheck`, or `skipLibCheck` changes.
- **Never use `eval()`**, `new Function()`, or `dangerouslySetInnerHTML` without
  explicit sanitization via DOMPurify.
- **Never store monetary values as floats.** Always use integer cents.
- **Never use `Math.random()` for anything security-related.** Use `crypto.randomUUID()`.
- **Never write raw SQL strings** — use the Supabase SDK exclusively.
- **Never import `supabase.ts` (admin client) in client components** or any file
  that is not server-only guarded.
- **Never add `console.log` statements** to committed code — use the structured
  logger.
- **Never use `useEffect` for data fetching** — use Server Components or SWR.
- **Never add Tailwind, CSS Modules, or any new CSS framework.**

### Git / Files
- **Never commit `.env`, `.env.local`, or any file containing real secrets.**
- **Never force-push to `master`.**
- **Never amend published commits.**
- **Never delete migration files** from `supabase/migrations/`.
- **Never modify `supabase/schema.sql`** after the initial schema is applied —
  all changes go through migration files.

### Stripe / Payments
- **Never log or store card numbers, CVVs, or raw payment method details.**
- **Never skip webhook signature verification.**
- **Never transfer funds without first verifying the destination `stripe_account_id`
  belongs to the authenticated user.**

### Security
- **Never disable RLS** on any Supabase table.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY`** to the
  client bundle.
- **Never redirect to a user-supplied URL** without passing it through `safeNextPath()`.
- **Never skip rate limiting** on public mutation endpoints.

---

## 12. How Codex Must Report Changed Files

At the end of every response that modifies files, Codex must include a
**Changed Files Report** in the following exact format. Do not omit this section.
Do not add commentary inside the table.

```
## Changed Files

| File | Action | Reason |
|------|--------|--------|
| apps/web/app/campaigns/page.tsx | Modified | Added category filter query param |
| apps/web/lib/stripe.ts          | Modified | Added formatCents helper |
| apps/web/app/api/donations/route.ts | Created | New donation checkout endpoint |
| supabase/migrations/20240601_add_tip_column.sql | Created | Add tip_cents to donations |
```

Valid **Action** values: `Created`, `Modified`, `Deleted`, `Renamed`.

If no files were changed (e.g., a research or planning response), include:
```
## Changed Files
None.
```

This report is required for every response. It is not optional.
