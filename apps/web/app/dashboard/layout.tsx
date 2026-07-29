import { requireUser } from '../../lib/auth';
import { loadShellSession } from '../../lib/shell-session-server';
import { ShellSessionProvider } from '../../components/ShellSessionProvider';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const session = await loadShellSession();
  return <ShellSessionProvider session={session}>{children}</ShellSessionProvider>;
}
