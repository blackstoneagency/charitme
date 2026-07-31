import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { formatCents } from '@shared/currencies';
import { getDonorTaxStatement } from '../../../../lib/tax-server';
import { MixedCurrencyError, type TaxStatement } from '../../../../lib/tax';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Annual Giving Statement',
  robots: { index: false, follow: false },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function TaxStatementPage({ params, searchParams }: { params: Promise<{ year: string }>; searchParams: Promise<{ currency?: string }> }) {
  const { year: yearStr } = await params;
  const { currency: requestedCurrency } = await searchParams;
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/donor/tax-statement/${yearStr}`);

  let statement: TaxStatement;
  let profileName: string | null = null;
  try {
    const [{ statement: loadedStatement }, profileRes] = await Promise.all([
      getDonorTaxStatement(user.id, year, requestedCurrency, user.email),
      supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).single(),
    ]);
    statement = loadedStatement;
    profileName = (profileRes.data as { full_name: string | null } | null)?.full_name ?? null;
  } catch (error) {
    if (error instanceof MixedCurrencyError) {
      return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 10px' }}>Statement needs separate currencies</h1>
          <p style={{ color: 'var(--t2, #334155)', lineHeight: 1.6, margin: 0 }}>
            This year includes donations in more than one currency. CharitMe keeps those totals separate so your records stay accurate. Choose a currency to view its statement.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            {error.currencies.map((code) => (
              <Link key={code} href={`/donor/tax-statement/${year}?currency=${encodeURIComponent(code)}`} style={{ color: 'var(--brand-text)', fontWeight: 700, textDecoration: 'none' }}>
                View {code.toUpperCase()} statement
              </Link>
            ))}
          </div>
        </div>
      );
    }
    throw error;
  }
  const donorName = profileName ?? user.email ?? 'Donor';
  const { totals, lines, organizations, currency } = statement;

  const line: React.CSSProperties = { borderBottom: '1px solid var(--b1, #e8ecf4)' };
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' };
  const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13, color: 'var(--t1, #0e0520)', verticalAlign: 'top' };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      {/* Toolbar (not printed) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href={`/dashboard/tax?year=${year}&currency=${encodeURIComponent(currency)}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'none' }}>Back to tax documents</Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`/api/donor/tax-statement?year=${year}&currency=${encodeURIComponent(currency)}&format=csv`}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'none', border: '1px solid var(--b2, #d7ddea)', borderRadius: 'var(--r, 10px)', padding: '8px 16px' }}
          >
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Statement */}
      <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 16, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--t1, #0e0520)' }}>CharitMe</div>
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>Annual Giving Statement</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand-text)' }}>{year}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Tax year (Jan 1 – Dec 31)</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--t2, #334155)', marginBottom: 24 }}>
          Prepared for <strong>{donorName}</strong>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total given', value: formatCents(totals.totalGiftCents, currency), color: 'var(--t1, #0e0520)' },
            { label: 'Tax-deductible', value: formatCents(totals.deductibleCents, currency), color: 'var(--green-text)' },
            { label: 'Non-deductible', value: formatCents(totals.nonDeductibleCents, currency), color: 'var(--t3)' },
          ].map((s) => (
            <div key={s.label} style={{ border: '1px solid var(--b1, #e8ecf4)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {totals.donationCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t3)', fontSize: 14 }}>
            No completed donations recorded for {year}.
          </div>
        ) : (
          <>
            {/* Deductible-by-organization block */}
            {organizations.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Tax-deductible gifts by organization</div>
                {organizations.map((o) => (
                  <div key={`${o.name}-${o.ein ?? ''}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', ...line }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1, #0e0520)' }}>{o.name}</div>
                      {o.ein && <div style={{ fontSize: 11, color: 'var(--t3)' }}>EIN {o.ein}</div>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green-text)' }}>{formatCents(o.deductibleCents, currency)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Itemized donations */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--b1, #e8ecf4)' }}>
                    <th scope="col" style={th}>Date</th>
                    <th scope="col" style={th}>Receipt #</th>
                    <th scope="col" style={th}>Campaign / Organization</th>
                    <th scope="col" style={{ ...th, textAlign: 'right' }}>Amount</th>
                    <th scope="col" style={{ ...th, textAlign: 'center' }}>Deductible</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} style={line}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(l.date)}</td>
                      <td style={{ ...td, fontFamily: 'var(--mono, monospace)', fontSize: 11, color: 'var(--t3)' }}>{l.receiptNumber}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{l.campaignTitle}</div>
                        {l.organization && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{l.organization}{l.ein ? ` · EIN ${l.ein}` : ''}</div>}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCents(l.amountCents, l.currency)}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: l.deductible ? 'var(--green-text)' : 'var(--t3)' }}>{l.deductible ? 'Yes' : 'No'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Legal disclosure */}
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--b1, #e8ecf4)', fontSize: 11, lineHeight: 1.6, color: 'var(--t3)' }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Tax-deductibility:</strong> Only gifts to campaigns operated by a registered, verified
            nonprofit with tax receipts enabled are marked deductible above; the organization&apos;s legal
            name and EIN are shown for those gifts. Contributions to personal fundraisers are personal
            gifts and are <strong>not</strong> tax-deductible.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            No goods or services were provided in exchange for the contributions listed, except as may be
            noted by the receiving organization. Platform tips to CharitMe are not charitable contributions
            and are excluded from the deductible total.
          </p>
          <p style={{ margin: 0 }}>
            This statement is provided for your records and is not tax advice. Consult a qualified tax
            professional and retain your own records. Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
          </p>
        </div>
      </div>
    </div>
  );
}
