import 'server-only';
import Link from 'next/link';
import type React from 'react';
import { formatCents } from '@shared/currencies';
import { CharitMeShell, KFIcon, TopBar } from '../../../components/CharitMeShellServer';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
import { requireUser } from '../../../lib/auth';
import {
  loadDonorTaxInputs,
  loadFundraiserTaxInputs,
} from '../../../lib/tax-server';
import {
  buildFundraiserTaxSummary,
  buildTaxStatement,
  donationYears,
  fundraiserYears,
  type FundraiserDonationInput,
  type TaxDonationInput,
} from '../../../lib/tax';
import ReceiptButton from '../../donor/ReceiptButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tax Documents | CharitMe',
  robots: { index: false, follow: false },
};

type SearchParams = {
  year?: string;
  currency?: string;
};

type TaxInputs = {
  donor: TaxDonationInput[];
  fundraiser: FundraiserDonationInput[];
  donorFailed: boolean;
  fundraiserFailed: boolean;
};

const card: React.CSSProperties = {
  background: 'var(--s1)',
  border: '1px solid var(--b1)',
  borderRadius: 8,
  padding: 24,
};

function validYear(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback;
}

function currencyValues(
  donor: TaxDonationInput[],
  fundraiser: FundraiserDonationInput[],
  year: number,
): string[] {
  const values = new Set<string>();
  for (const item of [...donor, ...fundraiser]) {
    const date = new Date(item.createdAt);
    if (
      item.status === 'completed'
      && !Number.isNaN(date.getTime())
      && date.getUTCFullYear() === year
    ) {
      values.add((item.currency ?? 'usd').toLowerCase());
    }
  }
  return [...values].sort();
}

function withCurrency(path: string, currency: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}currency=${encodeURIComponent(currency)}`;
}

async function loadTaxInputs(userId: string, userEmail?: string | null): Promise<TaxInputs> {
  const [donorResult, fundraiserResult] = await Promise.allSettled([
    loadDonorTaxInputs(userId, userEmail),
    loadFundraiserTaxInputs(userId),
  ]);
  return {
    donor: donorResult.status === 'fulfilled' ? donorResult.value : [],
    fundraiser: fundraiserResult.status === 'fulfilled' ? fundraiserResult.value : [],
    donorFailed: donorResult.status === 'rejected',
    fundraiserFailed: fundraiserResult.status === 'rejected',
  };
}

export default async function TaxDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const inputs = await loadTaxInputs(user.id, user.email);
  const currentYear = new Date().getUTCFullYear();
  const availableYears = [...new Set([
    currentYear,
    ...donationYears(inputs.donor),
    ...fundraiserYears(inputs.fundraiser),
  ])].sort((a, b) => b - a);
  const year = validYear(params.year, availableYears[0] ?? currentYear);
  if (!availableYears.includes(year)) availableYears.push(year);
  availableYears.sort((a, b) => b - a);

  const currencies = currencyValues(inputs.donor, inputs.fundraiser, year);
  const requestedCurrency = params.currency?.trim().toLowerCase();
  const currency = requestedCurrency && currencies.includes(requestedCurrency)
    ? requestedCurrency
    : currencies[0] ?? 'usd';
  const donorForCurrency = inputs.donor.filter(
    (item) => (item.currency ?? 'usd').toLowerCase() === currency,
  );
  const fundraiserForCurrency = inputs.fundraiser.filter(
    (item) => (item.currency ?? 'usd').toLowerCase() === currency,
  );
  const statement = buildTaxStatement(donorForCurrency, year);
  const fundraiser = buildFundraiserTaxSummary(fundraiserForCurrency, year);
  const query = `year=${year}&currency=${encodeURIComponent(currency)}`;

  return (
    <CharitMeShell active="Tax Documents">
      <TopBar
        title="Tax Documents"
        subtitle="Generate giving statements, receipts, and campaign records for any year."
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 1160 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
          {(inputs.donorFailed || inputs.fundraiserFailed) && (
            <DegradedReadNotice title="Some tax records are temporarily unavailable">
              The available documents remain visible. Refresh before filing to make sure your records are complete.
            </DegradedReadNotice>
          )}

          <section style={{ ...card, padding: 18 }} aria-label="Tax document filters">
            <form method="get" style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--t2)' }}>
                Tax year
                <select
                  name="year"
                  defaultValue={year}
                  style={{ minWidth: 150, minHeight: 44, border: '1px solid var(--b2)', borderRadius: 8, padding: '0 12px', background: 'var(--s1)', color: 'var(--t1)', font: 'inherit' }}
                >
                  {availableYears.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              {currencies.length > 1 && (
                <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--t2)' }}>
                  Currency
                  <select
                    name="currency"
                    defaultValue={currency}
                    style={{ minWidth: 150, minHeight: 44, border: '1px solid var(--b2)', borderRadius: 8, padding: '0 12px', background: 'var(--s1)', color: 'var(--t1)', font: 'inherit' }}
                  >
                    {currencies.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
                  </select>
                </label>
              )}
              <button type="submit" className="kf-primary" style={{ minHeight: 44 }}>
                Update
              </button>
            </form>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18 }}>
            <section style={card}>
              <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', marginBottom: 18 }}>
                <span className="kf-metric-icon violet"><KFIcon name="gift" /></span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Donor documents</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--t3)', fontSize: 13 }}>Your giving across every CharitMe campaign.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Total given</div>
                  <strong style={{ display: 'block', marginTop: 5, fontSize: 22 }}>{formatCents(statement.totals.totalGiftCents, currency)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Marked deductible</div>
                  <strong style={{ display: 'block', marginTop: 5, fontSize: 22, color: 'var(--green-text)' }}>{formatCents(statement.totals.deductibleCents, currency)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
                <Link className="kf-primary" href={withCurrency(`/donor/tax-statement/${year}`, currency)} style={{ textDecoration: 'none' }}>
                  <KFIcon name="doc" /> View / save PDF
                </Link>
                <a className="kf-outline" download href={`/api/donor/tax-statement?${query}&format=csv`} style={{ textDecoration: 'none' }}>
                  <KFIcon name="upload" /> Download CSV
                </a>
              </div>
            </section>

            <section style={card}>
              <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', marginBottom: 18 }}>
                <span className="kf-metric-icon green"><KFIcon name="chart" /></span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Campaign records</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--t3)', fontSize: 13 }}>Gross funds raised across campaigns you own.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Gross raised</div>
                  <strong style={{ display: 'block', marginTop: 5, fontSize: 22 }}>{formatCents(fundraiser.totals.grossCents, currency)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Completed gifts</div>
                  <strong style={{ display: 'block', marginTop: 5, fontSize: 22 }}>{fundraiser.totals.donationCount.toLocaleString()}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
                <Link className="kf-primary" href={`/dashboard/tax/fundraiser/${year}?currency=${encodeURIComponent(currency)}`} style={{ textDecoration: 'none' }}>
                  <KFIcon name="doc" /> View / save PDF
                </Link>
                <a className="kf-outline" download href={`/api/fundraiser/tax-summary?${query}&format=csv`} style={{ textDecoration: 'none' }}>
                  <KFIcon name="upload" /> Download CSV
                </a>
              </div>
            </section>
          </div>

          <section style={card}>
            <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Receipts for {year}</h2>
                <p style={{ margin: '5px 0 0', color: 'var(--t3)', fontSize: 13 }}>
                  Re-send any completed donation receipt to the email on your account.
                </p>
              </div>
              <Link href="/donor" className="kf-link">Full giving history</Link>
            </div>
            {statement.lines.length === 0 ? (
              <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>
                No completed donations are recorded for this year and currency.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
                {statement.lines.map((line) => (
                  <div key={line.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 16, alignItems: 'center', minHeight: 58, borderTop: '1px solid var(--b1)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 750 }}>{line.campaignTitle}</div>
                      <div style={{ color: 'var(--t3)', fontSize: 12 }}>
                        {line.date}{line.receiptNumber ? ` | ${line.receiptNumber}` : ''}
                      </div>
                    </div>
                    <strong>{formatCents(line.amountCents, line.currency)}</strong>
                    <ReceiptButton donationId={line.id} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ ...card, background: 'var(--s2)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Important tax information</h2>
            <p style={{ margin: 0, color: 'var(--t2)', fontSize: 13, lineHeight: 1.65 }}>
              CharitMe marks a contribution as tax-deductible only when the campaign is operated by a verified nonprofit that has enabled tax receipts. Personal fundraiser contributions and platform tips are not marked deductible. Campaign summaries report gross completed donations and do not estimate payment processing fees or tax liability. These records are not tax advice; retain your own records and consult a qualified tax professional.
            </p>
          </section>
        </div>
      </div>
    </CharitMeShell>
  );
}
