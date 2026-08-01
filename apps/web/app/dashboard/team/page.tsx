import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { TeamClient, type Campaign, type TeamMember, type Profile } from './_components/TeamClient';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchData(userId: string): Promise<{
  campaigns: Campaign[];
  members: TeamMember[];
  profiles: Profile[];
}> {
  try {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id,title')
      .eq('user_id', userId);

    const cids = ((campaigns ?? []) as Campaign[]).map((c) => c.id);
    if (cids.length === 0) {
      return { campaigns: (campaigns ?? []) as Campaign[], members: [], profiles: [] };
    }

    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id,campaign_id,user_id,role,created_at')
      .in('campaign_id', cids)
      .order('created_at', { ascending: false });

    const memberList = (members ?? []) as TeamMember[];
    const memberUserIds = [...new Set(memberList.map((m) => m.user_id))];

    let profiles: Profile[] = [];
    if (memberUserIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name')
        .in('id', memberUserIds);
      profiles = (profileData ?? []) as Profile[];
    }

    return {
      campaigns: (campaigns ?? []) as Campaign[],
      members: memberList,
      profiles,
    };
  } catch {
    return { campaigns: [], members: [], profiles: [] };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function TeamPage() {
  const user = await requireUser();
  const { campaigns, members, profiles } = await fetchData(user.id);

  return (
    <CharitMeShell active="Team">
      <TopBar
        title="Team"
        subtitle="Manage your team members and permissions."
      />
      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className="kf-content-main">
          <TeamClient
            campaigns={campaigns}
            initialMembers={members}
            profiles={profiles}
            currentUserId={user.id}
          />
        </div>
      </div>
    </CharitMeShell>
  );
}
