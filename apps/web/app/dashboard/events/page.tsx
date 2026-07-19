import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import EventsManageClient, { type ManagedEvent, type CampaignOption } from './EventsManageClient';

export const dynamic = 'force-dynamic';

export default async function DashboardEventsPage() {
  const user = await requireUser();

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, title')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const campaignOptions: CampaignOption[] = (campaigns ?? []).map((c) => ({ id: c.id, title: c.title }));
  const campaignIds = campaignOptions.map((c) => c.id);

  let events: ManagedEvent[] = [];
  if (campaignIds.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from('fundraising_events')
      .select('id, title, slug, event_type, starts_at, location, status, campaign_id')
      .in('campaign_id', campaignIds)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true });

    const eventIds = (rows ?? []).map((e) => e.id);
    const regCounts: Record<string, number> = {};
    if (eventIds.length > 0) {
      for (const e of rows ?? []) {
        const { count } = await supabaseAdmin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', e.id);
        regCounts[e.id] = count ?? 0;
      }
    }

    events = (rows ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      eventType: e.event_type,
      startsAt: e.starts_at,
      location: e.location,
      status: e.status,
      registrations: regCounts[e.id] ?? 0,
    }));
  }

  return (
    <CharitMeShell active="Events">
      <TopBar title="Events" subtitle="Create and publish fundraising events, and track registrations." />
      <div className="kf-admin-dash">
        <EventsManageClient initialEvents={events} campaigns={campaignOptions} />
      </div>
    </CharitMeShell>
  );
}
