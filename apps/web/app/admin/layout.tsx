import type { ReactNode } from 'react';
import { requireUser } from '../../lib/auth';
import { isAdmin } from '../../lib/roles';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) redirect('/dashboard');
  return <>{children}</>;
}
