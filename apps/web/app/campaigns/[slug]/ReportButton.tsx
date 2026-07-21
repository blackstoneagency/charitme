'use client';
import React, { useState } from 'react';

export default function ReportButton({ campaignId }: { campaignId: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const report = async () => {
    setError(false);
    try {
      const res = await fetch('/api/campaign-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, reason: 'Donor safety review requested' }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={report}
        disabled={sent}
        className={`pc-report-btn${sent ? ' pc-report-btn-sent' : ''}`}
      >
        {sent ? '✓ Report sent to Trust & Safety' : 'Report campaign'}
      </button>
      {error && <p className="mt-2 text-xs font-bold" style={{ color: 'var(--red)' }}>Couldn&apos;t send your report. Please try again.</p>}
    </>
  );
}
