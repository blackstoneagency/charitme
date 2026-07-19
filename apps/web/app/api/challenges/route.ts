import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { challengeProgressPct, computeChallengeProgress, type ChallengeGoalType } from '../../../lib/challenges';

export const dynamic = 'force-dynamic';

// GET /api/challenges
// Public list of active challenges. For a signed-in user, includes whether they
// joined and their live progress (recomputed from donations in the window).
export async function GET() {
  const { data: challenges, error } = await supabaseAdmin
    .from('challenges')
    .select('id, slug, title, description, goal_type, goal_target_cents, starts_at, ends_at, status')
    .eq('status', 'active')
    .order('ends_at', { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = challenges ?? [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Participant counts for social proof.
  const counts: Record<string, number> = {};
  for (const c of list) {
    const { count } = await supabaseAdmin
      .from('challenge_participants')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', c.id);
    counts[c.id] = count ?? 0;
  }

  let joinedIds = new Set<string>();
  const progressById: Record<string, number> = {};
  if (user) {
    const { data: parts } = await supabaseAdmin
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', user.id)
      .in('challenge_id', list.map((c) => c.id).length ? list.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000']);
    joinedIds = new Set((parts ?? []).map((p) => p.challenge_id));

    // Live progress from the user's donations within each joined challenge window.
    for (const c of list) {
      if (!joinedIds.has(c.id)) continue;
      let q = supabaseAdmin.from('donations').select('amount_cents').eq('donor_id', user.id).eq('status', 'completed');
      if (c.starts_at) q = q.gte('created_at', c.starts_at);
      if (c.ends_at) q = q.lte('created_at', c.ends_at);
      const { data: dons } = await q;
      const progress = computeChallengeProgress(c.goal_type as ChallengeGoalType, (dons ?? []).map((d) => d.amount_cents ?? 0));
      progressById[c.id] = progress;
      // Persist the recomputed progress (best-effort).
      await supabaseAdmin.from('challenge_participants').update({ progress_cents: progress }).eq('challenge_id', c.id).eq('user_id', user.id).then(() => {}, () => {});
    }
  }

  return NextResponse.json({
    challenges: list.map((c) => ({
      ...c,
      participantCount: counts[c.id] ?? 0,
      joined: joinedIds.has(c.id),
      progress: progressById[c.id] ?? 0,
      progressPct: challengeProgressPct(progressById[c.id] ?? 0, c.goal_target_cents),
    })),
  });
}
