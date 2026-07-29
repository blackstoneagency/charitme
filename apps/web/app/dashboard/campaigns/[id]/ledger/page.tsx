'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import LedgerPanel from '../_components/LedgerPanel';

export default function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Transparency Ledger"
        subtitle="Show donors exactly how your campaign's funds are used."
        actions={<Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>}
      />
      <div style={{ padding: '0 32px 40px' }}>
        {campaignId && <LedgerPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
