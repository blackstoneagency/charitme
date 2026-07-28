import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { SUPER_ADMIN_NAV } from '../../../lib/super-admin-nav';

export const dynamic = 'force-dynamic';

// `null` means "we could not read this", which is not the same statement as 0.
// This console is where an owner checks whether the platform is alive; reporting
// "Total users 0 / Campaigns 0 / Donations 0" during a database incident reads as
// catastrophic data loss. Note supabase-js RESOLVES on a query error rather than
// throwing, so the error field must be checked — a try/catch alone never sees a
// timeout or a permission failure, it just gets count:null and reports zero.
async function count(table: string): Promise<number | null> {
  try {
    const { count: c, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (error) return null;
    return c ?? 0;
  } catch {
    return null;
  }
}

async function countAdmins(): Promise<number | null> {
  try {
    const { count: c, error } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .contains('roles', ['admin']);
    if (error) return null;
    return c ?? 0;
  } catch {
    return null;
  }
}

const DESCRIPTIONS: Record<string, string> = {
  'Overview': 'Console home and platform health at a glance.',
  'AI': 'AI Control Center — agent roster and one-click context packs.',
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

  const show = (n: number | null) => (n === null ? '—' : n.toLocaleString());
  const counts = [users, admins, campaigns, donations, flags, seo, aeo, announcements];
  const anyFailed = counts.some((n) => n === null);

  const stats = [
    { label: 'Total users', value: show(users), tone: 'violet' },
    { label: 'Admin accounts', value: show(admins), tone: 'orange' },
    { label: 'Campaigns', value: show(campaigns), tone: 'green' },
    { label: 'Donations', value: show(donations), tone: 'blue' },
    { label: 'Feature flags', value: show(flags), tone: 'pink' },
    { label: 'SEO routes', value: show(seo), tone: 'violet' },
    { label: 'AEO entries', value: show(aeo), tone: 'green' },
    { label: 'Announcements', value: show(announcements), tone: 'orange' },
  ];

  return (
    <CharitMeShell active="Overview" mode="admin">
      <TopBar title="Super-Admin Console" subtitle="Owner-tier controls · gated to super_admin" />
      <div style={{ padding: '0 4px 40px' }}>
        {anyFailed && (
          <div
            role="alert"
            style={{
              margin: '0 0 16px', padding: '14px 16px', borderRadius: 12,
              background: 'var(--s2, #fffbeb)', border: '1px solid var(--b2, #fde68a)',
              color: 'var(--t1, #92400e)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>Some counts could not be read</strong>
            <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              Anything showing &ldquo;—&rdquo; failed to load and is unknown — it is not zero.
              Reload to try again.
            </span>
          </div>
        )}
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
