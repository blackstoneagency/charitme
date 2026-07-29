import type { ReactNode } from 'react';
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
