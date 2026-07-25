# Marketing OS — Known Limitations

Scope of this document: the **Goal-Based Marketing** slice shipped in
`claude/charitme-marketing-os-build-*`. Read alongside `IMPLEMENTATION_STATUS.md`.

## What is intentionally limited

1. **Only two metrics are measured live.** `fundraiser_starts` and
   `donation_volume` are computed from `campaigns` / `donations`. All other
   metrics store their target and render **"measurement pending"** with a reason.
   This is deliberate — no metric shows a fabricated number.

2. **The NL parser is deterministic, not an LLM.** `draftGoalFromText` uses
   rule-based classification so it works with zero AI configured and is fully
   testable. It can misclassify ambiguous phrasing (e.g. a goal containing both
   "verified" and "fundraisers" resolves to `verified_charities` by documented
   precedence). The draft is always shown for human review/edit before saving, so
   a misparse is a one-click fix, never a silent commit.

3. **`donation_volume` sums up to 50,000 donation rows** per measurement. Beyond
   that scale this should move to a SQL aggregate / RPC. Fine for current volume.

4. **Autonomy levels are stored, not yet enforced by an executor.** Every action
   today is human-initiated (create, activate, pause, archive). There is no
   background agent acting on goals, so `autonomy_level` 2–4 currently behaves the
   same as Level 1. No autonomous spend or publishing exists.

5. **Single-tenant.** Goals are not yet scoped to `organizations`/`brands`;
   access is gated by the existing admin check. Multi-tenant scoping is a
   backlog item before this is exposed to multiple brands.

## Not defects (environment)

- `next build` fails at the **static-export** step in CI sandboxes without
  `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, because some
  pre-existing pages read Supabase during prerender. Compilation and type-checking
  pass. The goals pages are `force-dynamic` and never prerender.

## Safe-by-construction

- All mutations audited in `marketing_audit_logs`.
- RLS service-role-only; no client can read/write `marketing_goals` directly.
- Inputs validated with zod; archive is soft-delete; every status change is
  reversible via PATCH.
