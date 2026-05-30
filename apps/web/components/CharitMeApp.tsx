import React from 'react';
import Link from 'next/link';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';

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

export type ShellProps = {
  active: string;
  children: React.ReactNode;
  mode?: 'dashboard' | 'admin';
  hasAdminAccess?: boolean;
  userName?: string | null;
  userEmail?: string;
  userRole?: string | null;
  userAvatarUrl?: string | null;
};

export type ShellVariant = 'dashboard' | 'admin';

const dashboardNav = [
  ['Dashboard', '/dashboard', 'home'],
  ['My Campaigns', '/dashboard/campaigns', 'stack'],
  ['AI Growth Plan', '/dashboard/ai-growth-plan', 'send', 'New'],
  ['AI Coach', '/dashboard/ai-coach', 'send', 'AI'],
  ['Donations', '/dashboard/donations', 'gift'],
  ['Recurring', '/dashboard/recurring', 'gift'],
  ['Donors', '/dashboard/donor', 'users'],
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
  ['Users', '/admin/users', 'users'],
  ['Campaigns', '/admin/campaigns', 'stack'],
  ['Donations', '/admin/donations', 'gift'],
  ['Payouts', '/admin/payouts', 'wallet'],
  ['Content', '/admin/content', 'doc'],
  ['Reports', '/admin/reports', 'chart'],
  ['Settings', '/admin/settings', 'gear'],
  ['Audit Log', '/admin/audit-log', 'audit'],
  ['System Settings', '/admin/system', 'sliders'],
  ['⚙ Setup Diagnostic', '/admin/setup', 'check'],
] as const;

export const sampleImages = {
  mia: '/hero-child-crop.png',
  water: 'linear-gradient(135deg,#c7e8ff,#48769f)',
  family: 'linear-gradient(135deg,#dbeafe,#f9a8d4)',
  dog: 'linear-gradient(135deg,#fef3c7,#92400e)',
  class: 'linear-gradient(135deg,#d1fae5,#0f766e)',
  medical: 'linear-gradient(135deg,#e0f2fe,#7c3aed)',
};

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
    filter: <path d="M22 3H2l8 9v7l4 2v-9l8-9Z" />,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5M12 3v12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  };
  return <svg {...props}>{paths[name] ?? paths.home}</svg>;
}

export function Logo() {
  return (
    <Link href="/" className="kf-logo">
      <span><i /><b /></span>
      <div><strong>CharitMe</strong><small>Fundraising that thinks for you.</small></div>
    </Link>
  );
}

export function CharitMeShell({ active, children, mode = 'dashboard', hasAdminAccess = false, userName, userEmail, userRole, userAvatarUrl }: ShellProps) {
  const nav = mode === 'admin' ? adminNav : dashboardNav;
  const displayName = userName || userEmail?.split('@')[0] || (mode === 'admin' ? 'Admin User' : 'My Account');
  const displayRole = userRole || (mode === 'admin' ? 'Super Admin' : 'Organizer');
  return (
    <div className="kf-app">
      <aside className="kf-sidebar">
        <Logo />

        {/* ── ADMIN mode: single admin nav ── */}
        {mode === 'admin' && (
          <>
            <div className="kf-section-label">Admin</div>
            <nav className="kf-nav">
              {adminNav.map(([label, href, icon, badge]) => {
                const isActive = active === label;
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

        {/* ── DASHBOARD mode with admin access: Admin section FIRST, then user nav ── */}
        {mode === 'dashboard' && hasAdminAccess && (
          <div className="kf-admin-nav kf-admin-nav--top">
            <div className="kf-section-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={13} height={13} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
              </svg>
              Admin
            </div>
            <nav className="kf-nav">
              {adminNav.map(([label, href, icon]) => (
                <Link key={href} href={href}>
                  <KFIcon name={icon} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* ── DASHBOARD mode: user nav (below admin for admins) ── */}
        {mode === 'dashboard' && (
          <>
            <Link href="/create" className="kf-create"><KFIcon name="plus" /> Create New Campaign</Link>
            <nav className="kf-nav">
              {dashboardNav.map(([label, href, icon, badge]) => {
                const isActive = active === label || (active === 'Campaigns' && label === 'My Campaigns');
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

        <div className="kf-pro">
          <div><KFIcon name="crown" /> CharitMe Pro</div>
          <p>Unlock advanced tools, insights, automation, and priority support.</p>
          <Link href="/pricing">Upgrade Now</Link>
        </div>
        <div className="kf-profile">
          <Avatar name={displayName} imageUrl={userAvatarUrl} />
          <div>
            <strong>{displayName}</strong>
            <span>{displayRole}</span>
          </div>
          <LogoutButton />
        </div>
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
        <label className="kf-search"><KFIcon name="search" /><input placeholder={`Search ${title.toLowerCase()}...`} /></label>
        {actions}
        {/* Notification bell — count fetched client-side; hidden when count is 0 */}
        <NotificationBell />
      </div>
    </header>
  );
}

// NotificationBell is a 'use client' component in ./NotificationBell.tsx
// It uses useState/useEffect — must NOT be defined here (no 'use client' directive)

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

export function DataTable({ title, tabs, rows, ctaLabel = 'View all', href = '#' }: { title: string; tabs?: string[]; rows: TableRow[]; ctaLabel?: string; href?: string }) {
  return (
    <section className="kf-card kf-table-card">
      <div className="kf-card-head">
        <h2>{title}</h2>
        <div className="kf-card-tools">
          <button>Sort by: Newest First</button>
          <button className="square"><KFIcon name="sliders" /></button>
        </div>
      </div>
      {tabs && <div className="kf-tabs">{tabs.map((tab, i) => <button key={tab} className={i === 0 ? 'active' : ''}>{tab}</button>)}</div>}
      <div className="kf-rows">
        {rows.map((row) => (
          <Link key={`${row.title}-${row.subtitle}`} href={row.href || href} className="kf-row">
            <SmartImage image={row.image} />
            <div className="kf-row-main">
              <div>{row.status && <StatusPill>{row.status}</StatusPill>}<strong>{row.title}</strong></div>
              {row.subtitle && <p>{row.subtitle}</p>}
              {row.meta && <small>{row.meta.join(' • ')}</small>}
            </div>
            {row.amount && <b>{row.amount}</b>}
            <span className="kf-row-action">View Details</span>
          </Link>
        ))}
      </div>
      <Link href={href} className="kf-table-footer">{ctaLabel} →</Link>
    </section>
  );
}

export function LineChart({ title = 'Performance Overview' }: { title?: string }) {
  return (
    <section className="kf-card kf-chart">
      <div className="kf-card-head"><h2>{title}</h2><button>7 Days</button></div>
      <svg viewBox="0 0 520 220" role="img" aria-label={title}>
        <defs><linearGradient id="kfLine" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#6c35ff" stopOpacity=".22" /><stop offset="1" stopColor="#6c35ff" stopOpacity="0" /></linearGradient></defs>
        {[35, 80, 125, 170].map((y) => <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="#eef0f7" />)}
        <path d="M12 190 C60 156 82 172 122 128 S190 112 224 126 S272 62 322 86 S390 55 430 42 S482 66 508 20 L508 220 L12 220Z" fill="url(#kfLine)" />
        <path d="M12 190 C60 156 82 172 122 128 S190 112 224 126 S272 62 322 86 S390 55 430 42 S482 66 508 20" fill="none" stroke="#6c35ff" strokeWidth="5" strokeLinecap="round" />
        {[12,122,224,322,430,508].map((x, i) => <circle key={x} cx={x} cy={[190,128,126,86,42,20][i]} r="7" fill="#6c35ff" stroke="#fff" strokeWidth="4" />)}
      </svg>
    </section>
  );
}

export function DonutCard({ title = 'Donations by Source', total = '0' }: { title?: string; total?: string }) {
  const items = [['Facebook', 'Live', '#6c35ff'], ['Instagram', 'Live', '#ec3fb4'], ['Direct / Email', 'Live', '#2f80ed'], ['Google', 'Live', '#19b86a'], ['Other', 'Live', '#f59e0b']];
  return (
    <section className="kf-card kf-donut-card">
      <div className="kf-card-head"><h2>{title}</h2><Link href="/dashboard/analytics">View details</Link></div>
      <div className="kf-donut-wrap">
        <div className="kf-donut"><span><strong>{total}</strong><small>Total</small></span></div>
        <div>{items.map(([label, pct, color]) => <p key={label}><i style={{ background: color }} /> {label}<b>{pct}</b></p>)}</div>
      </div>
    </section>
  );
}

export function SidePanel({ kind = 'insights' }: { kind?: 'insights' | 'support' | 'status' }) {
  const title = kind === 'status' ? 'System Status' : kind === 'support' ? 'Need help?' : 'AI Growth Insights';
  return (
    <aside className="kf-side-panels">
      <section className="kf-card kf-ai-card">
        <div className="kf-card-head"><h2>{title}</h2><Link href="/dashboard/ai-growth-plan">View all</Link></div>
        {['Post a video update', 'Re-engage past donors', 'Boost on social media'].map((item, i) => (
          <Link href="/dashboard/ai-growth-plan" className="kf-mini-action" key={item}><div className={`kf-square ${['violet', 'green', 'orange'][i]}`}><KFIcon name={i === 0 ? 'doc' : i === 1 ? 'users' : 'send'} /></div><span><strong>{item}</strong><small>{i === 0 ? 'Review current campaign media from Supabase.' : i === 1 ? 'Use live donor records for outreach.' : 'Build a plan from campaign analytics.'}</small></span></Link>
        ))}
      </section>
      <section className="kf-card">
        <div className="kf-card-head"><h2>Live Data</h2><Link href="/dashboard/analytics">View analytics</Link></div>
        <p className="kf-activity"><Avatar name="CharitMe" /><span>Rows, metrics, and queues on this page are loaded from Supabase.<small>Refresh to see new records</small></span></p>
      </section>
    </aside>
  );
}

export function PageScaffold({ active, title, subtitle, metrics, rows, tabs, side = true, mode = 'dashboard', children, userName, userEmail }: {
  active: string;
  title: string;
  subtitle: string;
  metrics: Metric[];
  rows: TableRow[];
  tabs?: string[];
  side?: boolean;
  mode?: 'dashboard' | 'admin';
  children?: React.ReactNode;
  userName?: string | null;
  userEmail?: string;
}) {
  return (
    <CharitMeShell active={active} mode={mode} userName={userName} userEmail={userEmail}>
      <TopBar title={title} subtitle={subtitle} actions={<><button className="kf-outline"><KFIcon name="filter" /> Filters</button><button className="kf-outline"><KFIcon name="upload" /> Export</button></>} />
      <div className="kf-content-grid">
        <div className="kf-content-main">
          <MetricGrid metrics={metrics} />
          {children}
          <DataTable title={title.includes('Dashboard') ? 'Your Campaigns' : title} tabs={tabs} rows={rows} />
          <div className="kf-two-col"><LineChart /><DonutCard /></div>
        </div>
        {side && <SidePanel />}
      </div>
    </CharitMeShell>
  );
}

export function FlowPage({ title, subtitle, mode = 'dashboard', active = 'Dashboard', steps }: { title: string; subtitle: string; mode?: 'dashboard' | 'admin'; active?: string; steps: string[] }) {
  return (
    <CharitMeShell active={active} mode={mode}>
      <div className="kf-flow">
        <header><h1>{title}</h1><p>{subtitle}</p></header>
        <div className="kf-flow-steps">
          {steps.map((step, i) => (
            <article key={step}>
              <span>{i + 1}</span>
              <h2>{step}</h2>
              <p>{flowCopy(step)}</p>
            </article>
          ))}
        </div>
        <div className="kf-flow-grid">
          {steps.map((step, i) => (
            <section className="kf-card kf-flow-card" key={`${step}-card`}>
              <div className="kf-card-head"><h2>{step}</h2>{i === steps.length - 1 && <StatusPill>Success</StatusPill>}</div>
              {i === steps.length - 1 ? <SuccessCard /> : <MiniScreen index={i} />}
            </section>
          ))}
        </div>
        <Journey title={title.replace(' - End to End Flow', '').replace('Admin → ', '')} steps={steps.slice(0, 7)} />
      </div>
    </CharitMeShell>
  );
}

function flowCopy(step: string) {
  if (step.toLowerCase().includes('search')) return 'Find records quickly using search, filters, and sorting.';
  if (step.toLowerCase().includes('details')) return 'Open a record to review activity, status, and related information.';
  if (step.toLowerCase().includes('action')) return 'Take the required action and confirm the result.';
  if (step.toLowerCase().includes('saved') || step.toLowerCase().includes('completed')) return 'The change is confirmed and visible across the platform.';
  return 'Access this section and continue through the workflow.';
}

function MiniScreen({ index }: { index: number }) {
  const rows = ['Campaign record', 'Donation record', 'Profile record', 'Payout record', 'Review record'];
  return (
    <div className="kf-mini-screen">
      {index % 3 === 0 && <LineChart title="Overview" />}
      {index % 3 === 1 && rows.map((r) => <p key={r}><Avatar name={r} /><span>{r}<small>Active</small></span></p>)}
      {index % 3 === 2 && <><label>Record Name<input defaultValue="Supabase record" /></label><label>Status<select defaultValue="Active"><option>Active</option></select></label><button>Save Changes</button></>}
    </div>
  );
}

function SuccessCard() {
  return <div className="kf-success"><div><KFIcon name="check" /></div><h2>Success!</h2><p>Your changes have been saved successfully.</p><button>Back to Dashboard</button></div>;
}

export function Journey({ title, steps }: { title: string; steps: string[] }) {
  return (
    <section className="kf-journey">
      <h2>The {title} Journey</h2>
      {steps.map((step) => <div key={step}><span><KFIcon name="check" /></span><strong>{step}</strong><small>{flowCopy(step)}</small></div>)}
    </section>
  );
}

export const baseMetrics: Metric[] = [];

export const campaignRows: TableRow[] = [];
