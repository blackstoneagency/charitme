import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOpportunityBySlug } from '../../../lib/volunteers-server';
import { hasOpenSlots } from '../../../lib/volunteers';
import { Badge } from '../../../components/ui';
import { safeJsonLd } from '../../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../../lib/public-routes';
import { seoMetadata } from '../../../lib/seo';
import AeoContent from '../../../components/AeoContent';
import VolunteerApplyButton from './VolunteerApplyButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const opp = await getOpportunityBySlug(slug);
  if (!opp) return { title: 'Opportunity not found' };
  return seoMetadata(`/volunteer/${opp.slug}`, {
    title: `${opp.title} — ${opp.org_name}`,
    description: opp.summary ?? `Volunteer opportunity with ${opp.org_name} on CharitMe.`,
    alternates: { canonical: `https://www.charitme.com/volunteer/${opp.slug}` },
  });
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const opp = await getOpportunityBySlug(slug);
  if (!opp) notFound();

  const full = !hasOpenSlots(opp);
  const volunteerJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VolunteerAction',
    name: opp.title,
    description: opp.description ?? opp.summary ?? `Volunteer with ${opp.org_name}.`,
    url: `${CHARITME_ORIGIN}/volunteer/${opp.slug}`,
    actionStatus: full ? 'https://schema.org/CompletedActionStatus' : 'https://schema.org/PotentialActionStatus',
    startTime: opp.starts_at ?? undefined,
    endTime: opp.ends_at ?? undefined,
    location: opp.is_remote
      ? { '@type': 'VirtualLocation', name: 'Remote' }
      : opp.location || opp.country
        ? { '@type': 'Place', name: opp.location ?? opp.country }
        : undefined,
    organizer: {
      '@type': 'Organization',
      name: opp.org_name,
    },
    skills: opp.skills.length > 0 ? opp.skills : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(volunteerJsonLd) }} />
      <div className="container" style={{ padding: '32px 24px', maxWidth: 980 }}>
      <Link href="/volunteer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)' }}>← All opportunities</Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 440px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)' }}>{opp.org_name}</span>
            {opp.verified && <Badge color="green">Verified</Badge>}
            {opp.is_remote && <Badge color="blue">Remote</Badge>}
            {opp.category && <Badge color="gray">{opp.category}</Badge>}
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, margin: 0, lineHeight: 1.25, color: 'var(--t1)' }}>{opp.title}</h1>
          {opp.summary && <p style={{ fontSize: 16, color: 'var(--t2)', margin: 0, lineHeight: 1.5 }}>{opp.summary}</p>}

          {opp.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {opp.skills.map((s) => <Badge key={s} color="gray">{s}</Badge>)}
            </div>
          )}

          {opp.description && (
            <section>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', margin: '8px 0' }}>About this role</h2>
              <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{opp.description}</p>
            </section>
          )}
        </div>

        <aside style={{
          display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start',
          flex: '1 1 280px', maxWidth: 340,
          background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 20,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>When</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>
              {opp.starts_at
                ? new Date(opp.starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Flexible'}
            </div>
          </div>
          {opp.time_commitment && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Commitment</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{opp.time_commitment}</div>
            </div>
          )}
          {(opp.location || opp.is_remote) && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Location</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{opp.is_remote ? 'Remote' : opp.location}</div>
            </div>
          )}
          {opp.slots != null && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Spots</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: full ? 'var(--red)' : 'var(--t1)' }}>
                {full ? 'Full' : `${opp.slots - opp.slots_filled} of ${opp.slots} open`}
              </div>
            </div>
          )}

          {full ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--s3)', color: 'var(--t3)', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
              This opportunity is full
            </div>
          ) : (
            <VolunteerApplyButton slug={opp.slug} />
          )}
          <p style={{ fontSize: 11, color: 'var(--t4)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
            Applying notifies the organizer and tracks your application in your dashboard.
          </p>
        </aside>
      </div>
      </div>
      <AeoContent route={`/volunteer/${opp.slug}`} title="Volunteer opportunity answers" />
    </>
  );
}
