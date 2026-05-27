import 'server-only';
import { PageScaffold, type Metric, type TableRow } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

type UpdateRow = {
  id: string;
  title: string | null;
  body: string;
  ai_generated: boolean;
  created_at: string;
};

type LedgerRow = {
  id: string;
  item_type: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
};

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminContentPage() {
  await requireAdmin();

  const [
    { data: updates, count: updateCount },
    { count: aiUpdateCount },
    { data: ledger, count: ledgerCount },
    { count: messageCount },
    { count: publicPostCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('campaign_updates')
      .select('id,title,body,ai_generated,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('campaign_updates')
      .select('id', { count: 'exact', head: true })
      .eq('ai_generated', true),
    supabaseAdmin
      .from('transparency_ledger_items')
      .select('id,item_type,title,category,status,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin.from('donor_messages').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('exclusive_posts').select('id', { count: 'exact', head: true }).eq('visibility', 'public'),
  ]);

  const updateRows: TableRow[] = ((updates ?? []) as UpdateRow[]).map((item) => ({
    title: item.title ?? item.body.slice(0, 58),
    subtitle: item.body.slice(0, 96),
    status: item.ai_generated ? 'AI Generated' : 'Published',
    amount: dateLabel(item.created_at),
    meta: ['Campaign update'],
  }));

  const ledgerRows: TableRow[] = ((ledger ?? []) as LedgerRow[]).map((item) => ({
    title: item.title,
    subtitle: `${item.category} transparency item`,
    status: item.status,
    amount: item.item_type.replace(/_/g, ' '),
    meta: [dateLabel(item.created_at)],
  }));

  const rows = [...updateRows, ...ledgerRows].slice(0, 10);
  const metrics: Metric[] = [
    { label: 'Campaign Updates', value: (updateCount ?? 0).toLocaleString(), change: 'from campaign_updates', icon: 'doc', tone: 'violet' },
    { label: 'AI Content', value: (aiUpdateCount ?? 0).toLocaleString(), change: 'generated updates', icon: 'send', tone: 'blue' },
    { label: 'Ledger Items', value: (ledgerCount ?? 0).toLocaleString(), change: 'transparency records', icon: 'stack', tone: 'green' },
    { label: 'Messages', value: ((messageCount ?? 0) + (publicPostCount ?? 0)).toLocaleString(), change: 'donor and public posts', icon: 'chat', tone: 'orange' },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Content"
      title="Content"
      subtitle="Campaign updates, transparency records, donor messages, and public posts from Supabase."
      metrics={metrics}
      rows={rows}
      tabs={['All Content', 'Updates', 'Ledger', 'Messages']}
    />
  );
}
