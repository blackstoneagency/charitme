'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { KFIcon } from '../../components/CharitMeApp';
import CampaignMenu from './CampaignMenu';

export type DisplayCampaign = {
  id: string;
  slug: string;
  title: string;
  image: string;
  status: string;
  rawStatus: string;
  raised: string;
  goal: string;
  progress: number;
  raisedAmount: number;
  backerCount: number;
  donations: string;
  views: string;
  conversion: string;
  href: string;
};

type SortKey = 'recent' | 'performance' | 'raised' | 'donations';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Most Recent' },
  { key: 'performance', label: 'Performance' },
  { key: 'raised', label: 'Most Raised' },
  { key: 'donations', label: 'Most Donations' },
];

function CampaignImage({ image }: { image: string }) {
  if (image.startsWith('/'))
    return <div className="campaign-img" style={{ backgroundImage: `url(${image})` }} />;
  return <div className={`campaign-img ${image}`} />;
}

function CampaignStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="campaign-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function CampaignSortableList({
  campaigns,
  hasRealCampaigns,
}: {
  campaigns: DisplayCampaign[];
  hasRealCampaigns: boolean;
}) {
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const sorted = [...campaigns].sort((a, b) => {
    if (sortBy === 'performance') return b.progress - a.progress;
    if (sortBy === 'raised') return b.raisedAmount - a.raisedAmount;
    if (sortBy === 'donations') return b.backerCount - a.backerCount;
    return 0; // 'recent' — campaigns already arrive ordered by created_at desc
  });

  const activeLabel = SORT_OPTIONS.find(o => o.key === sortBy)?.label ?? 'Most Recent';

  return (
    <section className="dash-card campaign-panel">
      <div className="dash-card-title">
        <h2>Your Campaigns</h2>
        <div className="campaign-sort-wrap" ref={rootRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            Sort by: {activeLabel} <span>v</span>
          </button>
          {open && (
            <div className="campaign-sort-dropdown" role="menu">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  role="menuitem"
                  className={opt.key === sortBy ? 'active' : ''}
                  onClick={() => { setSortBy(opt.key); setOpen(false); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!hasRealCampaigns && (
        <div style={{ padding: '12px 20px 4px' }}>
          <div
            style={{
              display: 'flex', minWidth: 0,
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(108,53,255,0.07)',
              border: '1px solid rgba(108,53,255,0.15)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--violet, #4e16f5)',
            }}
          >
            <KFIcon name="send" />
            <span>
              No campaigns yet —{' '}
              <Link href="/create/choose-path" style={{ textDecoration: 'underline' }}>
                create your first campaign
              </Link>{' '}
              to start collecting real data here.
            </span>
          </div>
        </div>
      )}

      <div className="campaign-list">
        {sorted.map(campaign => (
          <article className="campaign-item" key={campaign.id}>
            <CampaignImage image={campaign.image} />
            <div className="campaign-copy">
              <span className={`campaign-status ${campaign.status.toLowerCase()}`}>
                {campaign.status}
              </span>
              <h3>{campaign.title}</h3>
              <p>
                <b>{campaign.raised}</b> raised of {campaign.goal} goal
              </p>
              <div className="campaign-progress">
                <span style={{ width: `${campaign.progress}%` }} />
              </div>
            </div>
            <CampaignStat value={campaign.donations} label="Donations" />
            <CampaignStat value={campaign.views} label="Views" />
            <CampaignStat value={campaign.conversion} label="Conversion" />
            <Link className="campaign-detail" href={campaign.href}>
              View Details <span>&gt;</span>
            </Link>
            <CampaignMenu id={campaign.id} slug={campaign.slug} title={campaign.title} status={campaign.rawStatus} />
          </article>
        ))}
      </div>
      <Link href="/dashboard/campaigns" className="campaign-footer">
        View All Campaigns <span>-&gt;</span>
      </Link>
    </section>
  );
}
