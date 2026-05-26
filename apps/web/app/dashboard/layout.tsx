import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { DashboardShell } from '../../components/DashboardShell';

async function getName(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    return data?.full_name ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const name = await getName(user.id);
  return (
    <DashboardShell variant="dashboard" user={{ email: user.email ?? '', name }}>
      {children}
    </DashboardShell>
  );
}
