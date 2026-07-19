import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import AdminChallengesClient, { type AdminChallenge } from './AdminChallengesClient';

export const dynamic = 'force-dynamic';

export default async function AdminChallengesPage() {
  await requireAdmin();

  const { data } = await supabaseAdmin
    .from('challenges')
    .select('id, title, description, goal_type, goal_target_cents, starts_at, ends_at, status, created_at')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  const rows = data ?? [];
  const counts: Record<string, number> = {};
  for (const c of rows) {
    const { count } = await supabaseAdmin.from('challenge_participants').select('id', { count: 'exact', head: true }).eq('challenge_id', c.id);
    counts[c.id] = count ?? 0;
  }

  const challenges: AdminChallenge[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    goalType: c.goal_type,
    goalTargetCents: c.goal_target_cents,
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    status: c.status,
    participantCount: counts[c.id] ?? 0,
  }));

  return (
    <CharitMeShell active="Challenges" mode="admin">
      <TopBar title="Challenges" subtitle="Create and manage giving challenges shown to donors." />
      <div className="kf-admin-dash">
        <AdminChallengesClient initialChallenges={challenges} />
      </div>
    </CharitMeShell>
  );
}
