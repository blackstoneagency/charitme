'use client';

import React, { useState, useEffect } from 'react';
import { CharitMeShell, TopBar } from '../../../../../components/CharitMeApp';
import SupportersPanel from '../_components/SupportersPanel';

export default function SupportersPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar title="My Supporters" subtitle="Know your donors, bring them back." />
      <div style={{ padding: '0 32px 48px' }}>
        {campaignId && <SupportersPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
