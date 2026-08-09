import { initials, type TeamMember } from '../../lib/about-page';

/**
 * The reference's "Our Team" row.
 *
 * ⚠️ Renders NOTHING until an administrator has entered a roster (the
 * `about.teamRoster` key in `platform_settings.config`, edited in Super Admin →
 * System Settings → About Page). The design shows six named people with
 * photographs and job titles; those are claims about real humans on a real
 * company's About page, so they are not invented to fill a layout. An empty
 * roster omits the section rather than shipping placeholder people.
 *
 * A member without a photo gets monogram initials rather than a broken image —
 * the roster is far more likely to arrive as names and titles first.
 */
export default function AboutTeam({ members }: { members: TeamMember[] }) {
  if (members.length === 0) return null;
  const usesRepresentativePhotography = members.some((member) => member.photo?.includes('images/team/'));

  return (
    <section className="ab-team" aria-labelledby="ab-team-h">
      <h2 id="ab-team-h" className="ab-h2">Our Team</h2>
      {usesRepresentativePhotography && (
        <p className="ab-team-note">Representative photography is shown until verified team portraits are supplied.</p>
      )}
      <ul className="ab-team-grid">
        {members.map((member) => (
          <li key={`${member.name}-${member.title}`} className="ab-team-card">
            <span className="ab-team-media">
              {member.photo ? (
                // Not next/image: these are administrator-entered URLs on
                // arbitrary hosts, which the image optimiser would refuse
                // unless every host were allow-listed in advance.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.photo} alt="" width={160} height={160} loading="lazy" decoding="async" />
              ) : (
                <span className="ab-team-mono" aria-hidden="true">{initials(member.name)}</span>
              )}
            </span>
            <strong>{member.name}</strong>
            <span>{member.title}</span>
            {member.linkedin && (
              // The reference's small "in" control under each face. Rendered only
              // when a real LinkedIn URL was entered — an icon that links nowhere
              // is worse than no icon. `rel` is set because this leaves the site.
              <a
                className="ab-team-in"
                href={member.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                // Named per person: six links all called "LinkedIn" are
                // indistinguishable to a screen-reader user tabbing the row.
                aria-label={`${member.name} on LinkedIn`}
              >
                <span aria-hidden="true">in</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
