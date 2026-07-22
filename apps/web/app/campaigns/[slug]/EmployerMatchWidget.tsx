'use client';

import React, { useMemo, useState } from 'react';
import {
  searchEmployerMatch,
  estimateEmployerMatch,
  type EmployerMatchEntry,
} from '../../../lib/employer-matching';

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// Donor-facing employer matching-gift estimator, shown under the donation
// breakdown. A donor searches their employer; we show what their gift could
// become — always framed as an estimate ("up to"), pointing them to confirm
// with their employer. Pure math lives in lib/employer-matching.ts. This is an
// indicator only: it never changes the donation amount or checkout.
export default function EmployerMatchWidget({ amountCents }: { amountCents: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<EmployerMatchEntry | null>(null);

  const results = useMemo(() => (picked ? [] : searchEmployerMatch(query, 6)), [query, picked]);
  const estimate = useMemo(
    () => (picked ? estimateEmployerMatch(amountCents, picked) : null),
    [picked, amountCents],
  );

  const INK = 'var(--t1, #1a1a2e)';
  const MU = 'var(--t3, #64748b)';
  const BD = 'var(--b1, #e8ecf4)';
  const GRD = 'var(--green-dark, #047857)';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 14px', borderRadius: 11, cursor: 'pointer',
          border: `1.5px dashed ${BD}`, background: 'transparent',
          fontSize: 13.5, fontWeight: 750, color: INK, fontFamily: 'inherit',
        }}
      >
        🏢 Does your employer match donations? <span style={{ color: MU }}>Check →</span>
      </button>
    );
  }

  return (
    <div style={{ border: `1.5px solid ${BD}`, borderRadius: 12, padding: '13px 14px', background: 'var(--s1, #fff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>🏢 Employer match</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setPicked(null); setQuery(''); }}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: MU, fontFamily: 'inherit' }}
        >
          Close
        </button>
      </div>

      {!picked && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your employer, e.g. Microsoft"
            aria-label="Search your employer"
            style={{
              width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${BD}`,
              fontSize: 14, fontFamily: 'inherit', color: INK, background: 'var(--s2, #f8fafc)',
            }}
          />
          {results.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((r) => (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => setPicked(r)}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${BD}`, background: 'var(--s2, #f8fafc)',
                      fontSize: 13.5, fontWeight: 700, color: INK, fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span>{r.name}</span>
                    <span style={{ fontSize: 12, color: MU }}>{r.typicalRatio}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
              We don&apos;t have {query.trim()} on file, but many employers still match — ask your HR
              or giving team.
            </p>
          )}
        </>
      )}

      {picked && estimate && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{picked.name}</span>
            <button
              type="button"
              onClick={() => { setPicked(null); }}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: MU, fontFamily: 'inherit' }}
            >
              Change
            </button>
          </div>
          {amountCents >= 100 ? (
            <div style={{ marginTop: 9, padding: '11px 12px', borderRadius: 10, background: 'rgba(16,185,129,.10)' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: GRD }}>
                Your {money(estimate.donationCents)} could become {estimate.isCeiling ? 'up to ' : ''}
                {money(estimate.totalImpactCents)}
              </div>
              <div style={{ fontSize: 12.5, color: MU, marginTop: 3 }}>
                {picked.name} typically matches {estimate.ratioLabel} — an estimated{' '}
                {money(estimate.matchedCents)} on top of your gift.
              </div>
            </div>
          ) : (
            <p style={{ margin: '9px 0 0', fontSize: 12.5, color: MU }}>Enter a donation amount to see your estimated match.</p>
          )}
          <p style={{ margin: '9px 0 0', fontSize: 11.5, color: MU, lineHeight: 1.5 }}>
            Estimate only — matching terms, caps, and eligibility vary. Submit the match through your
            employer&apos;s giving program after you donate.
          </p>
        </div>
      )}
    </div>
  );
}
