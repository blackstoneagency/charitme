import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type React from 'react';
import type { Metadata } from 'next';
import { formatCents } from '@shared/currencies';
import { requireUser } from '../../../../../lib/auth';
import { getFundraiserTaxSummary } from '../../../../../lib/tax-server';
import { MixedCurrencyError, type FundraiserTaxSummary } from '../../../../../lib/tax';
import PrintButton from '../../PrintButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Campaign Tax Summary | CharitMe',
  robots: { index: false, follow: false },
};

export default async function FundraiserTaxSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ currency?: string }>;
}): Promise<React.ReactElement> {
  const [{ year: yearValue }, query, user] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);
  const year = Number.parseInt(yearValue, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();

  let summary: FundraiserTaxSummary;
  try {
    ({ summary } = await getFundraiserTaxSummary(user.id, year, query.currency));
  } catch (error) {
    if (error instanceof MixedCurrencyError) {
      return (
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px' }}>
          <h1>Choose a currency</h1>
          <p style={{ color: 'var(--t2)', lineHeight: 1.6 }}>
            CharitMe keeps currencies separate so your campaign records are not combined incorrectly.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {error.currencies.map((currency) => (
              <Link key={currency} href={`/dashboard/tax/fundraiser/${year}?currency=${encodeURIComponent(currency)}`}>
                View {currency.toUpperCase()}
              </Link>
            ))}
          </div>
        </main>
      );
    }
    throw error;
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href={`/dashboard/tax?year=${year}&currency=${encodeURIComponent(summary.currency)}`} className="kf-link">
          Back to tax documents
        </Link>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="kf-outline" download href={`/api/fundraiser/tax-summary?year=${year}&currency=${encodeURIComponent(summary.currency)}&format=csv`}>
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <article style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 8, padding: 32 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 900 }}>CharitMe</div>
            <div style={{ marginTop: 3, color: 'var(--t3)', fontSize: 13 }}>Campaign activity summary</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--violet)', fontSize: 28, fontWeight: 900 }}>{year}</div>
            <div style={{ color: 'var(--t3)', fontSize: 12 }}>Jan 1 - Dec 31 | {summary.currency.toUpperCase()}</div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 28 }}>
          <div style={{ border: '1px solid var(--b1)', borderRadius: 8, padding: 16 }}>
            <div style={{ color: 'var(--t3)', fontSize: 12 }}>Gross completed donations</div>
            <strong style={{ display: 'block', marginTop: 5, fontSize: 24 }}>{formatCents(summary.totals.grossCents, summary.currency)}</strong>
          </div>
          <div style={{ border: '1px solid var(--b1)', borderRadius: 8, padding: 16 }}>
            <div style={{ color: 'var(--t3)', fontSize: 12 }}>Completed donations</div>
            <strong style={{ display: 'block', marginTop: 5, fontSize: 24 }}>{summary.totals.donationCount.toLocaleString()}</strong>
          </div>
        </div>

        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Campaign breakdown</h2>
        {summary.campaigns.length === 0 ? (
          <p style={{ color: 'var(--t3)' }}>No completed donations were recorded for this year and currency.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--b1)' }}>
                  <th scope="col" style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, color: 'var(--t3)' }}>Campaign</th>
                  <th scope="col" style={{ padding: '10px 8px', textAlign: 'right', fontSize: 11, color: 'var(--t3)' }}>Donations</th>
                  <th scope="col" style={{ padding: '10px 8px', textAlign: 'right', fontSize: 11, color: 'var(--t3)' }}>Gross raised</th>
                </tr>
              </thead>
              <tbody>
                {summary.campaigns.map((campaign) => (
                  <tr key={campaign.campaignId} style={{ borderBottom: '1px solid var(--b1)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700 }}>{campaign.campaignTitle}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{campaign.donationCount.toLocaleString()}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800 }}>{formatCents(campaign.grossCents, summary.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--b1)', color: 'var(--t3)', fontSize: 11, lineHeight: 1.65 }}>
          <p style={{ margin: '0 0 8px' }}>
            This summary includes completed donations to campaigns owned by the signed-in account. Refunded, failed, and pending donations are excluded. Donor tips are not campaign proceeds.
          </p>
          <p style={{ margin: 0 }}>
            This is a recordkeeping summary, not a tax form or tax advice. Payment processor fees, refunds posted outside the selected period, transfers, and other adjustments may be reported separately. Consult a qualified tax professional and retain Stripe and bank records with this summary.
          </p>
        </footer>
      </article>
    </main>
  );
}
