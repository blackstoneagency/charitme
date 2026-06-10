'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SettingsPanel from '../_components/SettingsPanel';

export default function CampaignSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/dashboard/campaigns/${campaignId}`} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>
          ← Back to campaign
        </Link>
      </div>
      {campaignId && <SettingsPanel campaignId={campaignId} />}
    </div>
  );
}
