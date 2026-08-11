'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import SettingsPanel from '../_components/SettingsPanel';

export default function CampaignSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar title="Campaign Settings" subtitle="Visibility, donation options and the details supporters see." />
      <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Link href={`/dashboard/campaigns/${campaignId}`} className="cm-touch-link" style={{ color: 'var(--t3)', fontSize: 13, textDecoration: 'none' }}>
            ← Back to campaign
          </Link>
        </div>
        {campaignId && <SettingsPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
