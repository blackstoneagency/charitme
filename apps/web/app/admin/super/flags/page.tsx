import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import FlagsClient, { type Flag } from './FlagsClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminFlagsPage() {
  await requireSuperAdmin();
  const { data } = await supabaseAdmin.from('feature_flags').select('*').order('key', { ascending: true });
  return (
    <CharitMeShell active="Feature Flags" mode="admin">
      <TopBar title="Feature Flags" subtitle={`${(data ?? []).length} flags · toggle platform capabilities`} />
      <FlagsClient flags={(data ?? []) as Flag[]} />
    </CharitMeShell>
  );
}
