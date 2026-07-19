import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import SponsorBrowseClient, { type SponsorshipCard } from './SponsorBrowseClient';

export const metadata: Metadata = {
  title: 'Sponsorship Opportunities',
  description: 'Sponsor campaigns and causes. Browse sponsorship packages and make an offer.',
  alternates: { canonical: 'https://www.charitme.com/sponsor' },
};

export const dynamic = 'force-dynamic';

export default async function SponsorPage() {
  const { data } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('id, title, description, benefits, min_amount_cents, currency, slots, campaign_id, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100);

  const opportunities: SponsorshipCard[] = (data ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    benefits: (o.benefits as string[]) ?? [],
    minAmountCents: o.min_amount_cents,
    currency: o.currency ?? 'usd',
    slots: o.slots,
  }));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 20px 64px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--t1)', marginBottom: 8 }}>Sponsor a cause</h1>
        <p style={{ fontSize: 16, color: 'var(--t3)', maxWidth: 640 }}>
          Back campaigns and nonprofits with a sponsorship. Browse packages, see the benefits, and make an offer — organizers review and confirm.
        </p>
      </header>
      <SponsorBrowseClient opportunities={opportunities} />
    </div>
  );
}
