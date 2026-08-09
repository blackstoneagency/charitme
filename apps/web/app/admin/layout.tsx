import type { ReactNode } from 'react';
// Admin-only styles. Kept OUT of globals.css so the ~19KB of .admin-*/.users-*
// rules is not downloaded by every anonymous visitor on every public route —
// measured coverage on the public pages was 2-6% of the global sheet.
import './admin.css';
import { requireUser } from '../../lib/auth';
import { isAdmin } from '../../lib/roles';
import { redirect } from 'next/navigation';
import { loadShellSession } from '../../lib/shell-session-server';
import { ShellSessionProvider } from '../../components/ShellSessionProvider';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) redirect('/dashboard');
  const session = await loadShellSession();
  return <ShellSessionProvider session={session}>{children}</ShellSessionProvider>;
}
