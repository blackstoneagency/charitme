import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Gamification persistence — computes donor stats, awards earned badges, and
// tracks community-challenge progress. Pure catalog/logic lives in
// `gamification.ts` (DONOR_BADGES) and `challenges-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { DONOR_BADGES, computeMonthlyStreak, getGivingLevel, type DonorStats } from './gamification';
import {
  metricValue,
  challengeProgressPercent,
  isChallengeComplete,
  type Challenge,
} from './challenges-core';

/** Compute a user's donor stats from their completed donations + campaigns. */
export async function getUserStats(userId: string): Promise<DonorStats> {
  const [{ data: donations }, { count: recurringCount }] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('amount_cents, campaign_id, created_at')
      .eq('donor_id', userId)
      .eq('status', 'completed'),
    supabaseAdmin
      .from('recurring_donations')
      .select('id', { count: 'exact', head: true })
      .eq('donor_id', userId)
      .eq('status', 'active'),
  ]);

  const rows = donations ?? [];
  const totalCents = rows.reduce((s, r) => s + (r.amount_cents as number), 0);
  const supportedCampaigns = new Set(rows.map((r) => r.campaign_id as string)).size;
  const monthStreak = computeMonthlyStreak(rows.map((r) => r.created_at as string));

  return {
    donationCount: rows.length,
    totalCents,
    campaignCount: supportedCampaigns, // distinct campaigns the user has SUPPORTED
    hasRecurring: (recurringCount ?? 0) > 0,
    monthStreak,
  };
}

export interface BadgeView {
  id: string;
  icon: string;
  label: string;
  description: string;
  earned: boolean;
  awarded_at: string | null;
}

/**
 * Evaluate the badge catalog against the user's stats and persist any newly
 * earned badges (idempotent). Returns the full catalog with earned flags.
 */
export async function syncAndGetBadges(userId: string): Promise<{ badges: BadgeView[]; stats: DonorStats }> {
  const stats = await getUserStats(userId);

  const { data: existing } = await supabaseAdmin
    .from('user_badges')
    .select('badge_id, awarded_at')
    .eq('user_id', userId);
  const awardedAt = new Map((existing ?? []).map((r) => [r.badge_id as string, r.awarded_at as string]));

  // Insert any newly-earned badges the user doesn't already have.
  const toInsert = DONOR_BADGES.filter((b) => b.earned(stats) && !awardedAt.has(b.id)).map((b) => ({
    user_id: userId,
    badge_id: b.id,
  }));
  if (toInsert.length) {
    await supabaseAdmin.from('user_badges').upsert(toInsert, { onConflict: 'user_id,badge_id' });
    const now = new Date().toISOString();
    for (const b of toInsert) awardedAt.set(b.badge_id, now);
  }

  const badges: BadgeView[] = DONOR_BADGES.map((b) => ({
    id: b.id,
    icon: b.icon,
    label: b.label,
    description: b.description,
    earned: b.earned(stats),
    awarded_at: awardedAt.get(b.id) ?? null,
  }));

  return { badges, stats };
}

export function givingLevelFor(totalCents: number) {
  return getGivingLevel(totalCents);
}

export interface ChallengeView extends Challenge {
  joined: boolean;
  value: number;
  percent: number;
  complete: boolean;
  participant_count: number;
}

/** Active challenges with the user's progress (refreshing joined participants). */
export async function listChallengesForUser(userId: string, stats: DonorStats): Promise<ChallengeView[]> {
  const { data: challenges } = await supabaseAdmin
    .from('challenges')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  const list = (challenges ?? []) as Challenge[];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const [{ data: mine }, { data: allParticipants }] = await Promise.all([
    supabaseAdmin.from('challenge_participants').select('challenge_id, completed_at').eq('user_id', userId).in('challenge_id', ids),
    supabaseAdmin.from('challenge_participants').select('challenge_id').in('challenge_id', ids),
  ]);
  const joined = new Set((mine ?? []).map((r) => r.challenge_id as string));
  const counts = new Map<string, number>();
  for (const p of allParticipants ?? []) counts.set(p.challenge_id as string, (counts.get(p.challenge_id as string) ?? 0) + 1);

  const views: ChallengeView[] = [];
  for (const c of list) {
    const value = metricValue(stats, c.metric);
    const complete = isChallengeComplete(value, c.goal_value);
    const isJoined = joined.has(c.id);

    // Keep joined participants' progress fresh.
    if (isJoined) {
      await supabaseAdmin
        .from('challenge_participants')
        .update({ progress_value: value, completed_at: complete ? new Date().toISOString() : null })
        .eq('challenge_id', c.id)
        .eq('user_id', userId);
    }

    views.push({
      ...c,
      joined: isJoined,
      value,
      percent: challengeProgressPercent(value, c.goal_value),
      complete,
      participant_count: counts.get(c.id) ?? 0,
    });
  }
  return views;
}

/** Join a challenge, seeding progress from the user's current stats. */
export async function joinChallenge(userId: string, challengeId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: challenge } = await supabaseAdmin
    .from('challenges')
    .select('metric, goal_value, status')
    .eq('id', challengeId)
    .maybeSingle();
  if (!challenge) return { ok: false, error: 'Challenge not found' };
  if (challenge.status !== 'active') return { ok: false, error: 'Challenge is not active' };

  const stats = await getUserStats(userId);
  const value = metricValue(stats, challenge.metric as Challenge['metric']);
  const complete = isChallengeComplete(value, challenge.goal_value as number);

  const { error } = await supabaseAdmin.from('challenge_participants').upsert(
    {
      challenge_id: challengeId,
      user_id: userId,
      progress_value: value,
      completed_at: complete ? new Date().toISOString() : null,
    },
    { onConflict: 'challenge_id,user_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
