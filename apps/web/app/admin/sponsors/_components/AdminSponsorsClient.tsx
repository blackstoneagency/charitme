'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Extract bare domain from a URL or domain string
function extractDomain(urlOrDomain: string): string {
  try {
    const u = urlOrDomain.startsWith('http') ? new URL(urlOrDomain) : new URL('https://' + urlOrDomain);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return urlOrDomain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

// Google's S2 favicon service returns high-quality logos for all major brands
function googleLogoUrl(domain: string, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

// Smart logo image — tries stored URL, falls back to Google favicon derived from website.
// Uses errorCount to walk through candidates so no setState-in-effect is needed.
// Parent should pass key={src ?? 'none'} to remount when the logo URL changes.
function LogoImg({ src, website, name, style }: { src: string | null; website: string | null; name: string; style?: React.CSSProperties }) {
  const domain = website ? extractDomain(website) : null;
  const fallback = domain ? googleLogoUrl(domain, 128) : null;
  const [errorCount, setErrorCount] = useState(0);

  // Build candidate list: stored URL first, then Google favicon fallback
  const candidates = [src, fallback].filter((u): u is string => Boolean(u));
  const imgSrc = errorCount < candidates.length ? candidates[errorCount] : null;

  if (!imgSrc) {
    return <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>{name.slice(0, 2).toUpperCase()}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imgSrc} alt={name} style={style} onError={() => setErrorCount(c => c + 1)} />
  );
}

type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  active: boolean;
  sort_order: number;
};

function SponsorRow({
  sponsor, onToggle, onDelete, onLogoUpload, onEdit, uploading,
}: {
  sponsor: Sponsor;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onLogoUpload: (id: string, file: File) => void;
  onEdit: (id: string, name: string, website: string) => void;
  uploading: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState(sponsor.name);
  const [editSite, setEditSite] = useState(sponsor.website ?? '');
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: '#fff', borderRadius: 12, border: '1px solid #eef0f7', marginBottom: 10 }}>
      {/* Logo preview */}
      <div style={{ width: 80, height: 44, borderRadius: 8, border: '1px solid #eef0f7', background: '#f8f9fc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        <LogoImg key={sponsor.logo_url ?? 'none'} src={sponsor.logo_url} website={sponsor.website} name={sponsor.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>

      {/* Name / website */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 700 }} placeholder="Company name" />
            <input value={editSite} onChange={e => setEditSite(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, color: '#6b7280' }} placeholder="https://example.com (optional)" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onEdit(sponsor.id, editName, editSite); setEditing(false); }}
                style={{ padding: '5px 14px', background: '#6c35ff', color: '#fff', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Save</button>
              <button onClick={() => setEditing(false)}
                style={{ padding: '5px 14px', background: '#f1f5f9', color: '#64748b', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1a1a2e' }}>{sponsor.name}</div>
            {sponsor.website && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sponsor.website}</div>}
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: sponsor.active ? '#16a34a' : '#94a3b8' }}>
          <input type="checkbox" checked={sponsor.active} onChange={e => onToggle(sponsor.id, e.target.checked)}
            style={{ accentColor: '#6c35ff', width: 15, height: 15 }} />
          {sponsor.active ? 'Visible' : 'Hidden'}
        </label>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onLogoUpload(sponsor.id, f); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading === sponsor.id}
          style={{ padding: '6px 12px', border: '1px solid #6c35ff', borderRadius: 8, background: '#f0eaff', color: '#6c35ff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {uploading === sponsor.id ? 'Uploading…' : sponsor.logo_url ? '↑ Replace' : '↑ Logo'}
        </button>

        {!editing && (
          <button onClick={() => setEditing(true)}
            style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8f9fc', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Edit
          </button>
        )}

        <button onClick={() => { if (confirm(`Delete ${sponsor.name}?`)) onDelete(sponsor.id); }}
          style={{ padding: '6px 12px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fff0f3', color: '#be123c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AdminSponsorsClient() {
  const [sponsors, setSponsors]   = useState<Sponsor[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notice, setNotice]       = useState('');
  const [newName, setNewName]     = useState('');
  const [newSite, setNewSite]     = useState('');
  const [adding, setAdding]       = useState(false);

  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(''), 4000); }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/sponsors')
      .then(r => r.ok ? r.json() : { sponsors: [] })
      .then((d: { sponsors: Sponsor[] }) => { if (!cancelled) { setSponsors(d.sponsors); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function addSponsor() {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch('/api/admin/sponsors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), website: newSite.trim() || null, active: true, sort_order: sponsors.length }),
    });
    const d = await res.json() as { sponsor?: Sponsor; error?: string };
    if (!res.ok) flash(`❌ ${d.error ?? 'Failed to add'}`);
    else { setSponsors(prev => [...prev, d.sponsor!]); setNewName(''); setNewSite(''); flash('✓ Sponsor added'); }
    setAdding(false);
  }

  async function toggleSponsor(id: string, active: boolean) {
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    await fetch(`/api/admin/sponsors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
  }

  async function deleteSponsor(id: string) {
    setSponsors(prev => prev.filter(s => s.id !== id));
    await fetch(`/api/admin/sponsors/${id}`, { method: 'DELETE' });
    flash('Sponsor deleted');
  }

  async function editSponsor(id: string, name: string, website: string) {
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, name, website: website || null } : s));
    await fetch(`/api/admin/sponsors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, website: website || null }) });
    flash('✓ Saved');
  }

  async function uploadLogo(id: string, file: File) {
    setUploading(id);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'cover');
    const res = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
    const d = await res.json() as { url?: string; error?: string };
    if (!res.ok || !d.url) { flash(`❌ ${d.error ?? 'Upload failed'}`); setUploading(null); return; }
    const pr = await fetch(`/api/admin/sponsors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_url: d.url }) });
    const pd = await pr.json() as { sponsor?: Sponsor };
    if (pd.sponsor) setSponsors(prev => prev.map(s => s.id === id ? { ...s, logo_url: pd.sponsor!.logo_url } : s));
    flash('✓ Logo uploaded');
    setUploading(null);
  }

  const visible = sponsors.filter(s => s.active && (s.logo_url || s.website));

  return (
    <div style={{ padding: '0 32px 40px', maxWidth: 900 }}>
      {notice && (
        <div style={{ margin: '0 0 16px', padding: '10px 16px', borderRadius: 10, background: notice.includes('❌') ? '#fff0f3' : '#f0fdf4', border: `1px solid ${notice.includes('❌') ? '#fecdd3' : '#bbf7d0'}`, color: notice.includes('❌') ? '#be123c' : '#15803d', fontWeight: 700, fontSize: 13 }}>
          {notice}
        </div>
      )}

      {/* Preview bar */}
      {visible.length > 0 && (
        <div style={{ marginBottom: 28, padding: '18px 24px', background: '#fff', borderRadius: 14, border: '1px solid #eef0f7' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Homepage Preview — {visible.length} logo{visible.length !== 1 ? 's' : ''} showing
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {visible.map(s => (
              <LogoImg key={s.logo_url ?? s.id} src={s.logo_url} website={s.website} name={s.name} style={{ height: 32, maxWidth: 120, objectFit: 'contain', filter: 'grayscale(1)', opacity: .7 }} />
            ))}
          </div>
        </div>
      )}

      {/* Add sponsor */}
      <div style={{ marginBottom: 24, padding: '20px 24px', background: '#f8f9fc', borderRadius: 14, border: '1px solid #eef0f7' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: '#1a1a2e' }}>Add Sponsor</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Company name *"
            style={{ flex: '1 1 180px', padding: '9px 14px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 700 }}
            onKeyDown={e => e.key === 'Enter' && void addSponsor()} />
          <input value={newSite} onChange={e => setNewSite(e.target.value)} placeholder="Website URL (optional)"
            style={{ flex: '2 1 240px', padding: '9px 14px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: 13, color: '#6b7280' }} />
          <button onClick={() => void addSponsor()} disabled={adding || !newName.trim()}
            style={{ padding: '9px 22px', background: '#6c35ff', color: '#fff', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#94a3b8' }}>
          After adding, click <strong>↑ Logo</strong> to upload the company logo. Only sponsors with logos appear on the homepage.
        </p>
      </div>

      {/* List */}
      {loading && <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>}
      {!loading && sponsors.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>No sponsors yet. Add one above.</div>
      )}
      {sponsors.map(s => (
        <SponsorRow key={s.id} sponsor={s} onToggle={toggleSponsor} onDelete={deleteSponsor} onLogoUpload={uploadLogo} onEdit={editSponsor} uploading={uploading} />
      ))}
    </div>
  );
}
