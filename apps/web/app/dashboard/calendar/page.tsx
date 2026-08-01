import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import CalendarClient, { type CalendarEntry } from './CalendarClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Calendar | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Calendar (design #144).
//
// There is no `calendar_events` table, and inventing one would have shipped a
// migration that cannot be applied from here — inert in production, like
// `volunteer_shifts` already is. But the dates a fundraiser actually needs to
// see are ALREADY in the database, spread across three tables nothing brings
// together:
//
//   • campaigns.deadline        — when a campaign stops accepting donations
//   • fundraising_events        — starts_at / ends_at
//   • grant_deadlines.due_at    — via the grants this user applied to
//
// So this page is an aggregator, not a new feature. No new table, nothing inert.
//
// ⚠️ `volunteer_shifts` is deliberately NOT a source even though it carries
// starts_at/ends_at: it is one of the tables whose migration has not been
// applied to production (see the migrations runbook). Querying it would put this
// page into its degraded state permanently in prod while working fine locally —
// which is exactly the trap that makes "works on my machine" schema drift
// expensive. Add it as a source when that migration lands.
//
// Each source is read INDEPENDENTLY and may fail on its own. A calendar that
// blanks out because one of three queries failed is worse than one that shows
// two sources and says which one is missing.
// ─────────────────────────────────────────────────────────────────────────────

type SourceResult = { entries: CalendarEntry[]; failed: boolean };

async function campaignDeadlines(userId: string): Promise<SourceResult> {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, deadline')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('deadline', 'is', null)
    .limit(300);
  if (error) return { entries: [], failed: true };
  return {
    failed: false,
    entries: (data ?? []).flatMap((c) => {
      const row = c as { id: string; title: string; slug: string; deadline: string | null };
      if (!row.deadline) return [];
      return [{
        id: `campaign-${row.id}`,
        kind: 'deadline' as const,
        title: row.title,
        date: row.deadline,
        href: `/campaigns/${row.slug}`,
      }];
    }),
  };
}

async function events(userId: string): Promise<SourceResult> {
  // Scoped through the caller's campaigns: fundraising_events has no owner
  // column of its own, only campaign_id / nonprofit_id.
  const { data: campaigns, error: cErr } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(300);
  if (cErr) return { entries: [], failed: true };

  const ids = (campaigns ?? []).map((c) => (c as { id: string }).id);
  if (ids.length === 0) return { entries: [], failed: false };

  const { data, error } = await supabaseAdmin
    .from('fundraising_events')
    .select('id, title, slug, starts_at, ends_at, status')
    .in('campaign_id', ids)
    .neq('status', 'cancelled')
    .limit(300);
  if (error) return { entries: [], failed: true };

  return {
    failed: false,
    entries: (data ?? []).map((e) => {
      const row = e as { id: string; title: string; slug: string; starts_at: string; ends_at: string | null };
      return {
        id: `event-${row.id}`,
        kind: 'event' as const,
        title: row.title,
        date: row.starts_at,
        endDate: row.ends_at,
        href: `/events/${row.slug}`,
      };
    }),
  };
}

async function grantDeadlines(userId: string): Promise<SourceResult> {
  const { data: apps, error: aErr } = await supabaseAdmin
    .from('grant_applications')
    .select('grant_id')
    .eq('applicant_user_id', userId)
    .not('status', 'in', '("withdrawn","rejected")')
    .limit(300);
  if (aErr) return { entries: [], failed: true };

  const grantIds = [...new Set((apps ?? []).map((a) => (a as { grant_id: string }).grant_id))];
  if (grantIds.length === 0) return { entries: [], failed: false };

  const { data, error } = await supabaseAdmin
    .from('grant_deadlines')
    .select('id, label, kind, due_at, grant_id')
    .in('grant_id', grantIds)
    .limit(300);
  if (error) return { entries: [], failed: true };

  return {
    failed: false,
    entries: (data ?? []).map((d) => {
      const row = d as { id: string; label: string; kind: string; due_at: string };
      return {
        id: `grant-${row.id}`,
        kind: 'grant' as const,
        title: `${row.label} (${row.kind})`,
        date: row.due_at,
        href: '/dashboard/grants',
      };
    }),
  };
}

export default async function CalendarPage() {
  const user = await requireUser();

  const [deadlines, evts, grants] = await Promise.all([
    campaignDeadlines(user.id),
    events(user.id),
    grantDeadlines(user.id),
  ]);

  const failedSources = [
    deadlines.failed ? 'campaign deadlines' : null,
    evts.failed ? 'events' : null,
    grants.failed ? 'grant deadlines' : null,
  ].filter((s): s is string => s !== null);

  const entries = [...deadlines.entries, ...evts.entries, ...grants.entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <CharitMeShell active="Calendar">
      <TopBar title="Calendar" subtitle="Your campaign deadlines, events, and grant dates in one place." />
      <CalendarClient entries={entries} failedSources={failedSources} nowIso={new Date().toISOString()} />
    </CharitMeShell>
  );
}
