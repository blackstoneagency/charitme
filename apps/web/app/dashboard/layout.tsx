import { requireUser } from '../../lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
