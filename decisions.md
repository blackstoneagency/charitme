# CharitMe — Architecture Decision Record

> One entry per significant decision. Append; never rewrite history.

---

### ADR-0001 — Treat the mission as hardening/gap-closure, not a rewrite
- **Date**: 2026-07-19
- **Context**: The execution brief assumed a stub-heavy MVP. The audit found a mature, healthy platform (~80 wired tables, 138 APIs, 339 passing tests, type-clean).
- **Options**: (a) Rewrite per the brief's greenfield framing; (b) Preserve working subsystems and close real gaps as verified slices.
- **Decision**: (b). Rewriting a working, deployed, money-handling platform would destroy value and risk real donors.
- **Consequences**: Each change is a small vertical slice with evidence. Working code is not touched without a proven gap.
- **Rollback**: Per-slice branches; revert individual commits.

---

### ADR-0002 — WIP on branches; only verified slices reach `master`
- **Date**: 2026-07-19
- **Context**: `master` auto-deploys to live `charitme.com` handling real money. The brief itself forbids pushing broken code to main.
- **Decision**: All implementation happens on `agent/*` branches. `master` receives only slices that pass typecheck + lint + relevant tests + build, with no secrets. Docs-only changes may go straight to `master` for visibility.
- **Consequences**: Slower visible cadence on `master`, but production stays safe.
- **Rollback**: Branch isolation; `master` never carries unverified WIP.

---

### ADR-0003 — Verification boundary given no live Supabase in sandbox
- **Date**: 2026-07-19
- **Context**: The dev sandbox cannot reach Supabase (invalid/short local keys; data routes time out). The brief requires end-to-end tested payment/payout/RLS flows.
- **Decision**: Locally, "verified" means: typecheck pass, Vitest (mocked-Supabase) pass, `next build` pass, static UI/responsive/a11y checks. Data-path, Stripe, webhook, payout, and RLS verification are marked **"needs staging"** in `todo.md` and require a staging Supabase project + Stripe test mode before they can be certified.
- **Consequences**: No task touching live data flows may be marked `Verified`/`Production Ready` from this environment alone. Honesty over green checkmarks.
- **Rollback**: n/a (process decision).
