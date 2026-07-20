import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getGrantBySlug, getGrantDeadlines } from '../../../lib/grants-server';
import { Badge } from '../../../components/ui';
import ApplyButton from './ApplyButton';

export const dynamic = 'force-dynamic';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(Math.round(cents / 100));
}

function amountRange(min: number | null, max: number | null, currency: string): string {
  if (min == null && max == null) return 'Amount varies';
  if (min != null && max != null) return min === max ? money(min, currency) : `${money(min, currency)} – ${money(max, currency)}`;
  if (max != null) return `Up to ${money(max, currency)}`;
  return `From ${money(min as number, currency)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const grant = await getGrantBySlug(slug);
  if (!grant) return { title: 'Grant not found' };
  return {
    title: `${grant.title} — ${grant.funder_name}`,
    description: grant.summary ?? `Grant opportunity from ${grant.funder_name} on CharitMe.`,
    alternates: { canonical: `https://www.charitme.com/grants/${grant.slug}` },
  };
}

export default async function GrantDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const grant = await getGrantBySlug(slug);
  if (!grant) notFound();

  const deadlines = await getGrantDeadlines(grant.id);

  return (
    <div className="container" style={{ padding: '32px 24px', maxWidth: 980 }}>
      <Link href="/grants" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)' }}>← All grants</Link>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {/* Main */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 440px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textTransform: 'capitalize' }}>
                {grant.funder_type} · {grant.funder_name}
              </span>
              {grant.verified && <Badge color="green">Verified</Badge>}
              {grant.category && <Badge color="blue">{grant.category}</Badge>}
            </div>
            <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, margin: 0, lineHeight: 1.25, color: 'var(--t1)' }}>
              {grant.title}
            </h1>
            {grant.summary && <p style={{ fontSize: 16, color: 'var(--t2)', margin: 0, lineHeight: 1.5 }}>{grant.summary}</p>}

            {grant.focus_areas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {grant.focus_areas.map((f) => <Badge key={f} color="gray">{f}</Badge>)}
              </div>
            )}

            {grant.description && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', margin: '8px 0' }}>About this grant</h2>
                <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{grant.description}</p>
              </section>
            )}

            {grant.eligibility && (
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', margin: '8px 0' }}>Eligibility</h2>
                <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{grant.eligibility}</p>
                {grant.eligible_entity_types.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {grant.eligible_entity_types.map((t) => <Badge key={t} color="gray">{t}</Badge>)}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar / apply panel */}
          <aside style={{
            display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start',
            flex: '1 1 280px', maxWidth: 340,
            background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 20,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Award</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>
                {amountRange(grant.amount_min, grant.amount_max, grant.currency)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Deadline</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>
                {grant.rolling_deadline
                  ? 'Rolling'
                  : grant.deadline_at
                    ? new Date(grant.deadline_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Not specified'}
              </div>
            </div>
            {(grant.location || grant.country) && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Geography</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{grant.location || grant.country}</div>
              </div>
            )}

            {deadlines.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Key dates</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {deadlines.map((d) => (
                    <li key={d.id} style={{ fontSize: 13, color: 'var(--t2)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ textTransform: 'capitalize' }}>{d.label}</span>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{new Date(d.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ApplyButton grantSlug={grant.slug} />

            {grant.application_url && (
              <a href={grant.application_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-text)', textAlign: 'center' }}>
                View funder&apos;s official page ↗
              </a>
            )}
            <p style={{ fontSize: 11, color: 'var(--t4)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
              Starting an application saves a private draft to your CharitMe dashboard.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
