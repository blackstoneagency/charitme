'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import ThankDonorsPanel from '../_components/ThankDonorsPanel';

export default function ThankDonorsPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Thank Your Donors"
        subtitle="Send personalised thank-you emails to your donors."
        actions={<Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>}
      />
      <div style={{ padding: '0 32px 40px' }}>
        {campaignId && <ThankDonorsPanel campaignId={campaignId} />}
      </div>
    </CharitMeShell>
  );
}
