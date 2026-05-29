import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import IntegrationsClient, { type Connection, type CatalogItem } from './IntegrationsClient';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Static catalog
// ─────────────────────────────────────────────
const CATALOG: CatalogItem[] = [
  { name: 'Mailchimp', category: 'Email', icon: '✉️', desc: 'Sync donors to email lists automatically.', oauthOnly: true },
  { name: 'Stripe', category: 'Payments', icon: '💳', desc: 'Accept cards, ACH, and international payments.' },
  { name: 'Zapier', category: 'Automation', icon: '⚡', desc: 'Connect to 5,000+ apps without code.' },
  { name: 'Google Analytics', category: 'Analytics', icon: '📊', desc: 'Track campaign traffic and conversions.' },
  { name: 'Facebook Pixel', category: 'Marketing', icon: '📘', desc: 'Retarget donors on Facebook and Instagram.' },
  { name: 'Slack', category: 'Notifications', icon: '💬', desc: 'Get donation alerts in your Slack workspace.' },
  { name: 'HubSpot', category: 'CRM', icon: '🎯', desc: 'Manage donor relationships in HubSpot CRM.', oauthOnly: true },
  { name: 'QuickBooks', category: 'Accounting', icon: '📒', desc: 'Sync donations for accounting and tax purposes.', oauthOnly: true },
];

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchConnections(userId: string): Promise<Connection[]> {
  try {
    const { data } = await supabaseAdmin
      .from('integration_connections')
      .select('id,provider,status,config,created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as Connection[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function IntegrationsPage() {
  const user = await requireUser();
  const connections = await fetchConnections(user.id);

  return (
    <CharitMeShell active="Integrations">
      <TopBar title="Integrations" subtitle="Connect your favorite tools to automate your fundraising workflow." />
      <IntegrationsClient initialConnections={connections} catalog={CATALOG} />
    </CharitMeShell>
  );
}
