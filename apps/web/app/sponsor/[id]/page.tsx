import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoneyShort } from '@shared/currencies';
import { Badge, ProgressBar } from '../../../components/ui';
import { getUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { getOpportunity as _getOpportunity } from '../../../lib/sponsorships';

// Dedupe the opportunity lookup across generateMetadata + the page.
const getOpportunity = cache(_getOpportunity);
import { isAcceptingRequests, fundingProgress } from '../../../lib/sponsorships-core';
import SponsorPanel from './SponsorPanel';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) return { title: 'Opportunity not found' };
  return { title: `${o.title} — Sponsorship`, description: o.description.slice(0, 155) };
}

export const dynamic = 'force-dynamic';

export default async function SponsorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) notFound();

  const user = await getUser();
  const isOrganizer = user?.id === o.organizer_id;

  let existingStatus: string | null = null;
  if (user && !isOrganizer) {
    const { data } = await supabaseAdmin
      .from('sponsorship_requests')
      .select('status')
      .eq('opportunity_id', o.id)
      .eq('sponsor_id', user.id)
      .maybeSingle();
    existingStatus = (data?.status as string | undefined) ?? null;
  }

  const accepting = isAcceptingRequests(o);
  const progress = fundingProgress(o);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 820 }}>
      <Link href="/sponsor" style={{ fontSize: 14, color: 'var(--t3)', textDecoration: 'none' }}>
        ← All opportunities
      </Link>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 12px' }}>
        <Badge color="blue">{o.category}</Badge>
        {o.min_amount_cents > 0 && <Badge color="gray">From {formatMoneyShort(o.min_amount_cents, o.currency)}</Badge>}
        {!accepting && <Badge color="red">Closed</Badge>}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>{o.title}</h1>

      <div style={{ fontSize: 14, color: 'var(--t4)', marginBottom: 20 }}>
        {o.organizer_name && <span>Posted by {o.organizer_name}</span>}
        {o.campaign_slug && o.campaign_title && (
          <>
            {' · '}
            <Link href={`/campaigns/${o.campaign_slug}`} style={{ color: 'var(--green-dark)' }}>
              {o.campaign_title}
            </Link>
          </>
        )}
      </div>

      {progress !== null && (
        <div style={{ marginBottom: 24 }}>
          <ProgressBar value={o.raised_amount_cents} max={o.target_amount_cents ?? 1} />
          <div style={{ fontSize: 13, color: 'var(--t4)', marginTop: 6 }}>
            {formatMoneyShort(o.raised_amount_cents, o.currency)} of{' '}
            {formatMoneyShort(o.target_amount_cents ?? 0, o.currency)} committed ({progress}%)
          </div>
        </div>
      )}

      <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{o.description}</p>

      {o.benefits && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>What sponsors receive</h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{o.benefits}</p>
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--b2)' }}>
        <SponsorPanel
          opportunityId={o.id}
          currency={o.currency}
          minAmountCents={o.min_amount_cents}
          signedIn={!!user}
          isOrganizer={isOrganizer}
          accepting={accepting}
          existingStatus={existingStatus}
        />
      </div>
    </div>
  );
}
