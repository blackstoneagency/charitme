'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { InviteMemberButton, RemoveMemberButton, type NewMember } from './TeamActions';

// ─────────────────────────────────────────────
// Types (mirrored from page.tsx — keep in sync)
// ─────────────────────────────────────────────
export type Campaign = { id: string; title: string };
export type TeamMember = {
  id: string;
  campaign_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
};
export type Profile = { id: string; full_name: string | null };

interface Props {
  campaigns: Campaign[];
  initialMembers: TeamMember[];
  profiles: Profile[];
  currentUserId: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type RoleColor = 'violet' | 'blue' | 'green' | 'orange';
const ROLE_COLOR: Record<string, RoleColor> = {
  owner: 'violet',
  admin: 'blue',
  member: 'green',
  viewer: 'orange',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function TeamClient({ campaigns, initialMembers, profiles, currentUserId }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [activeTab, setActiveTab] = useState('all');

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? 'Unknown']));
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.title]));

  // Augment profileMap with any newly added member IDs (their profiles may not be loaded yet)
  function handleAdded(m: NewMember) {
    const asMember: TeamMember = {
      ...m,
      role: (['owner', 'admin', 'member', 'viewer'].includes(m.role)
        ? m.role
        : 'member') as TeamMember['role'],
    };
    setMembers((prev) => [asMember, ...prev]);
  }

  function handleRemoved(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  // Metrics
  const totalMembers = members.length;
  const adminsCount = members.filter((m) => m.role === 'admin').length;
  const membersCount = members.filter((m) => m.role === 'member').length;
  const viewersCount = members.filter((m) => m.role === 'viewer').length;

  const tabDefs = [
    { key: 'all', label: 'All Members', count: totalMembers },
    { key: 'admin', label: 'Admins', count: adminsCount },
    { key: 'member', label: 'Members', count: membersCount },
    { key: 'viewer', label: 'Viewers', count: viewersCount },
  ];

  const filtered = activeTab === 'all' ? members : members.filter((m) => m.role === activeTab);

  const metrics = [
    { label: 'Total Members', value: String(totalMembers), tone: 'violet' },
    { label: 'Admins', value: String(adminsCount), tone: 'blue' },
    { label: 'Members', value: String(membersCount), tone: 'green' },
    { label: 'Viewers', value: String(viewersCount), tone: 'orange' },
  ];

  return (
    <>
      {/* Metrics strip */}
      <div className="kf-metrics">
        {metrics.map((m) => (
          <div key={m.label} className={`kf-metric-card ${m.tone}`} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t3)', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--t1)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <section className="kf-card" style={{ overflow: 'hidden' }}>
        <div className="kf-card-head">
          <h2>Team Members</h2>
          <div className="kf-card-tools">
            <InviteMemberButton campaigns={campaigns} onAdded={handleAdded} />
          </div>
        </div>

        {/* Tabs */}
        <div className="kf-tabs">
          {tabDefs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'active' : ''}
              onClick={() => setActiveTab(key)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {label}
              {count > 0 && (
                <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, opacity: 0.65 }}>
                  ({count})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="kf-table-scroll">
        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 160px 110px 110px 110px',
            gap: 12,
            padding: '8px 20px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--t3)',
            borderBottom: '1px solid var(--b1)',
          }}
        >
          <span />
          <span>Member</span>
          <span>Campaign</span>
          <span>Role</span>
          <span>Joined</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {/* Rows */}
        {filtered.length > 0 && (
          <div className="kf-rows">
            {filtered.map((m) => {
              const name = profileMap.get(m.user_id) ?? 'Unknown';
              const campaignTitle = campaignMap.get(m.campaign_id) ?? 'Unknown campaign';
              const roleColor = ROLE_COLOR[m.role] ?? 'violet';
              const isOwner = m.user_id === currentUserId;
              const canRemove = !isOwner || m.role !== 'owner';

              return (
                <div
                  key={m.id}
                  className="kf-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 160px 110px 110px 110px',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#6c35ff,#4f22cc)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {initials(name)}
                  </div>

                  {/* Name */}
                  <div>
                    <strong style={{ fontSize: 14, display: 'block', color: 'var(--t1)' }}>{name}</strong>
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                      {isOwner ? 'You' : 'Team member'}
                    </span>
                  </div>

                  {/* Campaign */}
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--t3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={campaignTitle}
                  >
                    {campaignTitle}
                  </div>

                  {/* Role badge */}
                  <div>
                    <span className={`kf-pill ${roleColor}`} style={{ fontSize: 11 }}>
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                  </div>

                  {/* Joined */}
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{fmtDate(m.created_at)}</div>

                  {/* Action */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {canRemove ? (
                      <RemoveMemberButton
                        memberId={m.id}
                        memberName={name}
                        onRemoved={handleRemoved}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--t4)' }}>Owner</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width={40} height={40} style={{ opacity: 0.35, display: 'block', margin: '0 auto' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--t2)' }}>
              {totalMembers === 0
                ? 'Invite team members to collaborate on your campaigns.'
                : `No ${activeTab} members.`}
            </p>
            {totalMembers === 0 && campaigns.length === 0 && (
              <Link
                href="/create"
                className="kf-primary"
                style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none' }}
              >
                Create a Campaign First
              </Link>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="kf-table-footer" style={{ padding: '12px 20px', fontSize: 13, color: 'var(--t3)' }}>
            Showing {filtered.length} of {totalMembers} member{totalMembers !== 1 ? 's' : ''}
          </div>
        )}
      </section>
    </>
  );
}
