'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '../../../../../components/CharitMeApp';
import { CharitMeShell } from '../../../../../components/ShellSessionProvider';
import AnalyticsPanel from '../_components/AnalyticsPanel';
import RecordedHistory from '../_components/RecordedHistory';

export default function CampaignAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const [campaignId, setCampaignId] = useState('');

  useEffect(() => { void params.then(({ id }) => setCampaignId(id)); }, [params]);

  // ⚠️ `TopBar` is the only thing that renders `ShellAccountControls` — the theme
  // toggle, search, notification bell and account menu. A page that draws its own
  // bare <div> gets the sidebar logo and nothing on the right, which is what this
  // page did. The shell is not optional chrome; it IS the signed-in header.
  return (
    <CharitMeShell active="My Campaigns">
      <TopBar title="Campaign Analytics" subtitle="Traffic, conversion and the recorded history for this campaign." />
      <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Link href={`/dashboard/campaigns/${campaignId}`} className="cm-touch-link" style={{ color: 'var(--t3)', fontSize: 13, textDecoration: 'none' }}>
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
    </CharitMeShell>
  );
}
