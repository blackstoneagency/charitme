'use client';
import React, { useState } from 'react';

export default function ReportButton({ campaignId }: { campaignId: string }) {
  const [sent, setSent] = useState(false);

  const report = async () => {
    await fetch('/api/campaign-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, reason: 'Donor safety review requested' }),
    });
    setSent(true);
  };

  return (
    <button type="button" onClick={report} disabled={sent} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 disabled:opacity-60">
      {sent ? 'Report sent to Trust & Safety' : 'Report campaign'}
    </button>
  );
}
