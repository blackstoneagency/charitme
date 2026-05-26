import { requireUser } from '../../lib/auth';
import { isAdmin } from '../../lib/roles';
import { DashboardShell } from '../../components/DashboardShell';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) redirect('/dashboard');
  return (
    <DashboardShell variant="admin" user={{ email: user.email ?? '', name: 'Admin User' }}>
      {children}
    </DashboardShell>
  );
}
