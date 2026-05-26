import Link from 'next/link';
import { KindFundShell, TopBar, KFIcon } from '../../../components/KindFundApp';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Profile = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchProfile(userId: string): Promise<Profile> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name,bio,avatar_url')
      .eq('id', userId)
      .single();
    if (!data) return { full_name: null, bio: null, avatar_url: null };
    return data as Profile;
  } catch {
    return { full_name: null, bio: null, avatar_url: null };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await fetchProfile(user.id);

  const displayName = profile.full_name ?? user.email ?? 'User';
  const userEmail = user.email ?? '';
  const userInitials = initials(profile.full_name, userEmail);

  const navSections = [
    { label: 'Profile', icon: 'users' },
    { label: 'Organization', icon: 'stack' },
    { label: 'Notifications', icon: 'bell' },
    { label: 'Security', icon: 'audit' },
    { label: 'Plan & Billing', icon: 'crown' },
  ];

  return (
    <KindFundShell active="Settings">
      <TopBar title="Settings" subtitle="Manage your account and preferences." />
      <div className="kf-content-grid">
        <main className="kf-settings-layout">
          {/* ── Sidebar nav ── */}
          <nav className="kf-settings-nav">
            {navSections.map((s, i) => (
              <a
                key={s.label}
                href={`#${s.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={i === 0 ? 'active' : ''}
              >
                <KFIcon name={s.icon} />
                {s.label}
              </a>
            ))}
          </nav>

          {/* ── Panels ── */}
          <div className="kf-content-main" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Profile */}
            <section
              id="profile"
              className="kf-card kf-form-card"
            >
              <div className="kf-card-head">
                <div>
                  <h2>Profile</h2>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: '2px 0 0' }}>
                    Your public profile information.
                  </p>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Avatar row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--b2)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'var(--green)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {userInitials}
                    </div>
                  )}
                  <div>
                    <strong style={{ fontSize: 15 }}>{displayName}</strong>
                    <p style={{ fontSize: 13, color: 'var(--t3)', margin: '2px 0 0' }}>{userEmail}</p>
                  </div>
                </div>

                {/* Read-only fields */}
                <div style={{ display: 'grid', gap: 12 }}>
                  <FieldRow label="Full Name" value={profile.full_name ?? '—'} />
                  <FieldRow label="Email Address" value={userEmail} />
                  <FieldRow label="Bio" value={profile.bio ?? '—'} />
                </div>
              </div>
            </section>

            {/* Organization */}
            <section
              id="organization"
              className="kf-card kf-form-card"
            >
              <div className="kf-card-head">
                <div>
                  <h2>Organization</h2>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: '2px 0 0' }}>
                    Details about your fundraising organization.
                  </p>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px', display: 'grid', gap: 12 }}>
                <FieldRow label="Organization Name" value="—" />
                <FieldRow label="Website" value="—" />
                <FieldRow label="Country" value="United States" />
                <FieldRow label="Time Zone" value="UTC−5 (Eastern Time)" />
              </div>
            </section>

            {/* Notifications */}
            <section
              id="notifications"
              className="kf-card kf-form-card"
            >
              <div className="kf-card-head">
                <div>
                  <h2>Notifications</h2>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: '2px 0 0' }}>
                    Control which emails and alerts you receive.
                  </p>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: 'New donation received', on: true },
                  { label: 'Donor leaves a message', on: true },
                  { label: 'Campaign milestone reached', on: true },
                  { label: 'Weekly performance digest', on: false },
                  { label: 'Product updates & announcements', on: false },
                ].map(({ label, on }) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      borderBottom: '1px solid var(--b1)',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: 'var(--t1)' }}>{label}</span>
                    <span
                      className={`kf-pill ${on ? 'green' : 'orange'}`}
                      style={{ fontSize: 11 }}
                    >
                      {on ? 'On' : 'Off'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Security */}
            <section
              id="security"
              className="kf-card kf-form-card"
            >
              <div className="kf-card-head">
                <div>
                  <h2>Security</h2>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: '2px 0 0' }}>
                    Manage your password and account access.
                  </p>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--b1)',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14 }}>Password</strong>
                    <p style={{ fontSize: 12, color: 'var(--t3)', margin: '2px 0 0' }}>
                      Update your login password.
                    </p>
                  </div>
                  <Link
                    href="/forgot-password"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--green)',
                      textDecoration: 'none',
                    }}
                  >
                    Change Password
                  </Link>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14 }}>Sign Out</strong>
                    <p style={{ fontSize: 12, color: 'var(--t3)', margin: '2px 0 0' }}>
                      Sign out of your account on this device.
                    </p>
                  </div>
                  <Link
                    href="/api/auth/signout"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--t3)',
                      textDecoration: 'none',
                      border: '1px solid var(--b2)',
                      borderRadius: 'var(--r)',
                      padding: '6px 16px',
                    }}
                  >
                    Sign Out
                  </Link>
                </div>
              </div>
            </section>

            {/* Plan */}
            <section
              id="plan-billing"
              className="kf-card kf-form-card"
            >
              <div className="kf-card-head">
                <div>
                  <h2>Plan &amp; Billing</h2>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: '2px 0 0' }}>
                    Manage your subscription and billing details.
                  </p>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'var(--s3)',
                    borderRadius: 'var(--r)',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <KFIcon name="crown" />
                      <strong style={{ fontSize: 16 }}>Free Plan</strong>
                      <span className="kf-pill violet" style={{ fontSize: 11 }}>
                        Current
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
                      3 campaigns · 5% platform fee · Email support
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--s3), var(--s4))',
                    border: '1px solid var(--b2)',
                    borderRadius: 'var(--r)',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>Upgrade to KindFund Pro</strong>
                    <p style={{ fontSize: 13, color: 'var(--t2)', margin: '4px 0 0' }}>
                      Unlimited campaigns, 2% fee, AI tools, priority support, and more.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    style={{
                      flexShrink: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      background: 'var(--green)',
                      color: '#fff',
                      textDecoration: 'none',
                      borderRadius: 'var(--r)',
                      padding: '10px 20px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Upgrade Now
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </KindFundShell>
  );
}

// ─────────────────────────────────────────────
// Shared sub-component
// ─────────────────────────────────────────────
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--t3)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: 'var(--t1)',
          padding: '8px 12px',
          background: 'var(--s3)',
          borderRadius: 'var(--r)',
          border: '1px solid var(--b1)',
        }}
      >
        {value}
      </span>
    </div>
  );
}
