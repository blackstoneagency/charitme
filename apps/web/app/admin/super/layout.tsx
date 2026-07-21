import type { ReactNode } from 'react';
import { requireSuperAdmin } from '../../../lib/auth';

// Gates the entire Super-Admin Console to super-admins. Non-super admins are
// redirected to /admin by requireSuperAdmin.
export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();
  return <>{children}</>;
}
