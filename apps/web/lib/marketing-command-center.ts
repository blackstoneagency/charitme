import 'server-only';
import { supabaseAdmin } from './supabase';
import { measureGoalProgress, type MarketingGoal, type GoalProgress } from './marketing-goals';

// Executive Command Center data — every number is read live from Supabase.
// Nothing here is synthesized: deltas are real week-over-week table queries,
// goal progress reuses the same measurement the Goals page uses, and the
// activity feed is the real marketing_audit_logs stream.

export interface Delta {
  label: string;
  current: number;
  previous: number;
  unit: 'count' | 'cents';
  changePct: number | null;   // null when previous is 0 (undefined growth)
}

export interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  actor: 'system' | 'human';
  created_at: string;
  summary: string;
}

export interface CommandCenter {
  deltas: Delta[];
  activeGoals: (MarketingGoal & { progress: GoalProgress })[];
  goalsAwaitingActivation: number;
  pulse: { contacts: number; events7d: number; campaignsSent: number };
  activity: ActivityItem[];
  freshness: { events: string | null; donations: string | null };
  generatedAt: string;
}

const WEEK = 7 * 86_400_000;

async function sumDonations(sinceISO: string, untilISO: string): Promise<{ sum: number; count: number }> {
  const { data } = await supabaseAdmin
    .from('donations')
    .select('amount_cents')
    .eq('status', 'completed')
    .gte('created_at', sinceISO)
    .lt('created_at', untilISO)
    .limit(50_000);
  const rows = data ?? [];
  return { sum: rows.reduce((t, d) => t + (d.amount_cents ?? 0), 0), count: rows.length };
}

async function countCampaigns(sinceISO: string, untilISO: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'draft')
    .gte('created_at', sinceISO)
    .lt('created_at', untilISO);
  return count ?? 0;
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function summarizeAudit(action: string, detail: Record<string, unknown> | null): string {
  const d = detail ?? {};
  if (typeof d.title === 'string') return String(d.title);
  if (typeof d.name === 'string') return String(d.name);
  if (typeof d.status === 'string') return `→ ${d.status}`;
  return action.replaceAll('_', ' ');
}

export async function getCommandCenter(): Promise<CommandCenter> {
  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  const weekAgoISO = new Date(now - WEEK).toISOString();
  const twoWeeksAgoISO = new Date(now - 2 * WEEK).toISOString();

  const [
    donCur, donPrev,
    campCur, campPrev,
    contactsRes, events7dRes, campaignsSentRes,
    goalsRes, auditRes,
    lastEventRes, lastDonationRes,
  ] = await Promise.all([
    sumDonations(weekAgoISO, nowISO),
    sumDonations(twoWeeksAgoISO, weekAgoISO),
    countCampaigns(weekAgoISO, nowISO),
    countCampaigns(twoWeeksAgoISO, weekAgoISO),
    supabaseAdmin.from('marketing_contacts').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('marketing_events').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoISO),
    supabaseAdmin.from('marketing_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabaseAdmin.from('marketing_goals').select('*').in('status', ['active', 'draft']).order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('marketing_audit_logs').select('id, action, entity, actor_id, detail, created_at').order('created_at', { ascending: false }).limit(12),
    supabaseAdmin.from('marketing_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('donations').select('created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const allGoals = (goalsRes.data ?? []) as MarketingGoal[];
  const active = allGoals.filter((g) => g.status === 'active').slice(0, 6);
  const activeGoals = await Promise.all(active.map(async (g) => ({ ...g, progress: await measureGoalProgress(g) })));
  const goalsAwaitingActivation = allGoals.filter((g) => g.status === 'draft').length;

  const deltas: Delta[] = [
    { label: 'Donation volume (7d)', current: donCur.sum, previous: donPrev.sum, unit: 'cents', changePct: pct(donCur.sum, donPrev.sum) },
    { label: 'Donations (7d)', current: donCur.count, previous: donPrev.count, unit: 'count', changePct: pct(donCur.count, donPrev.count) },
    { label: 'New fundraisers (7d)', current: campCur, previous: campPrev, unit: 'count', changePct: pct(campCur, campPrev) },
  ];

  const activity: ActivityItem[] = (auditRes.data ?? []).map((a) => ({
    id: a.id as string,
    action: a.action as string,
    entity: a.entity as string,
    actor: a.actor_id ? 'human' : 'system',
    created_at: a.created_at as string,
    summary: summarizeAudit(a.action as string, a.detail as Record<string, unknown> | null),
  }));

  return {
    deltas,
    activeGoals,
    goalsAwaitingActivation,
    pulse: {
      contacts: contactsRes.count ?? 0,
      events7d: events7dRes.count ?? 0,
      campaignsSent: campaignsSentRes.count ?? 0,
    },
    activity,
    freshness: {
      events: (lastEventRes.data?.created_at as string) ?? null,
      donations: (lastDonationRes.data?.created_at as string) ?? null,
    },
    generatedAt: nowISO,
  };
}
