import 'server-only';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import ContentClient, { type ContentRecord } from './_components/ContentClient';

export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  await requireAdmin();

  type UpdateRow = {
    id: string;
    title: string | null;
    body: string;
    ai_generated: boolean;
    campaign_id: string;
    created_at: string;
    updated_at: string | null;
  };

  const { data: updates, count: totalCount } = await supabaseAdmin
    .from('campaign_updates')
    .select('id,title,body,ai_generated,campaign_id,created_at,updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  const updateList = (updates ?? []) as UpdateRow[];

  // Resolve campaign titles
  const campaignIds = [...new Set(updateList.map(u => u.campaign_id).filter(Boolean))];
  const campaignMap = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns').select('id,title,user_id').in('id', campaignIds);
    for (const c of (campaigns ?? []) as { id: string; title: string; user_id: string }[]) {
      campaignMap.set(c.id, c.title);
    }
  }

  // Build content records
  const content: ContentRecord[] = updateList.map(u => ({
    id: u.id,
    title: u.title ?? u.body.slice(0, 60),
    body: u.body,
    type: u.ai_generated ? 'AI Generated' : 'Campaign Update',
    status: 'Published',
    author: 'Organizer',
    campaign_title: campaignMap.get(u.campaign_id) ?? 'Unknown Campaign',
    created_at: u.created_at,
    updated_at: u.updated_at ?? u.created_at,
  }));

  // Content by type
  const typeMap = new Map<string, number>();
  for (const c of content) {
    typeMap.set(c.type, (typeMap.get(c.type) ?? 0) + 1);
  }
  const contentByType = [...typeMap.entries()].map(([type, count]) => ({ type, count }));

  const totalContent = totalCount ?? 0;
  const publishedCount = content.length; // all are "published" in this schema
  const draftCount = 0;
  const archivedCount = 0;
  const aiGeneratedCount = content.filter(c => c.type === 'AI Generated').length;

  return (
    <KindFundShell active="Content" mode="admin">
      <TopBar
        title="Content"
        subtitle="Campaign updates, posts, and content from Supabase."
        actions={
          <button className="kf-primary" style={{ height: 44, padding: '0 20px', fontSize: 13, fontWeight: 900 }}>
            + Create Content
          </button>
        }
      />
      <ContentClient
        totalContent={totalContent}
        publishedCount={publishedCount}
        draftCount={draftCount}
        archivedCount={archivedCount}
        aiGeneratedCount={aiGeneratedCount}
        contentByType={contentByType}
        content={content}
      />
    </KindFundShell>
  );
}
