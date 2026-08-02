import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { ownedNonprofitIds } from '../../../lib/giving-days-server';
import { listSegments, loadContacts } from '../../../lib/donor-segments-server';
import SegmentsClient from './SegmentsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Donor Segments | CharitMe' };

// Management surface for `donor_segments` / `donor_segment_members` — two more
// tables that shipped with RLS and foreign keys and no code on either side.
//
// Scoped by the caller's OWN nonprofit profiles, because these reads go through
// the service-role client and `donor_segments_owner_private` does not run.

export default async function DashboardSegmentsPage() {
  const user = await requireUser();
  const owned = await ownedNonprofitIds(user.id);

  const [nonprofitRows, segments, contacts] = await Promise.all([
    owned.length === 0
      ? Promise.resolve({ data: [] as { id: string; name: string }[] })
      : supabaseAdmin.from('nonprofit_profiles').select('id, name').in('id', owned).order('name'),
    listSegments(owned),
    loadContacts(owned),
  ]);

  return (
    <CharitMeShell active="Donor Segments">
      <TopBar
        title="Donor Segments"
        subtitle="Saved rules over your contacts — who to email, and why."
      />
      <div style={{ padding: '0 32px 40px' }}>
        <SegmentsClient
          nonprofits={((nonprofitRows.data ?? []) as { id: string; name: string }[]).map((n) => ({ id: n.id, name: n.name }))}
          initialSegments={(segments ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            rules: s.rules,
            memberCount: s.memberCount,
            createdAt: s.createdAt,
          }))}
          // A failed read is not an empty list, and must not render as one.
          loadFailed={segments === null}
          contactCount={contacts.length}
        />
      </div>
    </CharitMeShell>
  );
}
