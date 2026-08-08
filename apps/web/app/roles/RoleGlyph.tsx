import type { UserRole } from '../../lib/roles-shared';

/**
 * The circular role marks from the reference.
 *
 * The design draws a crown, shield, pencil, person and eye for its five roles.
 * This product has six DIFFERENT roles, so the glyphs are matched to what each
 * role actually is here rather than copied position-for-position — a shield on
 * "Donor" would be decoration that means nothing.
 *
 * `aria-hidden` throughout: every card already states its role name in a heading
 * directly beneath the mark, so announcing the icon would only repeat it.
 */
const PATHS: Record<UserRole, React.ReactNode> = {
  // Heart — giving.
  donor: <path d="M12 20.5 4.2 13a5 5 0 0 1 7.1-7l.7.7.7-.7a5 5 0 1 1 7.1 7Z" />,
  // Megaphone — running a fundraiser.
  organizer: <><path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15 8a5 5 0 0 1 0 8" /><path d="M18 5a9 9 0 0 1 0 14" /></>,
  // Hand receiving — the person the money is for.
  beneficiary: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12" /><path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0" /></>,
  // Building — an organization.
  nonprofit: <><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M10 21v-6h4v6" /></>,
  // Shield — staff access.
  admin: <path d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6Z" />,
  // Shield with a key line — the highest privilege.
  super_admin: <><path d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6Z" /><path d="M12 10.5v3" /><circle cx="12" cy="9" r="1.4" /></>,
};

export default function RoleGlyph({ role }: { role: UserRole }) {
  return (
    <svg
      viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
    >
      {PATHS[role]}
    </svg>
  );
}
