import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { SUPER_ADMIN_NAV } from '../../../components/SuperAdminNav';

export const dynamic = 'force-dynamic';

async function count(table: string): Promise<number> {
  try {
    const { count: c } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    return c ?? 0;
  } catch {
    return 0;
  }
}

async function countAdmins(): Promise<number> {
  try {
    const { count: c } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .contains('roles', ['admin']);
    return c ?? 0;
  } catch {
    return 0;
  }
}

const DESCRIPTIONS: Record<string, string> = {
  'Overview': 'Console home and platform health at a glance.',
  'Roles & Permissions': 'Grant or revoke platform roles per user.',
  'Users': 'Full user directory — search, roles, suspend/restore.',
  'Marketing': 'SEO, AEO (answer-engine), and marketing campaigns.',
  'Feature Flags': 'Toggle platform capabilities and rollout %.',
  'Platform Settings': 'Fees, support contact, maintenance mode.',
  'Announcements': 'Site-wide banners with scheduling.',
  'Activity Log': 'Every super-admin action, audited.',
};

export default async function SuperAdminOverviewPage() {
  await requireSuperAdmin();

  const [users, admins, campaigns, donations, flags, seo, aeo, announcements] = await Promise.all([
    count('profiles'),
    countAdmins(),
    count('campaigns'),
    count('donations'),
    count('feature_flags'),
    count('seo_settings'),
    count('aeo_entries'),
    count('announcements'),
  ]);

  const stats = [
    { label: 'Total users', value: users.toLocaleString(), tone: 'violet' },
    { label: 'Admin accounts', value: admins.toLocaleString(), tone: 'orange' },
    { label: 'Campaigns', value: campaigns.toLocaleString(), tone: 'green' },
    { label: 'Donations', value: donations.toLocaleString(), tone: 'blue' },
    { label: 'Feature flags', value: flags.toLocaleString(), tone: 'pink' },
    { label: 'SEO routes', value: seo.toLocaleString(), tone: 'violet' },
    { label: 'AEO entries', value: aeo.toLocaleString(), tone: 'green' },
    { label: 'Announcements', value: announcements.toLocaleString(), tone: 'orange' },
  ];

  return (
    <CharitMeShell active="Overview" mode="admin">
      <TopBar title="Super-Admin Console" subtitle="Owner-tier controls · gated to super_admin" />
      <div style={{ padding: '0 4px 40px' }}>
        <div className="kf-metrics" style={{ marginBottom: 24 }}>
          {stats.map((s) => (
            <article key={s.label} className="kf-card kf-metric">
              <div className={`kf-square ${s.tone}`}>
                <span style={{ fontWeight: 800 }}>{s.value.slice(0, 2)}</span>
              </div>
              <div><span>{s.label}</span><strong>{s.value}</strong></div>
            </article>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 14px' }}>Console features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {SUPER_ADMIN_NAV.filter(([label]) => label !== 'Overview').map(([label, href]) => (
            <Link key={href} href={href} className="kf-card" style={{ padding: 20, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'transform .12s' }}>
              <strong style={{ display: 'block', fontSize: 15, marginBottom: 6 }}>{label}</strong>
              <span style={{ color: 'var(--t3)', fontSize: 13 }}>{DESCRIPTIONS[label]}</span>
            </Link>
          ))}
        </div>
      </div>
    </CharitMeShell>
  );
}
