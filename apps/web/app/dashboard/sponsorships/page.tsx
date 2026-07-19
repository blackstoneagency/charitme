import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import SponsorshipsManageClient, { type ManagedOpportunity, type SponsorRequest } from './SponsorshipsManageClient';

export const dynamic = 'force-dynamic';

export default async function SponsorshipsPage() {
  const user = await requireUser();

  const { data: oppRows } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('id, title, description, benefits, min_amount_cents, currency, slots, status, created_at')
    .eq('organizer_id', user.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  const opportunities = oppRows ?? [];
  const oppIds = opportunities.map((o) => o.id);

  const requestsByOpp: Record<string, SponsorRequest[]> = {};
  if (oppIds.length > 0) {
    const { data: reqs } = await supabaseAdmin
      .from('sponsorship_requests')
      .select('id, opportunity_id, sponsor_id, sponsor_name, amount_cents, message, status, created_at')
      .in('opportunity_id', oppIds)
      .order('created_at', { ascending: false });

    const sponsorIds = [...new Set((reqs ?? []).map((r) => r.sponsor_id))];
    const nameMap = new Map<string, string>();
    if (sponsorIds.length > 0) {
      const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', sponsorIds);
      for (const p of profs ?? []) nameMap.set(p.id, (p.full_name as string) || (p.email as string) || 'Sponsor');
    }

    for (const r of reqs ?? []) {
      (requestsByOpp[r.opportunity_id] ??= []).push({
        id: r.id,
        sponsorName: r.sponsor_name || nameMap.get(r.sponsor_id) || 'Sponsor',
        amountCents: Number(r.amount_cents) || 0,
        message: r.message,
        status: r.status,
      });
    }
  }

  const managed: ManagedOpportunity[] = opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    benefits: (o.benefits as string[]) ?? [],
    minAmountCents: o.min_amount_cents,
    currency: o.currency ?? 'usd',
    slots: o.slots,
    status: o.status,
    requests: requestsByOpp[o.id] ?? [],
  }));

  return (
    <CharitMeShell active="Sponsorships">
      <TopBar title="Sponsorships" subtitle="Post sponsorship packages and review offers from sponsors." />
      <div className="kf-admin-dash">
        <SponsorshipsManageClient initialOpportunities={managed} />
      </div>
    </CharitMeShell>
  );
}
