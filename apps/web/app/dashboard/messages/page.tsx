import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import MessagesClient, { type Thread, type OwnerReply } from './MessagesClient';

export const dynamic = 'force-dynamic';

const PAGE_TIME = Date.now();
void PAGE_TIME; // suppress unused warning — used for relative time in client

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Campaign = { id: string; title: string };
type DonorMessage = { id: string; campaign_id: string; donor_id: string; message: string; created_at: string };
type Profile = { id: string; full_name: string | null };
type RawReply = { id: string; donor_message_id: string | null; message: string; created_at: string };

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchData(userId: string): Promise<{
  threads: Thread[];
  campaignMap: Record<string, string>;
  replies: Record<string, OwnerReply[]>;
}> {
  try {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id,title')
      .eq('user_id', userId);

    const cids = ((campaigns ?? []) as Campaign[]).map((c) => c.id);
    if (cids.length === 0) return { threads: [], campaignMap: {}, replies: {} };

    const [{ data: messages }, { data: replyData }] = await Promise.all([
      supabaseAdmin
        .from('donor_messages')
        .select('id,campaign_id,donor_id,message,created_at')
        .in('campaign_id', cids)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('campaign_owner_replies')
        .select('id,donor_message_id,message,created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true }),
    ]);

    const msgs = (messages ?? []) as DonorMessage[];
    const uniqueDonorIds = [...new Set(msgs.map((m) => m.donor_id))];

    let profiles: Profile[] = [];
    if (uniqueDonorIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('id,full_name')
        .in('id', uniqueDonorIds);
      profiles = (profileData ?? []) as Profile[];
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? 'Anonymous']));
    const campaignMap: Record<string, string> = Object.fromEntries(
      ((campaigns ?? []) as Campaign[]).map((c) => [c.id, c.title]),
    );

    // Group messages into threads by donor_id
    const threadMap = new Map<string, DonorMessage[]>();
    for (const msg of msgs) {
      const existing = threadMap.get(msg.donor_id) ?? [];
      existing.push(msg);
      threadMap.set(msg.donor_id, existing);
    }

    // Build Thread objects (sorted by most recent message first)
    const threads: Thread[] = [...threadMap.entries()]
      .sort((a, b) => {
        const aTime = new Date(a[1][0].created_at).getTime();
        const bTime = new Date(b[1][0].created_at).getTime();
        return bTime - aTime;
      })
      .map(([donorId, donorMessages]) => ({
        donorId,
        donorName: profileMap.get(donorId) ?? 'Anonymous',
        messages: donorMessages.map(m => ({
          id: m.id,
          campaign_id: m.campaign_id,
          message: m.message,
          created_at: m.created_at,
        })),
        campaignIds: [...new Set(donorMessages.map(m => m.campaign_id))],
      }));

    // Group owner replies by donor_message_id
    const replies: Record<string, OwnerReply[]> = {};
    for (const r of (replyData ?? []) as RawReply[]) {
      if (!r.donor_message_id) continue;
      const bucket = replies[r.donor_message_id] ?? [];
      bucket.push({ id: r.id, message: r.message, created_at: r.created_at });
      replies[r.donor_message_id] = bucket;
    }

    return { threads, campaignMap, replies };
  } catch {
    return { threads: [], campaignMap: {}, replies: {} };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function MessagesPage() {
  const user = await requireUser();
  const { threads, campaignMap, replies } = await fetchData(user.id);

  return (
    <KindFundShell active="Messages">
      <TopBar title="Messages" subtitle="Communicate with your supporters." />
      <MessagesClient threads={threads} campaignMap={campaignMap} replies={replies} />
    </KindFundShell>
  );
}
