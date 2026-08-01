import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { listSponsorPrograms, listProgramClaims } from '../../../lib/matching';
import { summarizeProgramClaims, type ProgramClaimSummary } from '../../../lib/matching-core';
import { formatMoneyShort } from '@shared/currencies';
import CorporateClaimsClient, { type ClaimRow } from './CorporateClaimsClient';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Corporate Giving (CSR) dashboard — a matching-program sponsor reviews their
// company's employee match claims and sees committed / paid / pending totals.
// Backend already exists: matching_programs (sponsor_id owns), matching_claims,
// and PATCH /api/matching/claims/:id (state machine + notifications).
// ─────────────────────────────────────────────────────────────────────────────
export default async function CorporateDashboardPage() {
  const user = await requireUser();
  const programs = await listSponsorPrograms(user.id);

  const perProgram = await Promise.all(
    programs.map(async (p) => {
      const claims = await listProgramClaims(p.id);
      return { program: p, claims, summary: summarizeProgramClaims(claims) };
    }),
  );

  // Roll up headline metrics across all of the sponsor's programs.
  const totals = perProgram.reduce(
    (acc, { summary }) => ({
      committed: acc.committed + summary.committedCents,
      paid: acc.paid + summary.paidCents,
      pending: acc.pending + summary.pending,
    }),
    { committed: 0, paid: 0, pending: 0 },
  );
  const currency = programs[0]?.currency ?? 'USD';

  const metrics = [
    { label: 'Programs', value: String(programs.length), change: 'active + paused', icon: 'crown', tone: 'violet' as const },
    { label: 'Committed Match', value: formatMoneyShort(totals.committed, currency), change: 'approved + paid', icon: 'gift', tone: 'green' as const },
    { label: 'Paid Out', value: formatMoneyShort(totals.paid, currency), change: 'lifetime', icon: 'wallet', tone: 'blue' as const },
    { label: 'Pending Review', value: String(totals.pending), change: 'claims awaiting you', icon: 'audit', tone: 'orange' as const },
  ];

  return (
    <CharitMeShell active="Corporate Giving">
      <TopBar
        title="Corporate Giving"
        subtitle="Review your company's employee matching-gift claims."
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <MetricGrid metrics={metrics} />

        {programs.length === 0 ? (
          <section className="kf-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
            <KFIcon name="crown" className="kf-empty-icon" />
            <p style={{ marginTop: 12, fontWeight: 700, color: 'var(--t1)' }}>
              You don&apos;t run a matching-gift program yet.
            </p>
            <p style={{ marginTop: 4, fontSize: 14, color: 'var(--t3, var(--t3))' }}>
              Companies that sponsor a matching program appear here to review and
              approve employee match claims.
            </p>
            <Link href="/matching" className="kf-primary" style={{ display: 'inline-block', marginTop: 16 }}>
              Browse matching programs
            </Link>
          </section>
        ) : (
          perProgram.map(({ program, claims, summary }) => (
            <ProgramSection
              key={program.id}
              company={program.company_name}
              description={program.description}
              matchRatio={program.match_ratio}
              status={program.status}
              currency={program.currency}
              summary={summary}
              claims={claims.map((c) => ({
                id: c.id,
                employee_name: c.employee_name,
                employee_email: c.employee_email,
                donation_amount_cents: c.donation_amount_cents,
                match_amount_cents: c.match_amount_cents,
                status: c.status,
                created_at: c.created_at,
              }))}
            />
          ))
        )}
      </div>
    </CharitMeShell>
  );
}

function ProgramSection({
  company, description, matchRatio, status, currency, summary, claims,
}: {
  company: string;
  description: string | null;
  matchRatio: number;
  status: string;
  currency: string;
  summary: ProgramClaimSummary;
  claims: ClaimRow[];
}) {
  const statusTone =
    status === 'active' ? { bg: 'rgba(18,166,83,.12)', fg: 'var(--green-dark)' } :
    status === 'paused' ? { bg: 'rgba(245,158,11,.1)', fg: '#c2410c' } :
    { bg: 'var(--s2)', fg: 'var(--t3)' };

  return (
    <section className="kf-card">
      <div className="kf-card-head" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{company}</h2>
        <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: statusTone.bg, color: statusTone.fg, textTransform: 'capitalize' }}>
          {status}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3, var(--t3))' }}>
          {matchRatio}× match
        </span>
      </div>

      {description && (
        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--t2, var(--t2))', lineHeight: 1.5 }}>{description}</p>
      )}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', margin: '4px 0 16px', fontSize: 13 }}>
        <Stat label="Committed" value={formatMoneyShort(summary.committedCents, currency)} />
        <Stat label="Paid" value={formatMoneyShort(summary.paidCents, currency)} />
        <Stat label="Pending" value={`${summary.pending} claim${summary.pending === 1 ? '' : 's'}`} />
        <Stat label="Total claims" value={String(summary.total)} />
      </div>

      <CorporateClaimsClient claims={claims} currency={currency} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3, var(--t3))', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1, var(--t1))' }}>{value}</div>
    </div>
  );
}
