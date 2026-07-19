import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoneyShort } from '@shared/currencies';
import { Badge, ProgressBar } from '../../../components/ui';
import { getUser } from '../../../lib/auth';
import { getImpactBundle, userOwnsCampaign } from '../../../lib/impact';
import { budgetProgress, metricProgress, sumSpent } from '../../../lib/impact-core';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getImpactBundle(slug, false);
  if (!bundle) return { title: 'Impact not found' };
  return {
    title: `Impact — ${bundle.campaign.title}`,
    description: `See exactly how ${bundle.campaign.title} is using funds, with a ${bundle.transparency.score}/100 transparency score.`,
  };
}

export const dynamic = 'force-dynamic';

const RATING_COLOR: Record<string, 'green' | 'blue' | 'gray'> = {
  Exceptional: 'green',
  Strong: 'green',
  Developing: 'blue',
  Building: 'gray',
};

export default async function ImpactPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getUser();
  const preview = await getImpactBundle(slug, false);
  if (!preview) notFound();
  const viewerOwns = !!user && (await userOwnsCampaign(preview.campaign.id, user.id));
  const bundle = viewerOwns ? (await getImpactBundle(slug, true))! : preview;

  const { campaign, plan, updates, metrics, transparency } = bundle;
  const currency = campaign.currency;
  const spent = plan ? sumSpent(plan.items) : 0;

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 820 }}>
      <Link href={`/campaigns/${campaign.slug}`} style={{ fontSize: 14, color: 'var(--t3)', textDecoration: 'none' }}>
        ← {campaign.title}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', margin: '18px 0 8px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Impact & Transparency</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--green-dark)' }}>{transparency.score}</span>
          <span style={{ fontSize: 13, color: 'var(--t4)' }}>/100</span>
          <Badge color={RATING_COLOR[transparency.rating] ?? 'gray'}>{transparency.rating}</Badge>
        </span>
      </div>
      {viewerOwns && (
        <p style={{ fontSize: 13, color: 'var(--t4)', marginBottom: 8 }}>
          You own this campaign — you also see draft items.{' '}
          <Link href="/impact/manage" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>Manage impact →</Link>
        </p>
      )}

      {/* Transparency factors */}
      <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 16, margin: '16px 0 28px' }}>
        {transparency.factors.map((f) => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
            <span style={{ flex: '1 1 200px', fontSize: 14, color: 'var(--t2)' }}>{f.label}</span>
            <div style={{ flex: '2 1 200px' }}><ProgressBar value={f.points} max={f.max} /></div>
            <span style={{ fontSize: 13, color: 'var(--t4)', width: 52, textAlign: 'right' }}>{f.points}/{f.max}</span>
          </div>
        ))}
      </div>

      {/* Spending plan */}
      {plan ? (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{plan.title}</h2>
          {plan.summary && <p style={{ color: 'var(--t3)', fontSize: 14, marginBottom: 12 }}>{plan.summary}</p>}
          <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 12 }}>
            {formatMoneyShort(spent, currency)} spent of {formatMoneyShort(plan.total_budget_cents, currency)} planned
            {' '}({budgetProgress(plan.total_budget_cents, spent)}%)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plan.items.map((it) => (
              <div key={it.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                  <span>{it.label}{it.category ? <span style={{ color: 'var(--t4)' }}> · {it.category}</span> : null}</span>
                  <span style={{ color: 'var(--t3)' }}>
                    {formatMoneyShort(it.spent_amount_cents, currency)} / {formatMoneyShort(it.planned_amount_cents, currency)}
                  </span>
                </div>
                <ProgressBar value={it.spent_amount_cents} max={Math.max(1, it.planned_amount_cents)} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p style={{ color: 'var(--t4)', fontSize: 14, marginBottom: 28 }}>No published spending plan yet.</p>
      )}

      {/* Outcome metrics */}
      {metrics.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Outcomes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {metrics.map((m) => {
              const prog = metricProgress(m);
              return (
                <div key={m.id} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: 14 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>
                    {m.current_value.toLocaleString()}{m.target_value ? <span style={{ fontSize: 14, color: 'var(--t4)', fontWeight: 500 }}> / {m.target_value.toLocaleString()}</span> : null}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: prog !== null ? 8 : 0 }}>{m.label}{m.unit ? ` (${m.unit})` : ''}</div>
                  {prog !== null && <ProgressBar value={m.current_value} max={m.target_value ?? 1} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Verified updates */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Progress updates</h2>
        {updates.length === 0 ? (
          <p style={{ color: 'var(--t4)', fontSize: 14 }}>No updates published yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {updates.map((u) => (
              <article key={u.id} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{u.title}</h3>
                  <span style={{ fontSize: 12, color: 'var(--t4)' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                    {u.status === 'draft' && ' · draft'}
                  </span>
                </div>
                {u.amount_spent_cents != null && (
                  <div style={{ fontSize: 13, color: 'var(--green-dark)', margin: '4px 0' }}>
                    {formatMoneyShort(u.amount_spent_cents, currency)} spent
                  </div>
                )}
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--t2)', whiteSpace: 'pre-wrap', marginTop: 6 }}>{u.body}</p>
                {u.evidence.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {u.evidence.map((e) => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'var(--s3)', color: 'var(--t2)', textDecoration: 'none' }}>
                        📎 {e.caption || e.kind}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
