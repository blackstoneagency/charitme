'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import UpdatesPanel from '../_components/UpdatesPanel';

export default function CampaignUpdatesPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar title="Campaign Updates" subtitle="Post progress your supporters will see and be notified about." />
      <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Link href={`/dashboard/campaigns/${campaignId}`} className="cm-touch-link" style={{ color: 'var(--t3)', fontSize: 13, textDecoration: 'none' }}>
            ← Back to campaign
          </Link>
        </div>
        {campaignId && <UpdatesPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
