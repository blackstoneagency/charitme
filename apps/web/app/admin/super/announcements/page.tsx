import { boundedQuery } from '../../../../lib/query-timeout';
import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import AnnouncementsClient, { type Announcement } from './AnnouncementsClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminAnnouncementsPage() {
  await requireSuperAdmin();
  const { data } = await boundedQuery(() => supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false }));
  return (
    <CharitMeShell active="Announcements" mode="admin">
      <TopBar title="Announcements" subtitle="Site-wide banners with scheduling" />
      <AnnouncementsClient rows={(data ?? []) as Announcement[]} />
    </CharitMeShell>
  );
}
