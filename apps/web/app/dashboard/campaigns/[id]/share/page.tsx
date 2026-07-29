'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import SharePanel from '../_components/SharePanel';

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Share & Grow"
        subtitle="Share your campaign and AI-generate content for every channel."
        actions={<Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>}
      />
      <div style={{ padding: '0 32px 40px' }}>
        {campaignId && <SharePanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
