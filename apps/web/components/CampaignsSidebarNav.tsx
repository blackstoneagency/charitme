'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KFIcon, type SidebarCampaign } from './CharitMeApp';

const STATUS_DOT: Record<string, string> = {
  active: '#19b86a',
  paused: '#f97316',
  completed: '#8b5cf6',
  draft: '#94a3b8',
  frozen: '#ef4444',
  archived: '#94a3b8',
};

export default function CampaignsSidebarNav({
  href,
  icon,
  label,
  isActive,
  campaigns,
  hasMore,
}: {
  href: string;
  icon: string;
  label: string;
  isActive: boolean;
  campaigns: SidebarCampaign[];
  hasMore: boolean;
}) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const onCampaignsSection = segments[0] === 'dashboard' && segments[1] === 'campaigns';
  const activeCampaignId = onCampaignsSection && segments[2] && segments[2] !== 'new' ? segments[2] : null;

  const [expanded, setExpanded] = useState(onCampaignsSection);

  if (campaigns.length === 0) {
    return (
      <Link href={href} className={isActive ? 'active' : ''}>
        <KFIcon name={icon} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <div className="kf-nav-group">
      <div className="kf-nav-item-row">
        <Link href={href} className={`kf-nav-item-link${isActive ? ' active' : ''}`}>
          <KFIcon name={icon} />
          <span>{label}</span>
        </Link>
        <button
          type="button"
          className="kf-nav-toggle"
          aria-label={expanded ? 'Collapse campaign list' : 'Expand campaign list'}
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          <KFIcon name="chevron" className={expanded ? 'kf-chevron-open' : ''} />
        </button>
      </div>
      {expanded && (
        <div className="kf-nav-sub">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/campaigns/${c.id}`}
              className={`kf-nav-sub-link${c.id === activeCampaignId ? ' active' : ''}`}
              title={c.title}
            >
              <span className="kf-nav-sub-dot" style={{ background: STATUS_DOT[c.status] ?? STATUS_DOT.draft }} />
              <span className="kf-nav-sub-title">{c.title}</span>
            </Link>
          ))}
          {hasMore && (
            <Link href="/dashboard/campaigns" className="kf-nav-sub-link kf-nav-sub-more">
              View all campaigns →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
