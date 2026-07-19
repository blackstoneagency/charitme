import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { challengeProgressPct, computeChallengeProgress, type ChallengeGoalType } from '../../../lib/challenges';
import { DONOR_BADGES } from '../../../lib/gamification';
import ChallengesClient, { type ChallengeView, type BadgeView } from './ChallengesClient';

export const dynamic = 'force-dynamic';

export default async function ChallengesPage() {
  const user = await requireUser();

  const [{ data: challenges }, { data: joinedRows }, { data: badgeRows }] = await Promise.all([
    supabaseAdmin
      .from('challenges')
      .select('id, title, description, goal_type, goal_target_cents, starts_at, ends_at')
      .eq('status', 'active')
      .order('ends_at', { ascending: true, nullsFirst: false })
      .limit(50),
    supabaseAdmin.from('challenge_participants').select('challenge_id').eq('user_id', user.id),
    supabaseAdmin.from('user_badges').select('badge_id, awarded_at').eq('user_id', user.id),
  ]);

  const joined = new Set((joinedRows ?? []).map((r) => r.challenge_id));
  const list = challenges ?? [];

  // Live progress for joined challenges.
  const progressById: Record<string, number> = {};
  for (const c of list) {
    if (!joined.has(c.id)) continue;
    let q = supabaseAdmin.from('donations').select('amount_cents').eq('donor_id', user.id).eq('status', 'completed');
    if (c.starts_at) q = q.gte('created_at', c.starts_at);
    if (c.ends_at) q = q.lte('created_at', c.ends_at);
    const { data: dons } = await q;
    progressById[c.id] = computeChallengeProgress(c.goal_type as ChallengeGoalType, (dons ?? []).map((d) => d.amount_cents ?? 0));
  }

  const challengeViews: ChallengeView[] = list.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    goalType: c.goal_type,
    goalTargetCents: c.goal_target_cents,
    endsAt: c.ends_at,
    joined: joined.has(c.id),
    progress: progressById[c.id] ?? 0,
    progressPct: challengeProgressPct(progressById[c.id] ?? 0, c.goal_target_cents),
  }));

  const awardedMap = new Map((badgeRows ?? []).map((b) => [b.badge_id, b.awarded_at as string]));
  const badges: BadgeView[] = DONOR_BADGES.map((b) => ({
    id: b.id,
    icon: b.icon,
    label: b.label,
    description: b.description,
    earned: awardedMap.has(b.id),
  }));

  return (
    <CharitMeShell active="Challenges">
      <TopBar title="Challenges & badges" subtitle="Join giving challenges, track your progress, and earn badges for your impact." />
      <div className="kf-admin-dash">
        <ChallengesClient initialChallenges={challengeViews} badges={badges} />
      </div>
    </CharitMeShell>
  );
}
