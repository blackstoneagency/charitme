'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KFIcon } from '../../../../../components/CharitMeApp';
import CampaignControls from './CampaignControls';
import SupportersPanel from './SupportersPanel';
import SharePanel from './SharePanel';
import ThankDonorsPanel from './ThankDonorsPanel';
import LedgerPanel from './LedgerPanel';
import FaqsPanel from './FaqsPanel';
import EditCampaignPanel from './EditCampaignPanel';
import UpdatesPanel from './UpdatesPanel';
import AnalyticsPanel from './AnalyticsPanel';
import SettingsPanel from './SettingsPanel';

type ToolKey =
  | 'supporters' | 'share' | 'thank-donors' | 'ledger' | 'faqs'
  | 'qr-poster' | 'updates' | 'analytics' | 'settings' | 'edit';

const TOOLS: { key: ToolKey; icon: string; label: string; desc: string }[] = [
  { key: 'supporters', icon: 'users', label: 'My Supporters', desc: 'Donor CRM + re-engagement' },
  { key: 'share', icon: 'send', label: 'Share & AI Content', desc: 'UTM links + AI posts' },
  { key: 'thank-donors', icon: 'chat', label: 'Thank Donors', desc: 'Email your supporters' },
  { key: 'ledger', icon: 'doc', label: 'Fund Ledger', desc: 'Track how funds are used' },
  { key: 'faqs', icon: 'doc', label: 'Manage FAQs', desc: 'AI-generated Q&A' },
  { key: 'qr-poster', icon: 'send', label: 'Print QR Poster', desc: 'Download & print' },
  { key: 'updates', icon: 'doc', label: 'Post Update', desc: 'Keep donors informed' },
  { key: 'analytics', icon: 'chart', label: 'Analytics', desc: 'Trends & attribution' },
  { key: 'settings', icon: 'settings', label: 'Settings', desc: 'Visibility & donations' },
];

export function QrPosterPanel({ campaignId }: { campaignId: string }) {
  const posterUrl = `/api/campaigns/${campaignId}/qr-poster`;
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>Print QR Poster</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--t3)' }}>
            Download &amp; print a poster with a QR code that links straight to your campaign.
          </p>
        </div>
        <a href={posterUrl} target="_blank" rel="noopener noreferrer" className="kf-primary"
          style={{ textDecoration: 'none', height: 40, display: 'inline-flex', alignItems: 'center', padding: '0 18px', fontSize: 13 }}>
          Open &amp; Print ↗
        </a>
      </div>
      <iframe
        src={posterUrl}
        title="QR Poster preview"
        style={{ width: '100%', height: 760, border: '1px solid var(--b2)', borderRadius: 14, background: 'var(--s1)' }}
      />
    </div>
  );
}

export default function CampaignWorkspace({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: string;
}) {
  const [activeTool, setActiveTool] = useState<ToolKey>('supporters');

  return (
    <>
      {/* ── Actions + Campaign Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            onClick={() => setActiveTool('edit')}
            className="kf-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <KFIcon name="doc" /> Edit Campaign
          </button>
          <Link href="/dashboard/campaigns" className="kf-outline"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
            ← Back
          </Link>
        </div>
        <CampaignControls campaignId={campaignId} currentStatus={currentStatus} />
      </div>

      {/* ── Campaign Tools ── */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 650 }}>Campaign Tools</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {TOOLS.map(tool => {
            const active = activeTool === tool.key;
            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => setActiveTool(tool.key)}
                className="kf-card"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                  padding: '14px 14px', cursor: 'pointer', textAlign: 'left', font: 'inherit',
                  border: active ? '1.5px solid #6c35ff' : undefined,
                  background: active ? 'rgba(108,53,255,.06)' : undefined,
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <KFIcon name={tool.icon} />
                <strong style={{ fontSize: 13, color: active ? '#6c35ff' : 'var(--t1)', marginTop: 6 }}>{tool.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{tool.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Active tool content ── */}
      <div>
        {activeTool === 'supporters' && <SupportersPanel campaignId={campaignId} showHeading />}
        {activeTool === 'share' && <SharePanel campaignId={campaignId} />}
        {activeTool === 'thank-donors' && <ThankDonorsPanel campaignId={campaignId} />}
        {activeTool === 'ledger' && <LedgerPanel campaignId={campaignId} />}
        {activeTool === 'faqs' && <FaqsPanel campaignId={campaignId} />}
        {activeTool === 'qr-poster' && <QrPosterPanel campaignId={campaignId} />}
        {activeTool === 'updates' && <UpdatesPanel campaignId={campaignId} />}
        {activeTool === 'analytics' && <AnalyticsPanel campaignId={campaignId} />}
        {activeTool === 'settings' && <SettingsPanel campaignId={campaignId} />}
        {activeTool === 'edit' && <EditCampaignPanel campaignId={campaignId} />}
      </div>
    </>
  );
}
