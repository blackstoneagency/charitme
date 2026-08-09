import { loadShellSession } from '../../lib/shell-session-server';
import { ShellSessionProvider } from '../../components/ShellSessionProvider';

/**
 * Session CONTEXT for the donor portal. No chrome of its own — the visual shell
 * is rendered by each page, exactly as it is under /dashboard.
 *
 * ⚠️ Deliberately does NOT call `requireUser()`, which is the one place this
 * differs from `app/dashboard/layout.tsx`, and the difference is load-bearing.
 * `requireUser()` redirects to a bare `/login`, while every page under here
 * redirects to `/login?next=<where they were going>` on purpose — a donor
 * following an emailed receipt link would otherwise sign in and land on a
 * generic dashboard, having lost the document they came for. A layout guard
 * runs BEFORE the page, so adding one here would silently win over the more
 * careful redirect underneath it.
 *
 * Nothing is loosened: `/donor` redirects, the receipt page calls
 * `requireUser()` itself, and the tax statement redirects with its own `next`.
 * `loadShellSession()` returns a signed-out session rather than throwing, so it
 * is safe to run before any of those checks.
 */
export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const session = await loadShellSession();
  return <ShellSessionProvider session={session}>{children}</ShellSessionProvider>;
}
