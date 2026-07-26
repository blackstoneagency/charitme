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
// A failed read here is not "you have no integrations" — that would invite a user
// to reconnect a provider they are already connected to. Report it instead.
async function fetchConnections(userId: string): Promise<{ connections: Connection[]; failed: boolean }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('integration_connections')
      .select('id,provider,status,config,created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { connections: [], failed: true };
    return { connections: (data ?? []) as Connection[], failed: false };
  } catch {
    return { connections: [], failed: true };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function IntegrationsPage() {
  const user = await requireUser();
  const { connections, failed } = await fetchConnections(user.id);

  return (
    <CharitMeShell active="Integrations">
      <TopBar title="Integrations" subtitle="Connect your favorite tools to automate your fundraising workflow." />
      {failed && (
        <div
          role="alert"
          style={{
            margin: '0 32px 16px', padding: '14px 16px', borderRadius: 12,
            background: 'var(--s2, #fffbeb)', border: '1px solid var(--b2, #fde68a)',
            color: 'var(--t1, #92400e)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4 }}>
            We couldn&apos;t load your connected integrations
          </strong>
          <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Anything already connected still is — this page just can&apos;t show it right now.
            Reload before connecting a provider again.
          </span>
        </div>
      )}
      <IntegrationsClient initialConnections={connections} catalog={CATALOG} />
    </CharitMeShell>
  );
}
