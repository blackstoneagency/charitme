import 'server-only';
import { CharitMeShell, TopBar, MetricGrid, type Metric } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import AdminCampaignsClient, { type AdminCampaign } from './_components/AdminCampaignsClient';

export const dynamic = 'force-dynamic';

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

export default async function AdminCampaignsPage() {
  await requireAdmin();

  const [
    campaignsResult,
    activeResult,
    draftResult,
    attentionResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select(
        // image_urls and video_url are added via ALTER TABLE — may not exist in older DBs.
        // They default to [] and null in the mapping below if missing.
        'id, slug, title, tagline, description, status, raised_amount, goal_amount, backer_count, category, user_id, trust_status, campaign_health_score, payout_frozen, featured, pinned, cover_image_url, image_urls, video_url, deadline, beneficiary_name, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).in('status', ['paused', 'frozen', 'rejected']),
  ]);

  // If query failed due to missing new columns (image_urls / video_url),
  // retry without those columns so the page still works on older schemas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let campaignsResult2: any = campaignsResult;
  if (campaignsResult.error) {
    const { code, message } = campaignsResult.error;
    const isMissingCol = code === '42703' || (message ?? '').includes('image_urls') || (message ?? '').includes('video_url');
    if (isMissingCol) {
      campaignsResult2 = await supabaseAdmin
        .from('campaigns')
        .select('id, slug, title, tagline, description, status, raised_amount, goal_amount, backer_count, category, user_id, trust_status, campaign_health_score, payout_frozen, featured, pinned, cover_image_url, deadline, beneficiary_name, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(200);
    }
  }

  // Surface DB errors clearly in the admin UI
  const dbError = campaignsResult2.error;
  const { data: campaigns, count: totalCount } = campaignsResult2;
  const { count: activeCount } = activeResult;
  const { count: draftCount } = draftResult;
  const { count: attentionCount } = attentionResult;

  if (dbError) {
    return (
      <CharitMeShell active="Campaigns" mode="admin">
        <TopBar title="Campaigns" subtitle="Database error" actions={<></>} />
        <div style={{ padding: '32px', maxWidth: 700 }}>
          <div style={{ padding: '20px 24px', background: '#fff0f3', border: '1.5px solid #fecdd3', borderRadius: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#be123c', margin: '0 0 8px' }}>
              ❌ Supabase Query Error
            </h2>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#be123c', margin: '0 0 12px', lineHeight: 1.6 }}>
              {dbError.code}: {dbError.message}
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
              <strong>Likely causes:</strong>
              <br />1. <code>SUPABASE_SERVICE_ROLE_KEY</code> is not set in Vercel environment variables
              <br />2. The database schema has not been applied — run <code>schema.sql</code> in the Supabase SQL Editor
              <br />3. The &ldquo;campaigns&rdquo; table does not exist — verify in Supabase → Table Editor
            </p>
            <a href="/api/health" target="_blank" style={{ display: 'inline-block', marginTop: 16, padding: '8px 20px', background: '#6c35ff', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Run Diagnostic → /api/health
            </a>
          </div>
        </div>
      </CharitMeShell>
    );
  }

  type CampaignRow = {
    id: string;
    slug: string;
    title: string;
    tagline: string | null;
    description: string | null;
    status: string;
    raised_amount: number | null;
    goal_amount: number | null;
    backer_count: number | null;
    category: string | null;
    user_id: string;
    trust_status: string | null;
    campaign_health_score: number | null;
    payout_frozen: boolean | null;
    featured: boolean | null;
    pinned: boolean | null;
    cover_image_url: string | null;
    image_urls: string[] | null;
    video_url: string | null;
    deadline: string | null;
    beneficiary_name: string | null;
    created_at: string;
  };

  const campaignList = (campaigns ?? []) as CampaignRow[];
  const organizerIds = [...new Set(campaignList.map(c => c.user_id))];
  const profileMap = new Map<string, string>();

  if (organizerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', organizerIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      profileMap.set(p.id, p.full_name || p.email || 'Unknown Organizer');
    }
  }

  const adminCampaigns: AdminCampaign[] = campaignList.map(c => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline ?? '',
    description: c.description ?? '',
    status: c.status,
    trustStatus: c.trust_status ?? 'Needs More Info',
    payoutFrozen: Boolean(c.payout_frozen),
    featured: Boolean(c.featured),
    pinned: Boolean(c.pinned),
    healthScore: c.campaign_health_score ?? 0,
    raisedAmount: c.raised_amount ?? 0,
    goalAmount: c.goal_amount ?? 0,
    backerCount: c.backer_count ?? 0,
    category: c.category ? capitalize(c.category) : 'Uncategorized',
    organizer: profileMap.get(c.user_id) ?? 'Unknown Organizer',
    organizerId: c.user_id,
    coverImageUrl: c.cover_image_url ?? null,
    imageUrls: (c.image_urls as string[] | null) ?? [],
    videoUrl: (c.video_url as string | null) ?? null,
    deadline: c.deadline ?? null,
    beneficiaryName: c.beneficiary_name ?? null,
    createdAt: c.created_at,
  }));

  const metrics: Metric[] = [
    { label: 'All Campaigns', value: (totalCount ?? 0).toLocaleString(), change: 'all statuses', icon: 'stack', tone: 'violet' },
    { label: 'Active', value: (activeCount ?? 0).toLocaleString(), change: 'live right now', icon: 'check', tone: 'green' },
    { label: 'Needs Attention', value: (attentionCount ?? 0).toLocaleString(), change: 'paused, frozen, rejected', icon: 'audit', tone: 'orange' },
    { label: 'Drafts', value: (draftCount ?? 0).toLocaleString(), change: 'not yet published', icon: 'doc', tone: 'blue' },
  ];

  return (
    <CharitMeShell active="Campaigns" mode="admin">
      <TopBar
        title="Campaigns"
        subtitle="Create, review, approve, manage and track campaigns from start to finish."
        actions={<></>}
      />
      <div style={{ padding: '0 32px 20px' }}>
        <MetricGrid metrics={metrics} />
      </div>
      <AdminCampaignsClient campaigns={adminCampaigns} />
    </CharitMeShell>
  );
}
