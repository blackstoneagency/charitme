'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import WidgetPanel from '../_components/WidgetPanel';

export default function CampaignWidgetPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Donation Widget"
        subtitle="Put a donate box on your own website. Configure it, see it live, copy the code."
        actions={<Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>}
      />
      <div style={{ padding: '0 32px 40px' }}>
        {campaignId && <WidgetPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
