import { KindFundShell, TopBar, Avatar, KFIcon } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const PAGE_TIME = Date.now();

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Campaign = {
  id: string;
  title: string;
};

type DonorMessage = {
  id: string;
  campaign_id: string;
  donor_id: string;
  message: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  const ms = new Date(iso).getTime();
  const diff = Math.floor((PAGE_TIME - ms) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchData(userId: string): Promise<{
  campaigns: Campaign[];
  messages: DonorMessage[];
  profiles: Profile[];
}> {
  try {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id,title')
      .eq('user_id', userId);

    const cids = ((campaigns ?? []) as Campaign[]).map((c) => c.id);
    if (cids.length === 0) {
      return { campaigns: [], messages: [], profiles: [] };
    }

    const { data: messages } = await supabaseAdmin
      .from('donor_messages')
      .select('id,campaign_id,donor_id,message,created_at')
      .in('campaign_id', cids)
      .order('created_at', { ascending: false })
      .limit(100);

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

    return {
      campaigns: (campaigns ?? []) as Campaign[],
      messages: msgs,
      profiles,
    };
  } catch {
    return { campaigns: [], messages: [], profiles: [] };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function MessagesPage() {
  const user = await requireUser();
  const { campaigns, messages, profiles } = await fetchData(user.id);

  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? 'Anonymous']));
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.title]));

  // Group messages by donor_id — most recent message per donor first
  const threadMap = new Map<string, DonorMessage[]>();
  for (const msg of messages) {
    const existing = threadMap.get(msg.donor_id) ?? [];
    existing.push(msg);
    threadMap.set(msg.donor_id, existing);
  }
  const threads = [...threadMap.entries()].sort((a, b) => {
    const aTime = new Date(a[1][0].created_at).getTime();
    const bTime = new Date(b[1][0].created_at).getTime();
    return bTime - aTime;
  });

  const firstThread = threads[0];
  const activeDonorId = firstThread?.[0];
  const activeMessages = firstThread?.[1] ?? [];

  // Campaigns the active donor contributed to
  const activeDonorCampaigns = activeDonorId
    ? [...new Set(messages.filter((m) => m.donor_id === activeDonorId).map((m) => m.campaign_id))]
    : [];

  const activeDonorName = activeDonorId ? (profileMap.get(activeDonorId) ?? 'Anonymous') : '';

  if (messages.length === 0) {
    return (
      <KindFundShell active="Messages">
        <TopBar title="Messages" subtitle="Communicate with your supporters." />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            textAlign: 'center',
            color: 'var(--t3)',
          }}
        >
          <KFIcon name="chat" />
          <p
            style={{
              marginTop: 16,
              fontWeight: 600,
              fontSize: 16,
              color: 'var(--t2)',
            }}
          >
            No messages yet
          </p>
          <p style={{ fontSize: 14, marginTop: 8, maxWidth: 420 }}>
            When donors leave messages with their donations, they&apos;ll appear here.
          </p>
        </div>
      </KindFundShell>
    );
  }

  return (
    <KindFundShell active="Messages">
      <TopBar title="Messages" subtitle="Communicate with your supporters." />
      <div className="kf-messages">
        {/* ── Left: conversation list ── */}
        <section className="kf-card kf-inbox">
          <div className="kf-tabs">
            <button className="active">Inbox ({threads.length})</button>
            <button>Unread</button>
            <button>Archived</button>
          </div>
          <label className="kf-search">
            <KFIcon name="search" />
            <input placeholder="Search conversations..." />
          </label>
          {threads.map(([donorId, donorMessages], i) => {
            const name = profileMap.get(donorId) ?? 'Anonymous';
            const latest = donorMessages[0];
            return (
              <article key={donorId} className={i === 0 ? 'active' : ''}>
                <Avatar name={name} />
                <div>
                  <strong>{name}</strong>
                  <p
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 180,
                      fontSize: 13,
                      color: 'var(--t3)',
                    }}
                  >
                    {latest.message}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                  {fmtDate(latest.created_at)}
                </span>
              </article>
            );
          })}
        </section>

        {/* ── Middle: message thread ── */}
        <section className="kf-card kf-thread">
          {activeDonorId && (
            <>
              <div className="kf-thread-head">
                <Avatar name={activeDonorName} />
                <div>
                  <h2>
                    {activeDonorName} <span>Donor</span>
                  </h2>
                  <p>
                    {activeDonorCampaigns.length === 1
                      ? campaignMap.get(activeDonorCampaigns[0]) ?? 'Unknown campaign'
                      : `${activeDonorCampaigns.length} campaigns`}
                  </p>
                </div>
              </div>
              {activeMessages.map((msg) => (
                <div key={msg.id} className="kf-bubble left">
                  <Avatar name={activeDonorName} />
                  <p>
                    {msg.message}
                    <small>{fmtDate(msg.created_at)}</small>
                  </p>
                </div>
              ))}
              <div className="kf-composer">
                <textarea placeholder="Type your reply..." />
                <button>
                  <KFIcon name="send" /> Send
                </button>
              </div>
            </>
          )}
        </section>

        {/* ── Right: donor info panel ── */}
        <aside className="kf-side-panels">
          <section className="kf-card">
            <h2 style={{ fontSize: 15, fontWeight: 700, padding: '16px 20px 8px' }}>
              Donor Info
            </h2>
            {activeDonorId ? (
              <>
                <div
                  style={{
                    padding: '8px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={activeDonorName} />
                    <div>
                      <strong style={{ fontSize: 14 }}>{activeDonorName}</strong>
                      <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>Supporter</p>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--t2)',
                      borderTop: '1px solid var(--b1)',
                      paddingTop: 12,
                    }}
                  >
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--t1)' }}>
                      Campaigns
                    </p>
                    {activeDonorCampaigns.map((cid) => (
                      <p
                        key={cid}
                        style={{
                          margin: '0 0 4px',
                          fontSize: 12,
                          color: 'var(--t3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {campaignMap.get(cid) ?? cid}
                      </p>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      borderTop: '1px solid var(--b1)',
                      paddingTop: 12,
                    }}
                  >
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--t1)' }}>
                      Total Messages
                    </p>
                    <p style={{ color: 'var(--t3)', margin: 0 }}>{activeMessages.length}</p>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ padding: '0 20px 16px', fontSize: 13, color: 'var(--t3)' }}>
                Select a conversation to view donor details.
              </p>
            )}
          </section>
        </aside>
      </div>
    </KindFundShell>
  );
}
