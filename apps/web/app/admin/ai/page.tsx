import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../lib/auth';
import { fetchContextSnapshot } from '../../../lib/ai-context';
import { AI_AGENTS, resolveAgentStatus, type AgentStatus } from '../../../lib/ai-agents-core';
import AiControlCenterClient from './_components/AiControlCenterClient';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// AI Control Center — /admin/ai
//
// Phase 1 of the AI Context Manager: the roster of platform agents, the live
// state of the two sources they draw context from, and a one-click context build
// per agent.
//
// Access is doubly gated. app/admin/layout.tsx already requires admin; this page
// additionally calls requireSuperAdmin(), which redirects a plain admin to
// /admin. The sidebar entry self-gates through the same check, so a non-super
// admin neither sees the link nor can reach the URL directly.
// ─────────────────────────────────────────────────────────────────────────────

export default async function AiControlCenterPage() {
  await requireSuperAdmin();

  const snapshot = await fetchContextSnapshot();

  const agents = AI_AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    mandate: agent.mandate,
    responsibilities: [...agent.responsibilities],
    requires: [...agent.requires],
    status: resolveAgentStatus(agent, snapshot.health) as AgentStatus,
  }));

  return (
    <CharitMeShell active="AI Control Center" mode="admin">
      <TopBar
        title="AI Control Center"
        subtitle="Agent roster and context manager · gated to super_admin"
      />
      <AiControlCenterClient
        agents={agents}
        github={{
          health: snapshot.repo.health,
          repo: snapshot.repo.repo,
          reason: snapshot.repo.reason,
          openIssues: snapshot.repo.openIssues,
          openPullRequests: snapshot.repo.openPullRequests,
          sprint: snapshot.repo.sprint,
        }}
        platform={{
          health: snapshot.platform.health,
          users: snapshot.platform.users,
          activeCampaigns: snapshot.platform.activeCampaigns,
          donations: snapshot.platform.donations,
          openSupportCases: snapshot.platform.openSupportCases,
          openRiskFlags: snapshot.platform.openRiskFlags,
        }}
      />
    </CharitMeShell>
  );
}
