import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE } from '../../lib/public-routes';
import Link from 'next/link';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../lib/role-capabilities';

export const metadata: Metadata = {
  title: 'Account Roles — What Each One Means | CharitMe',
  description:
    'Every CharitMe account can donate and create campaigns. Roles describe how you use CharitMe; only Admin and Super Admin change what you can access.',
  alternates: { canonical: 'https://www.charitme.com/roles' },
  openGraph: {
    images: [{ url: DEFAULT_OG_IMAGE }],
    title: 'Account Roles — What Each One Means | CharitMe',
    description:
      'Donor, Organizer, Beneficiary, Nonprofit, Admin, Super Admin — what each role means, in plain language.',
    url: 'https://www.charitme.com/roles',
    type: 'website',
  },
};

// This page renders lib/role-capabilities.ts directly rather than restating it.
// A hand-written copy of the role list is exactly how the CAMPAIGN_CATEGORIES
// copies drifted, and a role page that disagrees with the admin console is worse
// than no role page at all.
//
// The honest framing matters here and is not decoration. Of the six roles only
// `admin` and `super_admin` gate anything; the other four are descriptive. So a
// card that said "Organizer — create campaigns" would read as a REQUIREMENT and
// send a signed-in user hunting for a role they do not need in order to fundraise.
// Every non-privileged role is therefore labelled "Open to every account", and the
// intro says outright that nobody has to request anything to start.

function RoleCard({ role }: { role: (typeof ROLE_ORDER)[number] }) {
  const def = ROLE_DEFINITIONS[role];
  const restricted = def.privileged;

  return (
    <article
      className="kf-card"
      style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <header style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{def.label}</h3>
        {def.isDefault && (
          <span
            style={{
              fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: 'var(--green-light)', color: 'var(--green-dark)',
            }}
          >
            Default
          </span>
        )}
        <span
          style={{
            fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
            marginLeft: 'auto', whiteSpace: 'nowrap',
            background: restricted ? 'var(--s3)' : 'var(--s2)',
            color: restricted ? 'var(--t1)' : 'var(--t3)',
            border: '1px solid var(--b2)',
          }}
        >
          {restricted ? 'Restricted access' : 'Open to every account'}
        </span>
      </header>

      <p style={{ margin: 0, color: 'var(--t2)', fontSize: 14.5, lineHeight: 1.6 }}>
        {def.description}
      </p>

      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
        {def.capabilities.map((cap) => (
          <li key={cap.label} style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.55 }}>
            {cap.label}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function RolesPage() {
  const openRoles = ROLE_ORDER.filter((r) => !ROLE_DEFINITIONS[r].privileged);
  const staffRoles = ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].privileged);

  return (
    <div className="pub-page simple-public">
      <section>
        <div className="pub-breadcrumb">
          Home <span>&gt;</span> <b>Account Roles</b>
        </div>
        <h1>Account roles</h1>
        <p>
          A role describes <em>how you use CharitMe</em> — it is not a permission you have to apply
          for. <strong>Every account can donate to campaigns and start its own fundraiser from the
          moment it is created.</strong> You never need to request a role to raise money.
        </p>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>
          Only the two staff roles at the bottom of this page change what you can open. Everything
          else on this page is a description, not a gate.
        </p>
      </section>

      <section style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Roles anyone can hold</h2>
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 16px' }}>
          These describe what you are doing on CharitMe. They do not unlock or restrict anything.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))',
            gap: 16,
          }}
        >
          {openRoles.map((role) => (
            <RoleCard key={role} role={role} />
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Staff roles</h2>
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 16px' }}>
          These are assigned by CharitMe and genuinely restrict access. They cannot be requested.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))',
            gap: 16,
          }}
        >
          {staffRoles.map((role) => (
            <RoleCard key={role} role={role} />
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
          Tax-deductible giving is per campaign, not per role
        </h2>
        <p>
          Holding the <strong>Nonprofit</strong> role does not by itself make donations to your
          campaigns tax-deductible. Deductibility comes from verifying an individual campaign, so a
          verified organization can still run a campaign that is not deductible. Look for the
          verified badge on the campaign itself, and see the{' '}
          <Link href="/transparency">Transparency Center</Link> for exactly where each donation goes.
        </p>
        <p style={{ marginTop: 20, fontSize: 14, color: 'var(--t3)' }}>
          You can see the roles on your own account on your{' '}
          <Link href="/profile">profile page</Link>. Questions about a role assignment go to{' '}
          <Link href="/contact">our support team</Link>.
        </p>
      </section>
    </div>
  );
}
