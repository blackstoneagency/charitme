import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import { agentById } from '../../../../../lib/ai-agents-core';
import { buildAgentContext } from '../../../../../lib/ai-context';

export const dynamic = 'force-dynamic';

// POST /api/admin/ai/context — build an agent's context pack.
//
// Super-admin only. Read-only with respect to platform data; the only write is
// the audit-log entry, so an owner can later see which agent was briefed and
// when.
export async function POST(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  let agentId = '';
  try {
    const body = (await request.json()) as { agentId?: unknown };
    agentId = typeof body.agentId === 'string' ? body.agentId : '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 });
  }

  const agent = agentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent', code: 'UNKNOWN_AGENT' }, { status: 404 });
  }

  const { pack, snapshot } = await buildAgentContext(agent);

  await logSuperAdminAction(guard.user.id, 'ai.context.build', 'ai_agent', agent.id, {
    missing: pack.missing,
    github: snapshot.repo.health,
    supabase: snapshot.platform.health,
  });

  return NextResponse.json({
    pack,
    sources: {
      github: { health: snapshot.repo.health, repo: snapshot.repo.repo, reason: snapshot.repo.reason },
      supabase: { health: snapshot.platform.health },
    },
  });
}
