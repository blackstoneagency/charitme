import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { computeMonthlyStreak, DONOR_BADGES, newlyEarnedBadges, type DonorStats } from '../../../lib/gamification';

export const dynamic = 'force-dynamic';

// GET /api/badges
// Returns the caller's persisted badges, awarding any newly-earned ones from
// their current donation stats (idempotent — persists so they stay earned).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Current stats.
  const [{ data: donations }, { count: recurringCount }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('donations').select('amount_cents, campaign_id, created_at').eq('donor_id', user.id).eq('status', 'completed'),
    supabaseAdmin.from('recurring_donations').select('id', { count: 'exact', head: true }).eq('donor_id', user.id).eq('status', 'active'),
    supabaseAdmin.from('user_badges').select('badge_id, awarded_at').eq('user_id', user.id),
  ]);

  const rows = donations ?? [];
  const stats: DonorStats = {
    donationCount: rows.length,
    totalCents: rows.reduce((s, d) => s + (d.amount_cents ?? 0), 0),
    campaignCount: new Set(rows.map((d) => d.campaign_id)).size,
    hasRecurring: (recurringCount ?? 0) > 0,
    monthStreak: computeMonthlyStreak(rows.map((d) => d.created_at as string)),
  };

  const awarded = existing ?? [];
  const fresh = newlyEarnedBadges(stats, awarded.map((b) => b.badge_id));
  let newlyAwarded: string[] = [];
  if (fresh.length > 0) {
    const { error } = await supabaseAdmin
      .from('user_badges')
      .upsert(fresh.map((badge_id) => ({ user_id: user.id, badge_id })), { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
    if (!error) newlyAwarded = fresh;
  }

  const awardedMap = new Map(awarded.map((b) => [b.badge_id, b.awarded_at as string]));
  const badges = DONOR_BADGES.map((b) => ({
    id: b.id,
    icon: b.icon,
    label: b.label,
    description: b.description,
    earned: b.earned(stats),
    awardedAt: awardedMap.get(b.id) ?? (newlyAwarded.includes(b.id) ? new Date().toISOString() : null),
  }));

  return NextResponse.json({ badges, newlyAwarded, stats });
}
