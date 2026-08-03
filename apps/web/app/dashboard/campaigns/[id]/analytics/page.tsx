'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AnalyticsPanel from '../_components/AnalyticsPanel';
import RecordedHistory from '../_components/RecordedHistory';

export default function CampaignAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/dashboard/campaigns/${campaignId}`} style={{ color: 'var(--t3)', fontSize: 13, textDecoration: 'none' }}>
          ← Back to campaign
        </Link>
      </div>
      {campaignId && (
        <>
          <AnalyticsPanel campaignId={campaignId} />
          <div style={{ maxWidth: 900 }}>
            <RecordedHistory campaignId={campaignId} />
          </div>
        </>
      )}
    </div>
  );
}
