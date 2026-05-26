import { KindFundShell, TopBar, KFIcon } from '../../../components/KindFundApp';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type IntegrationConnection = {
  id: string;
  provider: string;
  status: 'connected' | 'paused' | 'revoked' | 'error';
  config: Record<string, string> | null;
  created_at: string;
};

type CatalogItem = {
  name: string;
  category: string;
  icon: string;
  desc: string;
};

// ─────────────────────────────────────────────
// Static catalog
// ─────────────────────────────────────────────
const CATALOG: CatalogItem[] = [
  { name: 'Mailchimp', category: 'Email', icon: '✉️', desc: 'Sync donors to email lists automatically.' },
  { name: 'Stripe', category: 'Payments', icon: '💳', desc: 'Accept cards, ACH, and international payments.' },
  { name: 'Zapier', category: 'Automation', icon: '⚡', desc: 'Connect to 5,000+ apps without code.' },
  { name: 'Google Analytics', category: 'Analytics', icon: '📊', desc: 'Track campaign traffic and conversions.' },
  { name: 'Facebook Pixel', category: 'Marketing', icon: '📘', desc: 'Retarget donors on Facebook and Instagram.' },
  { name: 'Slack', category: 'Notifications', icon: '💬', desc: 'Get donation alerts in your Slack workspace.' },
  { name: 'HubSpot', category: 'CRM', icon: '🎯', desc: 'Manage donor relationships in HubSpot CRM.' },
  { name: 'QuickBooks', category: 'Accounting', icon: '📒', desc: 'Sync donations for accounting and tax purposes.' },
];

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
async function fetchConnections(userId: string): Promise<IntegrationConnection[]> {
  try {
    const { data } = await supabaseAdmin
      .from('integration_connections')
      .select('id,provider,status,config,created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as IntegrationConnection[];
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

  const connectedProviders = new Set(
    connections.filter((c) => c.status === 'connected').map((c) => c.provider.toLowerCase()),
  );

  const connectedCatalog = CATALOG.filter((item) =>
    connectedProviders.has(item.name.toLowerCase()),
  );
  const allCatalog = CATALOG;

  return (
    <KindFundShell active="Integrations">
      <TopBar title="Integrations" subtitle="Connect your favorite tools." />
      <div style={{ padding: '0 32px 32px', display: 'grid', gap: '24px' }}>
        {/* Connected section — only show if there are active connections */}
        {connectedCatalog.length > 0 && (
          <section className="kf-card kf-integration-section">
            <div className="kf-card-head">
              <h2>Connected ({connectedCatalog.length})</h2>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
                padding: '0 20px 20px',
              }}
            >
              {connectedCatalog.map((item) => (
                <IntegrationCard key={item.name} item={item} connected />
              ))}
            </div>
          </section>
        )}

        {/* All integrations grid */}
        <section className="kf-card kf-integration-section">
          <div className="kf-card-head">
            <h2>All Integrations</h2>
            <label className="kf-search">
              <KFIcon name="search" />
              <input placeholder="Search integrations..." />
            </label>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
              padding: '0 20px 20px',
            }}
          >
            {allCatalog.map((item) => {
              const isConnected = connectedProviders.has(item.name.toLowerCase());
              return <IntegrationCard key={item.name} item={item} connected={isConnected} />;
            })}
          </div>
        </section>
      </div>
    </KindFundShell>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function IntegrationCard({ item, connected }: { item: CatalogItem; connected: boolean }) {
  return (
    <article
      style={{
        background: 'var(--s2)',
        border: connected ? '1px solid var(--green)' : '1px solid var(--b2)',
        borderRadius: 'var(--r)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            fontSize: 28,
            lineHeight: 1,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--s3)',
            borderRadius: 10,
          }}
        >
          {item.icon}
        </span>
        <div>
          <strong style={{ fontSize: 14, display: 'block' }}>{item.name}</strong>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--t3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {item.category}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        {connected ? (
          <span className="kf-pill green" style={{ fontSize: 11 }}>
            Connected
          </span>
        ) : (
          <span />
        )}
        <button
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 16px',
            borderRadius: 'var(--r)',
            border: connected ? '1px solid var(--b2)' : 'none',
            background: connected ? 'transparent' : 'var(--green)',
            color: connected ? 'var(--t2)' : '#fff',
            cursor: 'pointer',
          }}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </article>
  );
}
