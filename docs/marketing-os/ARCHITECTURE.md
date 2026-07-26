# Marketing OS — Architecture & Existing-System Audit

## Repository shape (audited 2026-07-24)

- **Monorepo**: `apps/web` (Next.js 14 App Router), `packages/shared`,
  `supabase/` (76 migrations, `schema.sql` mirror, seeds).
- **~697 TS/TSX files**; mature admin surface under `apps/web/app/admin/*`.
- **Supabase client pattern** (do not mix): `supabase-browser.ts` (anon, client
  components), `supabase-server.ts` (anon + cookies, server components / route
  handlers), `supabase.ts` → `supabaseAdmin` (service role, API routes only).
- **Auth/roles**: `lib/auth.ts` (`requireAdmin`, `requireSuperAdmin`),
  `lib/roles.ts` (`isAdmin`/`isSuperAdmin`, hardcoded owner emails + env +
  profile roles). API routes use `verifyAdmin()` (`app/api/admin/users/_auth.ts`).
- **UI shell**: `components/CharitMeShellServer.tsx` re-exports `CharitMeShell`,
  `TopBar`, etc. Inline styles + CSS variables (no Tailwind in app UI).

## Existing marketing subsystem (real, keep & extend)

`supabase/migrations/20260610010000_marketing_engine.sql` defines the core:
`marketing_contacts`, `marketing_identities`, `marketing_events`,
`marketing_segments` (+ members), `marketing_campaigns` (+ recipients),
`marketing_automations` (+ runs), `marketing_email_templates`,
`marketing_utm_links`, `marketing_referrals`, `marketing_forms` (+ submissions),
`marketing_consent`, `marketing_suppression_list`, `marketing_audit_logs`.

UI hub: `app/admin/marketing/` with tabs Overview / Audience / Segments /
Campaigns / Automations / AI Copilot / Outreach, plus a dedicated SEO & AEO
workspace (`app/admin/marketing/seo`). Server data via
`_components/overview.ts` reading live counts through `supabaseAdmin`.

## Conventions the Marketing OS follows

1. **New tables** live in a timestamped migration, `enable row level security`,
   no anon/authenticated policies (service-role only) — matching every other
   `marketing_*` table.
2. **API routes** are `server-only`, gate on `verifyAdmin()`, validate input
   with **zod**, mutate through `supabaseAdmin`, and write a row to
   `marketing_audit_logs` for every state change.
3. **Pages** are `force-dynamic`, call `requireAdmin()`, render inside
   `CharitMeShell`, and hand live data to a `'use client'` component that owns
   loading / empty / error / retry states.
4. **Pure domain logic** (parsers, scoring, measurement) lives in `lib/*.ts` and
   is unit-tested under `__tests__/` with vitest — no network in tests.

## Goals slice data flow

```
Marketing leader types an objective (NL)
        │  POST { text, preview:true }
        ▼
/api/admin/marketing/goals ── draftGoalFromText() ──▶ structured draft (editable)
        │  POST { ...draft }         (deterministic, dependency-free)
        ▼
marketing_goals (Supabase, RLS)  +  marketing_audit_logs (goal_created)
        │  GET
        ▼
measureGoalProgress() ── live query campaigns / donations ──▶ progress bars
        │  PATCH ?id=  (activate / pause / achieve / archive)  + audit (goal_updated)
```

Autonomy is modelled as `autonomy_level` (1 Recommend → 4 Exception-based) on
each goal, ready for the future orchestrator to honor; today all actions are
human-initiated (Level 1), so no autonomous publishing or spend can occur.
