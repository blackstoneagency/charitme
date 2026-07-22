import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoneyShort } from '@shared/currencies';
import { Badge } from '../../../components/ui';
import { getUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { getProgram, reservedMatchForEmployee } from '../../../lib/matching';
import { isAcceptingClaims, remainingCap } from '../../../lib/matching-core';
import { safeJsonLd } from '../../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../../lib/public-routes';
import { seoMetadata } from '../../../lib/seo';
import MatchClaimPanel from './MatchClaimPanel';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getProgram(id);
  if (!p) return { title: 'Program not found' };
  const description = p.description?.slice(0, 155) ?? `Claim matching gifts from ${p.company_name} on CharitMe.`;
  return seoMetadata(`/matching/${p.id}`, {
    title: `${p.company_name} Matching Gifts`,
    description,
    alternates: { canonical: `/matching/${p.id}` },
    openGraph: {
      title: `${p.company_name} Matching Gifts`,
      description,
      url: `/matching/${p.id}`,
      type: 'website',
    },
  });
}

export const dynamic = 'force-dynamic';

export default async function MatchingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const p = await getProgram(id);
  if (!p) notFound();

  const user = await getUser();
  const isSponsor = user?.id === p.sponsor_id;
  const programJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: `${p.company_name} Matching Gifts`,
    description: p.description ?? `${p.company_name} matching gift program on CharitMe.`,
    url: `${CHARITME_ORIGIN}/matching/${p.id}`,
    availability: isAcceptingClaims(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    priceCurrency: p.currency,
    eligibleCustomerType: 'Employee',
    offeredBy: {
      '@type': 'Organization',
      name: p.company_name,
    },
  };

  let myClaims: { id: string; status: string; donation_amount_cents: number; match_amount_cents: number }[] = [];
  let remainingCapCents: number | null = null;
  if (user && !isSponsor) {
    const { data } = await supabaseAdmin
      .from('matching_claims')
      .select('id, status, donation_amount_cents, match_amount_cents')
      .eq('program_id', p.id)
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false });
    myClaims = (data ?? []) as typeof myClaims;
    const used = await reservedMatchForEmployee(p.id, user.id);
    const rem = remainingCap(p.annual_cap_cents, used);
    remainingCapCents = Number.isFinite(rem) ? rem : null;
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(programJsonLd) }} />
    <div className="container" style={{ padding: '40px 24px', maxWidth: 780 }}>
      <Link href="/matching" style={{ fontSize: 14, color: 'var(--t3)', textDecoration: 'none' }}>
        ← All matching programs
      </Link>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 12px' }}>
        <Badge color="green">{p.match_ratio}:1 match</Badge>
        {p.annual_cap_cents > 0 && <Badge color="gray">Up to {formatMoneyShort(p.annual_cap_cents, p.currency)}/yr</Badge>}
        {p.min_donation_cents > 0 && <Badge color="gray">Min {formatMoneyShort(p.min_donation_cents, p.currency)}</Badge>}
        {!isAcceptingClaims(p) && <Badge color="red">Not accepting claims</Badge>}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{p.company_name}</h1>
      {p.description && (
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>{p.description}</p>
      )}
      {p.categories.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 14, color: 'var(--t3)' }}>
          <strong>Eligible categories:</strong> {p.categories.join(', ')}
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--b2)' }}>
        <MatchClaimPanel
          programId={p.id}
          currency={p.currency}
          matchRatio={p.match_ratio}
          minDonationCents={p.min_donation_cents}
          remainingCapCents={remainingCapCents}
          signedIn={!!user}
          isSponsor={isSponsor}
          accepting={isAcceptingClaims(p)}
          initialClaims={myClaims}
        />
      </div>
    </div>
    </>
  );
}
