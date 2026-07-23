'use client';

import React, { useMemo, useState } from 'react';
import { formatCents } from '@shared/currencies';

type Props = {
  currentYear: number;
  receiptCount: number;
  deductibleByCurrency: Record<string, number>;
};

export default function TaxReportPanel({ currentYear, receiptCount, deductibleByCurrency }: Props) {
  const [year, setYear] = useState(String(currentYear));
  const deductibleLabel = useMemo(() => {
    const entries = Object.entries(deductibleByCurrency).filter(([, cents]) => cents > 0);
    return entries.length === 0
      ? 'No deductible gifts recorded yet'
      : entries.map(([currency, cents]) => formatCents(cents, currency)).join(' + ');
  }, [deductibleByCurrency]);

  return (
    <section style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }} aria-labelledby="tax-report-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 id="tax-report-title" style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px' }}>Tax reporting</h2>
          <p style={{ color: 'var(--t3, #64748b)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {receiptCount} receipt record{receiptCount === 1 ? '' : 's'} for {currentYear}. Deductible amount recorded: <strong>{deductibleLabel}</strong>.
          </p>
          <p style={{ color: 'var(--t3, #94a3b8)', fontSize: 11, margin: '8px 0 0', lineHeight: 1.5 }}>
            CharitMe records campaign eligibility; tax treatment depends on your circumstances. Keep the report and consult a tax professional.
          </p>
        </div>
        <form action="/api/donor/tax-report" method="get" style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="tax-report-year" style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--t3, #64748b)' }}>
            Tax year
            <select id="tax-report-year" name="year" value={year} onChange={(event) => setYear(event.target.value)} style={{ minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid var(--b2, #e2e8f0)', background: 'var(--s1, #fff)', color: 'var(--t1, #1a1a2e)', font: 'inherit' }}>
              {[currentYear, currentYear - 1, currentYear - 2].map((value) => <option key={value} value={value}>{value}</option>)}
              <option value="all">All years</option>
            </select>
          </label>
          <button type="submit" style={{ minHeight: 40, padding: '0 14px', border: 0, borderRadius: 8, background: 'var(--violet, #6c35ff)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
            Download CSV
          </button>
        </form>
      </div>
    </section>
  );
}
