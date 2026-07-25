'use client';

import React, { useState, useEffect } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type Connection = {
  id: string;
  provider: string;
  status: string;
  created_at: string;
};

export type CatalogItem = {
  name: string;
  category: string;
  icon: string;
  desc: string;
  oauthOnly?: boolean; // if true, show "OAuth Coming Soon" instead of connect form
};

export type IntegrationsClientProps = {
  initialConnections: Connection[];
  catalog: CatalogItem[];
};

// ─────────────────────────────────────────────
// Connect modal
// ─────────────────────────────────────────────
function ConnectModal({
  item,
  onConnected,
  onClose,
}: {
  item: CatalogItem;
  onConnected: (conn: Connection) => void;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Escape closes the modal (keyboard-accessible dismiss).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Decide which field(s) to show based on integration type
  const needsWebhook = ['zapier', 'slack'].includes(item.name.toLowerCase());

  async function handleConnect() {
    const value = needsWebhook ? webhookUrl.trim() : apiKey.trim();
    if (!value) {
      setError(needsWebhook ? 'Webhook URL is required.' : 'API key / tracking ID is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const configKey = needsWebhook ? 'webhook_url' : 'api_key';
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: item.name, config: { [configKey]: value } }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; connection?: Connection };
      if (!res.ok) {
        setError(data.error ?? 'Failed to connect.');
        return;
      }
      if (data.connection) onConnected(data.connection);
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Modal backdrop dismissal intentionally listens for pointer clicks only;
    // Escape and the visible close button provide the keyboard path.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="kf-modal-responsive" style={{ width: 440, background: 'var(--s1, #fff)', borderRadius: 16, boxShadow: '0 20px 60px rgba(20,20,80,.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--b1, var(--b1))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <strong style={{ fontSize: 16, fontWeight: 650 }}>Connect {item.name}</strong>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t3)' }}>{item.desc}</p>
          </div>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: '1px solid var(--b1, var(--b1))', borderRadius: '50%', background: 'var(--s1, #fff)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--t3, var(--t3))' }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 14 }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(190,18,60,.08)', borderRadius: 9, color: 'var(--red, var(--red))', fontSize: 13, fontWeight: 700 }}>{error}</div>
          )}

          {needsWebhook ? (
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
              Webhook URL
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                style={{ height: 42, border: '1px solid var(--b2, var(--b1))', borderRadius: 9, padding: '0 12px', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--t3, var(--t3))', fontWeight: 400 }}>
                Paste the webhook URL from your {item.name} account.
              </span>
            </label>
          ) : (
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
              {item.name === 'Google Analytics' ? 'Tracking ID / Measurement ID' : item.name === 'Facebook Pixel' ? 'Pixel ID' : 'API Key'}
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={
                  item.name === 'Google Analytics' ? 'G-XXXXXXXXXX' :
                  item.name === 'Facebook Pixel' ? '123456789012345' :
                  'Enter your API key'
                }
                style={{ height: 42, border: '1px solid var(--b2, var(--b1))', borderRadius: 9, padding: '0 12px', fontSize: 14, fontFamily: 'monospace', background: 'var(--s1)', color: 'var(--t1)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--t3, var(--t3))', fontWeight: 400 }}>
                Find this in your {item.name} account settings.
              </span>
            </label>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--b1)', display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 42, border: '1px solid var(--b1)', borderRadius: 9, background: 'var(--s1)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleConnect()} disabled={saving} style={{ flex: 1, height: 42, border: 0, borderRadius: 9, background: 'var(--green)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Integration card
// ─────────────────────────────────────────────
function IntegrationCard({
  item,
  connection,
  onConnect,
  onDisconnect,
  disconnecting,
}: {
  item: CatalogItem;
  connection: Connection | null;
  onConnect: (item: CatalogItem) => void;
  onDisconnect: (id: string) => void;
  disconnecting: string | null;
}) {
  const connected = connection !== null && connection.status === 'connected';

  return (
    <article style={{
      background: 'var(--s2)',
      border: connected ? '1px solid var(--green)' : '1px solid var(--b2)',
      borderRadius: 'var(--r)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 28, lineHeight: 1, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--s3)', borderRadius: 10 }}>
          {item.icon}
        </span>
        <div>
          <strong style={{ fontSize: 14, display: 'block' }}>{item.name}</strong>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {item.category}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        {connected ? (
          <span className="kf-pill green" style={{ fontSize: 11 }}>Connected</span>
        ) : (
          <span />
        )}
        {item.oauthOnly && !connected ? (
          <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, padding: '6px 12px', background: 'var(--s3)', borderRadius: 8 }}>
            Coming Soon
          </span>
        ) : connected ? (
          <button
            type="button"
            disabled={disconnecting === connection?.id}
            onClick={() => connection && onDisconnect(connection.id)}
            style={{ fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', opacity: disconnecting === connection?.id ? 0.6 : 1 }}
          >
            {disconnecting === connection?.id ? 'Removing…' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(item)}
            style={{ fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 'var(--r)', border: 'none', background: 'var(--green)', color: '#fff', cursor: 'pointer' }}
          >
            Connect
          </button>
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────
export default function IntegrationsClient({ initialConnections, catalog }: IntegrationsClientProps) {
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [connectingItem, setConnectingItem] = useState<CatalogItem | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  function getConnection(providerName: string): Connection | null {
    return connections.find(c => c.provider.toLowerCase() === providerName.toLowerCase()) ?? null;
  }

  function handleConnected(conn: Connection) {
    setConnections(prev => {
      const without = prev.filter(c => c.id !== conn.id);
      return [conn, ...without];
    });
  }

  async function handleDisconnect(id: string) {
    setDisconnecting(id);
    setError('');
    try {
      const res = await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Failed to disconnect.');
        return;
      }
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDisconnecting(null);
    }
  }

  const connectedItems = catalog.filter(item => getConnection(item.name) !== null);

  return (
    <div className="kf-admin-dash">
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(190,18,60,.08)', border: '1px solid rgba(190,18,60,.25)', borderRadius: 10, color: 'var(--red, var(--red))', fontSize: 14, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Connected section */}
      {connectedItems.length > 0 && (
        <section className="kf-card kf-integration-section">
          <div className="kf-card-head">
            <h2>Connected ({connectedItems.length})</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, padding: '0 20px 20px' }}>
            {connectedItems.map(item => (
              <IntegrationCard
                key={item.name}
                item={item}
                connection={getConnection(item.name)}
                onConnect={() => setConnectingItem(item)}
                onDisconnect={id => void handleDisconnect(id)}
                disconnecting={disconnecting}
              />
            ))}
          </div>
        </section>
      )}

      {/* All integrations */}
      <section className="kf-card kf-integration-section">
        <div className="kf-card-head">
          <h2>All Integrations</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, padding: '0 20px 20px' }}>
          {catalog.map(item => (
            <IntegrationCard
              key={item.name}
              item={item}
              connection={getConnection(item.name)}
              onConnect={() => setConnectingItem(item)}
              onDisconnect={id => void handleDisconnect(id)}
              disconnecting={disconnecting}
            />
          ))}
        </div>
      </section>

      {/* Connect modal */}
      {connectingItem && (
        <ConnectModal
          item={connectingItem}
          onConnected={handleConnected}
          onClose={() => setConnectingItem(null)}
        />
      )}
    </div>
  );
}
