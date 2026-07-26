import React from 'react';
import Link from 'next/link';
import ShellAccountControls from './ShellAccountControls';
import CampaignsSidebarNav from './CampaignsSidebarNav';
import SuperAdminNav from './SuperAdminNav';

export type Metric = {
  label: string;
  value: string;
  change?: string;
  tone?: 'violet' | 'green' | 'blue' | 'orange' | 'pink';
  icon?: string;
};

export type TableRow = {
  title: string;
  subtitle?: string;
  image?: string;
  status?: string;
  amount?: string;
  meta?: string[];
  href?: string;
};

export type SidebarCampaign = { id: string; title: string; status: string };

export type ShellProps = {
  active: string;
  children: React.ReactNode;
  mode?: 'dashboard' | 'admin';
  hasAdminAccess?: boolean;
  userName?: string | null;
  userEmail?: string;
  userRole?: string | null;
  /** Raw profile roles, used to show role-scoped nav entries. */
  navRoles?: string[];
  userAvatarUrl?: string | null;
  guestMode?: boolean;
  hideSidebar?: boolean;
  sidebarCampaigns?: SidebarCampaign[];
  sidebarCampaignsHasMore?: boolean;
};

export type ShellVariant = 'dashboard' | 'admin';

// Nav entries that only make sense for a specific role. Without these the
// beneficiary and nonprofit dashboards are reachable only by typing the URL —
// a nonprofit would never find its own verification/tax-receipt page.
const roleScopedNav: Record<string, [string, string, string]> = {
  beneficiary: ['Campaigns for you', '/dashboard/beneficiary', 'gift'],
  nonprofit:   ['Your organization', '/dashboard/nonprofit', 'check'],
};

const dashboardNav = [
  ['Dashboard', '/dashboard', 'home'],
  ['My Campaigns', '/dashboard/campaigns', 'stack'],
  ['AI Growth Plan', '/dashboard/ai-growth-plan', 'send', 'New'],
  ['AI Coach', '/dashboard/ai-coach', 'send', 'AI'],
  ['Donations', '/dashboard/donations', 'gift'],
  ['Recurring', '/dashboard/recurring', 'gift'],
  ['Donors', '/dashboard/donor', 'users'],
  ['Grants', '/dashboard/grants', 'audit'],
  ['Volunteering', '/dashboard/volunteer', 'team'],
  ['Corporate Giving', '/dashboard/corporate', 'crown'],
  ['Referrals', '/dashboard/referrals', 'crown'],
  ['Updates', '/dashboard/updates', 'doc'],
  ['Payouts', '/dashboard/payouts', 'wallet'],
  ['Analytics', '/dashboard/analytics', 'chart'],
  ['Messages', '/dashboard/messages', 'chat'],
  ['Team', '/dashboard/team', 'team'],
  ['Integrations', '/dashboard/integrations', 'link'],
  ['Settings', '/dashboard/settings', 'gear'],
] as const;

const adminNav = [
  ['Dashboard', '/admin', 'home'],
  ['New Customers', '/admin/new-customers', 'search'],
  ['Users', '/admin/users', 'users'],
  ['Campaigns', '/admin/campaigns', 'stack'],
  ['Donations', '/admin/donations', 'gift'],
  ['Payouts', '/admin/payouts', 'wallet'],
  ['Payment Flows', '/admin/payments/campaign-flows', 'wallet'],
  ['Finance', '/admin/finance', 'chart'],
  ['Pricing', '/admin/pricing', 'chart'],
  ['Reconciliation', '/admin/reconciliation', 'audit'],
  ['Trust & Safety', '/admin/trust-safety', 'audit'],
  ['Marketing', '/admin/marketing', 'send', 'New'],
  ['Support', '/admin/support', 'chat'],
  ['Sponsors', '/admin/sponsors', 'crown'],
  ['Grants', '/admin/grants', 'audit'],
  ['Volunteers', '/admin/volunteers', 'team'],
  ['Privacy Requests', '/admin/privacy', 'audit'],
  ['Content', '/admin/content', 'doc'],
  ['Reports', '/admin/reports', 'chart'],
  ['Settings', '/admin/settings', 'gear'],
  ['Audit Log', '/admin/audit-log', 'audit'],
  ['System Settings', '/admin/system', 'sliders'],
  ['Supported Countries', '/admin/countries', 'globe'],
  ['⚙ Setup Diagnostic', '/admin/setup', 'check'],
] as const;

export function KFIcon({ name, className = '' }: { name: string; className?: string }) {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: `kf-icon ${className}` };
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
    stack: <><path d="M12 2l9 5-9 5-9-5 9-5Z" /><path d="M3 12l9 5 9-5" /><path d="M3 17l9 5 9-5" /></>,
    send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7Z" /></>,
    gift: <><path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 1 1 2-4L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2-4L12 7Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></>,
    wallet: <><path d="M20 7H5a3 3 0 0 1 0-6h12v6" /><path d="M4 7v13a2 2 0 0 0 2 2h14V7" /><path d="M16 14h.01" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /></>,
    team: <><circle cx="9" cy="7" r="4" /><circle cx="17" cy="10" r="3" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 18a5 5 0 0 1 6 3" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    gear: <><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.36.3.74.5 1.1.6H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.4Z" /></>,
    audit: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M2 14h4M10 8h4M18 16h4" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M20 6L9 17l-5-5" />,
    crown: <path d="M3 8l4 3 5-7 5 7 4-3-2 10H5L3 8Z" />,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></>,
    filter: <path d="M22 3H2l8 9v7l4 2v-9l8-9Z" />,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    chevron: <path d="M9 18l6-6-6-6" />,
  };
  return <svg {...props}>{paths[name] ?? paths.home}</svg>;
}

export function Logo() {
  return (
    <Link href="/" className="kf-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="kf-logo-img" width={42} height={42} />
      <div><strong>CharitMe</strong><small>Fundraising that thinks for you.</small></div>
    </Link>
  );
}

export function CharitMeShell({ active, children, mode = 'dashboard', hasAdminAccess: _hasAdminAccess = false, userName, userEmail, userRole, navRoles = [], userAvatarUrl, guestMode = false, hideSidebar = false, sidebarCampaigns = [], sidebarCampaignsHasMore = false }: ShellProps) {
  const _nav = mode === 'admin' ? adminNav : dashboardNav; void _nav;

  if (hideSidebar) {
    return (
      <div className="kf-app kf-app--no-sidebar">
        <main className="kf-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="kf-app">
      <aside className="kf-sidebar">
        <Logo />

        {/* ── ADMIN mode: single admin nav ── */}
        {mode === 'admin' && (
          <>
            <div className="kf-section-label">Admin</div>
            <nav className="kf-nav">
              {adminNav.map((item) => {
                const [label, href, icon] = item;
                const isActive = active === label;
                return (
                  <Link key={href} href={href} className={isActive ? 'active' : ''}>
                    <KFIcon name={icon} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            {/* Super-admin-only console dropdown (self-gates via API; renders nothing for non-super-admins) */}
            <SuperAdminNav />
          </>
        )}

        {/* ── DASHBOARD mode: user nav ── */}
        {mode === 'dashboard' && (
          <>
            <Link href="/create/choose-path" className="kf-create"><KFIcon name="plus" /> Create New Campaign</Link>
            <nav className="kf-nav">
              {/* Base nav + any role-scoped entries the signed-in user qualifies for. */}
              {[...dashboardNav, ...navRoles.flatMap((r) => (roleScopedNav[r] ? [roleScopedNav[r]] : []))].map(([label, href, icon, badge]) => {
                const isActive = active === label || (active === 'Campaigns' && label === 'My Campaigns');
                const isGuestDisabled = guestMode && label !== 'My Campaigns';
                if (isGuestDisabled) {
                  return (
                    <span key={href} className="kf-nav-guest-item" title="Sign in to access">
                      <KFIcon name={icon} />
                      <span>{label}</span>
                      {badge && <em>{badge}</em>}
                    </span>
                  );
                }
                if (label === 'My Campaigns') {
                  return (
                    <CampaignsSidebarNav
                      key={href}
                      href={href}
                      icon={icon}
                      label={label}
                      isActive={isActive}
                      campaigns={sidebarCampaigns}
                      hasMore={sidebarCampaignsHasMore}
                    />
                  );
                }
                return (
                  <Link key={href} href={href} className={isActive ? 'active' : ''}>
                    <KFIcon name={icon} />
                    <span>{label}</span>
                    {badge && <em>{badge}</em>}
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        {mode === 'admin' && (
          <Link href="/" className="kf-back-to-dashboard">
            <KFIcon name="home" />
            View Public Site
          </Link>
        )}

        {/* Signed-in identity chip — data is fetched server-side in
            CharitMeShellServer and threaded through as props. Hidden for guests
            and on the mobile bottom-nav (identity stays in the top-bar menu). */}
        {!guestMode && (userName || userEmail) && (
          <div className="kf-user-chip" title={userEmail || undefined}>
            <Avatar name={userName || userEmail || '?'} imageUrl={userAvatarUrl} />
            <div className="kf-user-chip-meta">
              <strong>{userName || userEmail}</strong>
              {userRole && <small>{userRole}</small>}
            </div>
          </div>
        )}
      </aside>
      <main className="kf-main">{children}</main>
    </div>
  );
}

export function TopBar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode; userName?: string | null; userAvatarUrl?: string | null }) {
  return (
    <header className="kf-topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="kf-top-actions">
        {actions}
        <ShellAccountControls />
      </div>
    </header>
  );
}


export function Avatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="kf-avatar"
        style={{ objectFit: 'cover', padding: 0 }}
      />
    );
  }
  return <div className="kf-avatar">{initials}</div>;
}

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="kf-metrics">
      {metrics.map((metric) => (
        <article key={metric.label} className="kf-card kf-metric">
          <div className={`kf-square ${metric.tone || 'violet'}`}><KFIcon name={metric.icon || 'chart'} /></div>
          <div><span>{metric.label}</span><strong>{metric.value}</strong>{metric.change && <small>{metric.change}</small>}</div>
        </article>
      ))}
    </div>
  );
}

export function StatusPill({ children }: { children: React.ReactNode }) {
  const text = String(children).toLowerCase();
  const tone = text.includes('active') || text.includes('completed') || text.includes('published') || text.includes('connected') ? 'green' : text.includes('pending') || text.includes('paused') ? 'orange' : text.includes('failed') || text.includes('inactive') ? 'red' : 'violet';
  return <span className={`kf-pill ${tone}`}>{children}</span>;
}

export function SmartImage({ image }: { image?: string }) {
  if (!image) return <div className="kf-thumb gradient" />;
  if (image.startsWith('/')) return <div className="kf-thumb" style={{ backgroundImage: `url(${image})` }} />;
  return <div className="kf-thumb" style={{ background: image }} />;
}

export const campaignRows: TableRow[] = [];
