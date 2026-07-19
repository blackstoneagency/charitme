import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import PrivacyClient, { type PrivacyRequestView } from './PrivacyClient';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const user = await requireUser();

  const { data } = await supabaseAdmin
    .from('privacy_requests')
    .select('id, request_type, status, details, resolution_note, requested_at, resolved_at')
    .eq('user_id', user.id)
    .order('requested_at', { ascending: false });

  const requests: PrivacyRequestView[] = (data ?? []).map((r) => ({
    id: r.id,
    requestType: r.request_type,
    status: r.status,
    details: r.details,
    resolutionNote: r.resolution_note,
    requestedAt: r.requested_at as string,
  }));

  return (
    <CharitMeShell active="Privacy">
      <TopBar title="Privacy & your data" subtitle="Request a copy of your data or ask us to delete your account. We track every request." />
      <div className="kf-admin-dash">
        <PrivacyClient initialRequests={requests} />
      </div>
    </CharitMeShell>
  );
}
