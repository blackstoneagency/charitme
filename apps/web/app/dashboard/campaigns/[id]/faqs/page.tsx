'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import FaqsPanel from '../_components/FaqsPanel';

export default function CampaignFAQsPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Campaign FAQs"
        subtitle="Answer common donor questions. Shown publicly on your campaign page."
        actions={<Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>}
      />
      <div style={{ padding: '0 32px 40px' }}>
        {campaignId && <FaqsPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
