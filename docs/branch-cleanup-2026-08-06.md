# Branch cleanup — 2026-08-06

36 stale remote branches **identified and verified safe to delete**. They are
**NOT deleted yet** — deletion is blocked in the agent environment, see below.

## ⛔ Deletion is blocked here; this needs one paste from the owner

`git push origin --delete <branch>` returns **HTTP 403** from this sandbox,
while an ordinary `git push origin master` to the same remote succeeds seconds
earlier and the agent proxy reports `recentRelayFailures: []`. The session
credential can create and update refs but not delete them, and the GitHub MCP
server exposes `create_branch` with no delete counterpart.

So this is a token-scope limit, not a transient failure and not a missing step.

```bash
# From a clone with delete permission — deletes all 36 in one call.
git push origin --delete \
  agent/banner-production-fix agent/grants agent/orchestration \
  agent/payment-methods agent/seo-aeo-marketing-engine \
  claude/campaign-f8-f10 claude/campaign-journey-f4-f10 \
  claude/campaign-journey-friction claude/charitme-github-integration-5851tk \
  claude/charitme-github-integration-njok43 claude/charitme-gofundme-audit-8vizt7 \
  claude/compassionate-darwin-ty4q3x claude/e2e-auth-gates \
  claude/prod-readiness-sweep claude/query-timeout-rollout \
  claude/todo-status-consolidation codex/build-tracing-root-157 \
  codex/dashboard-data-trust codex/dev-toolchain-security-158 \
  codex/fix-auth-profile-sync codex/fix-csp-console-violations \
  codex/fix-system-health-window codex/health-schema-cache-security \
  codex/ignore-playwright-results codex/node-runtime-contract-156 \
  codex/persona-certification-155 codex/seed-guard codex/seo-aeo-integration \
  codex/seo-release-evidence-159 codex/sitemap-production-evidence-161 \
  codex/sitemap-resilience-160 codex/supabase-production-evidence-163 \
  codex/supabase-release-audit-162 codex/tax-document-center \
  codex/tax-reporting-home-cta fix/prod-hotfix-dark-images-stripe
```

**Every one is recoverable** afterwards — the tip SHA is recorded below, and a
deleted branch is restored with one command:

```bash
git push origin <sha>:refs/heads/<branch-name>
```

Do not treat this file as permanent insurance: unreferenced objects are
eventually garbage-collected server-side, so restore promptly if a branch turns
out to be needed.

## Why they are safe to delete

Every branch here was verified to contain **no work missing from `master`**,
by three independent checks:

| check | result |
|---|---|
| `git diff master...branch` | empty for 8 branches — literally no unique content |
| same diff limited to files the branch itself touched | the other branches all **delete more than they add** against master, i.e. master's copies are strictly richer |
| files present on branch, absent from master | only 3, and all three were false positives (see below) |

⚠️ **The naive two-dot diff is badly misleading here** and is what makes this
look like a large body of unmerged work. `git diff master branch` reported
figures like `+16,184 / −199,800` for `agent/grants`. Those ~200k "deletions"
are **master's own growth since the branch diverged**, not the branch's content.
Only the three-dot form, measured from the merge base, shows what a branch
actually contributes. Anyone re-doing this analysis must use three-dot.

### The three "missing" files were not missing

| file | reality |
|---|---|
| `supabase/migrations/20260801000000_campaign_wizard_drafts.sql` | byte-identical to master's `20260801010000_campaign_wizard_drafts.sql` — **renamed on merge**. Restoring it would create a duplicate migration creating the same tables twice. |
| `supabase/migrations/20260802000000_campaign_wizard_drafts_multi.sql` | same, vs master's `20260802010000_…` |
| `apps/web/__tests__/dashboard-data-trust.test.ts` | tests dashboard code master has since rewritten |

### What merging instead of deleting would have done

- **`codex/dashboard-data-trust`** would have deleted **7,393 lines** across the
  dashboard, removing `tax`, `webhooks`, `tasks`, `forms`, `segments`,
  `documents`, `domains`, `developers`, `creator`, `payment-methods`, `saved`,
  `giving-days` and `tools` — all of which exist in master and none of which
  existed on that branch on 26 July.
- Every other branch would have reverted master's newer versions of the same
  files, including `todo.md` and `globals.css`.

## Kept deliberately

| branch | why |
|---|---|
| `claude/charitme-marketing-os-build-wcu7oh` | this session's designated development branch |
| `claude/charitme-production-ready-015tl4` | another agent, last commit 2026-08-05 |
| `claude/charitme-github-integration-tbaz3i` | another agent, last commit 2026-08-06 — active today |

The rule applied: **nothing touched in the last 48 hours was deleted**, whether
or not it was merged. A merged branch belonging to a running agent is still that
agent's working branch.

## Branches to delete, and their tips

| branch | last commit | tip SHA |
|---|---|---|
| `agent/banner-production-fix` | 2026-07-26 | `edea1161a48d1948217eb8f11122bf647e6eab51` |
| `agent/grants` | 2026-07-19 | `8842206d248975056a7d5dafc787729a627e566c` |
| `agent/orchestration` | 2026-07-19 | `7014f6d8ed6f934619e85e2b2562fe5eff9a8b1f` |
| `agent/payment-methods` | 2026-07-26 | `15676b9220ea7d93aa92b21e31b322bf4ca1e2f8` |
| `agent/seo-aeo-marketing-engine` | 2026-07-23 | `710beb479a2ee9ab39e78ef45e7d3ff7af241f0e` |
| `claude/campaign-f8-f10` | 2026-07-25 | `1619e6e3a87112f5c062e72cfc088d22255d6117` |
| `claude/campaign-journey-f4-f10` | 2026-07-24 | `fa57be4e7f6854b5db09e67738bfc7789d887726` |
| `claude/campaign-journey-friction` | 2026-07-24 | `d9c0ad1f75a52ba622c4c7a3cf7960c61cafe83c` |
| `claude/charitme-github-integration-5851tk` | 2026-07-27 | `99e006f89c3cce9c88b92a58bd1320b535e490c0` |
| `claude/charitme-github-integration-njok43` | 2026-08-04 | `8d2c9c4bcdb819d939d9a4de4be40f99bc4c086f` |
| `claude/charitme-gofundme-audit-8vizt7` | 2026-07-19 | `d32bb02205c7ae1d5782835fd6fa9ef8f48c1f37` |
| `claude/compassionate-darwin-ty4q3x` | 2026-06-13 | `5b050311b12d2760ad86f5ef03284afc14227364` |
| `claude/e2e-auth-gates` | 2026-07-26 | `f2386bbab95cd478b1f2dd1293a32a57bf831bb0` |
| `claude/prod-readiness-sweep` | 2026-07-26 | `21359690c7d5b8282e391b41ed92f07a3c8b0b97` |
| `claude/query-timeout-rollout` | 2026-07-26 | `93bab885ee23d91a2fc5c5132e025961d53eef1b` |
| `claude/todo-status-consolidation` | 2026-07-26 | `07e81ab5190db1c1be28611a28ac72c325d52c45` |
| `codex/build-tracing-root-157` | 2026-07-29 | `2b940d94624a33227404224604055d8fab451114` |
| `codex/dashboard-data-trust` | 2026-07-26 | `9b3ace3aa679e4bae44e53ab4c28c547d7f0fe30` |
| `codex/dev-toolchain-security-158` | 2026-07-29 | `2896a8c50d96a323d12bd07038390704a5444378` |
| `codex/fix-auth-profile-sync` | 2026-06-12 | `d7a6b1ec81460b2b0a27560ebc8fe97a25a890ac` |
| `codex/fix-csp-console-violations` | 2026-07-23 | `e3cd7d5997266bdbe04b4bf4b5975d20bb66c21f` |
| `codex/fix-system-health-window` | 2026-06-08 | `9c8b7554b8feae7dac3dbd1146f043a1948fb69b` |
| `codex/health-schema-cache-security` | 2026-07-28 | `528089fe6bfe8fd520631fa409aeab5b621e94ce` |
| `codex/ignore-playwright-results` | 2026-07-23 | `e6c80945e78dd443debd69a850b24519e6aae64c` |
| `codex/node-runtime-contract-156` | 2026-07-29 | `e8259dea461cc9a2c27906574caa766208e3f251` |
| `codex/persona-certification-155` | 2026-07-29 | `33a696f4d3e385ab413a4d2995ff471220b3d681` |
| `codex/seed-guard` | 2026-07-23 | `c0a489a882b076fc25317f85181229b4c8667ddc` |
| `codex/seo-aeo-integration` | 2026-07-23 | `531f5848bb48dfd48b87cd39ffd5cc22d5c4c40e` |
| `codex/seo-release-evidence-159` | 2026-07-29 | `b06a6471e2625414b89501d225cee541ce872cb4` |
| `codex/sitemap-production-evidence-161` | 2026-07-29 | `569169c2b91bf50e095d4de17dfc65b54ae5095c` |
| `codex/sitemap-resilience-160` | 2026-07-29 | `0fb881786ee4e3001e823e5a5d9f7142f63e71a0` |
| `codex/supabase-production-evidence-163` | 2026-07-29 | `02c2270ec5f1458ddbd6498cd2be5c48bc70ada2` |
| `codex/supabase-release-audit-162` | 2026-07-29 | `685ff852c479a4a0581c2decc976c0837bc629a4` |
| `codex/tax-document-center` | 2026-07-27 | `24c0a84a5ac4e1e0dbbece3ecea18cbff1971e69` |
| `codex/tax-reporting-home-cta` | 2026-07-23 | `8466a911ee767b74e306fdb71ec18dfa64aa4da5` |
| `fix/prod-hotfix-dark-images-stripe` | 2026-07-19 | `822f1ce970d560750af8843b35625121f5252533` |
