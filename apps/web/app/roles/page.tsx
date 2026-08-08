import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE } from '../../lib/public-routes';
import Link from 'next/link';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../lib/role-capabilities';
import RoleGlyph from './RoleGlyph';

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

  return (
    <article className="rl-card" data-role={role}>
      <span className="rl-mark" aria-hidden="true">
        <RoleGlyph role={role} />
      </span>

      {def.isDefault && <span className="rl-default">Default</span>}

      <h3 className="rl-name">{def.label}</h3>
      <p className="rl-desc">{def.description}</p>

      <p className="rl-perms-title">Permissions include:</p>
      <ul className="rl-perms">
        {def.capabilities.map((cap) => (
          <li key={cap.label}>
            <span className="rl-tick" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5 6.5 12 13 4.5" />
              </svg>
            </span>
            <span>{cap.label}</span>
            {/* The reference's ticks all look alike, which would say every line
                is equally a rule. Here only some are: `enforced` records where
                code genuinely denies access, and the rest are descriptions of
                what the role MEANS. Marking the difference is the whole reason
                lib/role-capabilities.ts keeps the two apart. */}
            {cap.enforced && <span className="rl-enforced" title={cap.enforcedBy}>enforced</span>}
          </li>
        ))}
      </ul>

      {/* The reference closes each card with a member count. There is no honest
          one to show: this is a PUBLIC page, and per-role member counts are
          neither available without auth nor something to publish. What is true
          and useful in that slot is whether the role gates anything at all. */}
      <p className="rl-foot">
        {def.privileged ? 'Assigned by CharitMe' : 'Open to every account'}
      </p>
    </article>
  );
}

export default function RolesPage() {
  const openRoles = ROLE_ORDER.filter((r) => !ROLE_DEFINITIONS[r].privileged);
  const staffRoles = ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].privileged);

  return (
    <div className="pub-page simple-public rl-page">
      <header className="rl-head">
        <div>
          <h1 className="rl-title">Account roles</h1>
          <p className="rl-sub">What each role means, and which ones actually change your access.</p>
        </div>
        {/* The reference puts an "Invite Member" button here. There is no team
            invitation to send from a public explainer page — that control lives
            on a campaign, where /api/team-members scopes an invite to one
            campaign. A button here would be a fake affordance, so the slot
            carries the real thing a reader wants next: their own roles. */}
        <Link href="/profile" className="rl-action">See your roles</Link>
      </header>

      <p className="rl-lede">
        A role describes <em>how you use CharitMe</em> — it is not a permission you have to
        apply for. <strong>Every account can donate to campaigns and start its own fundraiser
        from the moment it is created.</strong> You never need to request a role to raise money.
      </p>

      <section className="rl-section" aria-labelledby="rl-open">
        <h2 id="rl-open" className="rl-h2">Roles anyone can hold</h2>
        <p className="rl-section-sub">
          These describe what you are doing on CharitMe. They do not unlock or restrict anything.
        </p>
        <div className="rl-grid">
          {openRoles.map((role) => <RoleCard key={role} role={role} />)}
        </div>
      </section>

      <section className="rl-section" aria-labelledby="rl-staff">
        <h2 id="rl-staff" className="rl-h2">Staff roles</h2>
        <p className="rl-section-sub">
          Assigned by CharitMe, and the only roles that genuinely restrict what you can open.
          They cannot be requested.
        </p>
        <div className="rl-grid">
          {staffRoles.map((role) => <RoleCard key={role} role={role} />)}
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
