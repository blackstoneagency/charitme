'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Country = {
  id: string;
  name: string;
  flag_emoji: string;
  iso_code: string;
  can_fundraise: boolean;
  can_donate: boolean;
  currency_code: string;
  notes: string | null;
  active: boolean;
  sort_order: number;
};

const EMPTY: Omit<Country, 'id'> = {
  name: '', flag_emoji: '', iso_code: '', can_fundraise: false,
  can_donate: true, currency_code: 'USD', notes: '', active: true, sort_order: 999,
};

// ── Shared style constants (declared before components that use them) ──
const iStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 9,
  background: 'var(--s1)', color: 'var(--t1)', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};
const lStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 650, color: 'var(--t3)',
  textTransform: 'uppercase', letterSpacing: '.04em',
};
const btnSave:   React.CSSProperties = { padding: '5px 14px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 650, cursor: 'pointer' };
const btnCancel: React.CSSProperties = { padding: '5px 12px', background: 'var(--s2)', color: 'var(--t3)', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' };
const btnEdit:   React.CSSProperties = { padding: '5px 12px', background: 'var(--s2)', color: 'var(--brand-text)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const btnDel:    React.CSSProperties = { padding: '5px 12px', background: 'var(--red-soft)', color: 'var(--red-text)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block', background: bg, color, padding: '3px 10px',
  borderRadius: 999, fontSize: 11, fontWeight: 700,
});

// ── Row component ──
function CountryRow({
  country, onUpdate, onDelete,
}: {
  country: Country;
  onUpdate: (id: string, patch: Partial<Country>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Omit<Country,'id'>>(country);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onUpdate(country.id, form);
    setSaving(false);
    setEditing(false);
  }

  const upd = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  if (editing) {
    return (
      <tr style={{ background: 'var(--s2)' }}>
        <td style={{ padding: '10px 14px' }}>
          <input aria-label="Flag emoji" value={form.flag_emoji} onChange={e => upd('flag_emoji', e.target.value)}
            style={{ ...iStyle, width: 52 }} placeholder="🇺🇸" maxLength={4} />
        </td>
        <td style={{ padding: '10px 14px' }}>
          <input aria-label="Country name" value={form.name} onChange={e => upd('name', e.target.value)}
            style={{ ...iStyle, width: 160 }} placeholder="Country name" />
        </td>
        <td style={{ padding: '10px 14px' }}>
          <input aria-label="ISO country code" value={form.iso_code} onChange={e => upd('iso_code', e.target.value.toUpperCase())}
            style={{ ...iStyle, width: 52 }} placeholder="US" maxLength={2} />
        </td>
        <td style={{ padding: '10px 14px' }}>
          <input aria-label="Currency code" value={form.currency_code} onChange={e => upd('currency_code', e.target.value.toUpperCase())}
            style={{ ...iStyle, width: 60 }} placeholder="USD" maxLength={3} />
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
          <input type="checkbox" aria-label="Can fundraise" checked={form.can_fundraise} onChange={e => upd('can_fundraise', e.target.checked)}
            style={{ accentColor: '#6c35ff', width: 16, height: 16 }} />
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
          <input type="checkbox" aria-label="Can donate" checked={form.can_donate} onChange={e => upd('can_donate', e.target.checked)}
            style={{ accentColor: '#6c35ff', width: 16, height: 16 }} />
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
          <input type="checkbox" aria-label="Active" checked={form.active} onChange={e => upd('active', e.target.checked)}
            style={{ accentColor: '#19b86a', width: 16, height: 16 }} />
        </td>
        <td style={{ padding: '10px 14px' }}>
          <input aria-label="Notes" value={form.notes ?? ''} onChange={e => upd('notes', e.target.value)}
            style={{ ...iStyle, width: 200 }} placeholder="Optional notes" />
        </td>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', minWidth: 0, gap: 6 }}>
            <button onClick={() => void save()} disabled={saving} style={btnSave}>{saving ? '…' : 'Save'}</button>
            <button onClick={() => { setEditing(false); setForm(country); }} style={btnCancel}>Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: '1px solid #f0f4f8' }}>
      <td style={{ padding: '11px 14px', fontSize: 24 }}>{country.flag_emoji}</td>
      <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{country.name}</td>
      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--t3)', fontFamily: 'monospace', fontWeight: 700 }}>{country.iso_code}</td>
      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--t3)', fontFamily: 'monospace', fontWeight: 700 }}>{country.currency_code}</td>
      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
        {country.can_fundraise
          ? <span style={pill('var(--green-light)','var(--green-text)')}>✓ Yes</span>
          : <span style={pill('var(--s2)','var(--t3)')}>—</span>}
      </td>
      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
        {country.can_donate
          ? <span style={pill('var(--s3)','var(--blue-text)')}>✓ Yes</span>
          : <span style={pill('var(--s2)','var(--t3)')}>—</span>}
      </td>
      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
        <button
          onClick={() => void onUpdate(country.id, { active: !country.active })}
          style={{ ...pill(country.active ? 'var(--green-light)' : 'var(--red-soft)', country.active ? 'var(--green-text)' : 'var(--red-text)'), border: 'none', cursor: 'pointer', fontWeight: 650 }}
        >
          {country.active ? '● Active' : '○ Hidden'}
        </button>
      </td>
      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--t3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {country.notes || '—'}
      </td>
      <td style={{ padding: '11px 14px' }}>
        <div style={{ display: 'flex', minWidth: 0, gap: 6 }}>
          <button onClick={() => setEditing(true)} style={btnEdit}>Edit</button>
          <button onClick={() => { if (confirm(`Delete ${country.name}?`)) onDelete(country.id); }} style={btnDel}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ──
export default function AdminCountriesClient() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading]     = useState(true);
  const [notice, setNotice]       = useState('');
  const [adding, setAdding]       = useState(false);
  const [newForm, setNewForm]     = useState<Omit<Country,'id'>>(EMPTY);
  const [filter, setFilter]       = useState<'all'|'fundraise'|'donate'>('all');
  const [search, setSearch]       = useState('');

  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(''), 4000); }

  useEffect(() => {
    fetch('/api/admin/countries')
      .then(r => r.json())
      .then((d: { countries: Country[] }) => { setCountries(d.countries); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addCountry() {
    if (!newForm.name.trim()) return;
    setAdding(true);
    const res = await fetch('/api/admin/countries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    });
    const d = await res.json() as { country?: Country; error?: string };
    if (!res.ok) { flash(`❌ ${d.error ?? 'Failed'}`); }
    else { setCountries(prev => [...prev, d.country!]); setNewForm(EMPTY); flash('✓ Country added'); }
    setAdding(false);
  }

  async function updateCountry(id: string, patch: Partial<Country>) {
    setCountries(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    const res = await fetch(`/api/admin/countries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) flash('❌ Update failed');
    else flash('✓ Saved');
  }

  function deleteCountry(id: string) {
    setCountries(prev => prev.filter(c => c.id !== id));
    fetch(`/api/admin/countries/${id}`, { method: 'DELETE' }).catch(() => undefined);
    flash('Country deleted');
  }

  const updNew = <K extends keyof typeof newForm>(k: K, v: typeof newForm[K]) =>
    setNewForm(prev => ({ ...prev, [k]: v }));

  const filtered = countries.filter(c => {
    if (filter === 'fundraise' && !c.can_fundraise) return false;
    if (filter === 'donate' && c.can_fundraise) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.iso_code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fundraiseCount = countries.filter(c => c.can_fundraise).length;
  const donateCount    = countries.filter(c => c.can_donate && !c.can_fundraise).length;
  const activeCount    = countries.filter(c => c.active).length;

  return (
    <div className="kf-admin-dash" style={{ maxWidth: 1200 }}>

      {/* Notice */}
      {notice && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: notice.includes('❌') ? 'var(--tint-red)' : '#f0fdf4', border: `1px solid ${notice.includes('❌') ? '#fecdd3' : '#bbf7d0'}`, color: notice.includes('❌') ? 'var(--red-text)' : 'var(--green-text)', fontWeight: 700, fontSize: 13 }}>
          {notice}
        </div>
      )}

      {/* Stats row */}
      <div className="kf-metrics">
        {[
          { label: 'Total Countries',  value: countries.length, color: 'var(--brand-text)' },
          { label: 'Can Fundraise',    value: fundraiseCount,   color: 'var(--green-text)' },
          { label: 'Donate Only',      value: donateCount,      color: '#0ea5e9' },
          { label: 'Active / Visible', value: activeCount,      color: 'var(--orange-text)' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Public page link */}
      <div style={{ padding: '12px 18px', background: 'var(--s2)', borderRadius: 12, border: '1px solid var(--b2)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-text)' }}>
          🌍 Public page:{' '}
          <code style={{ background: 'rgba(0,0,0,.06)', padding: '2px 6px', borderRadius: 4 }}>/supported-countries</code>
        </span>
        <Link href="/supported-countries" target="_blank" style={{ fontSize: 12, fontWeight: 650, color: 'var(--brand-text)', textDecoration: 'none' }}>
          View Page →
        </Link>
      </div>

      {/* Add form */}
      <div style={{ background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontWeight: 650, fontSize: 14, color: 'var(--t1)', marginBottom: 14 }}>+ Add Country</div>
        <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lStyle} htmlFor="ctry-flag">Flag</label>
            <input id="ctry-flag" value={newForm.flag_emoji} onChange={e => updNew('flag_emoji', e.target.value)} style={{ ...iStyle, width: 64 }} placeholder="🇺🇸" maxLength={4} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 160px' }}>
            <label style={lStyle} htmlFor="ctry-name">Country Name *</label>
            <input id="ctry-name" value={newForm.name} onChange={e => updNew('name', e.target.value)} style={iStyle} placeholder="United States" onKeyDown={e => e.key === 'Enter' && void addCountry()} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lStyle} htmlFor="ctry-iso">ISO Code</label>
            <input id="ctry-iso" value={newForm.iso_code} onChange={e => updNew('iso_code', e.target.value.toUpperCase())} style={{ ...iStyle, width: 64 }} placeholder="US" maxLength={2} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lStyle} htmlFor="ctry-currency">Currency</label>
            <input id="ctry-currency" value={newForm.currency_code} onChange={e => updNew('currency_code', e.target.value.toUpperCase())} style={{ ...iStyle, width: 72 }} placeholder="USD" maxLength={3} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lStyle}>Fundraise?</span>
            <label style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6, height: 40, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: newForm.can_fundraise ? 'var(--green-text)' : 'var(--t3)' }}>
              <input type="checkbox" checked={newForm.can_fundraise} onChange={e => updNew('can_fundraise', e.target.checked)} style={{ accentColor: '#6c35ff', width: 16, height: 16 }} />
              {newForm.can_fundraise ? 'Yes' : 'No'}
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lStyle}>Donate?</span>
            <label style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6, height: 40, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: newForm.can_donate ? 'var(--blue-text)' : 'var(--t3)' }}>
              <input type="checkbox" checked={newForm.can_donate} onChange={e => updNew('can_donate', e.target.checked)} style={{ accentColor: '#6c35ff', width: 16, height: 16 }} />
              {newForm.can_donate ? 'Yes' : 'No'}
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '3 1 200px' }}>
            <label style={lStyle} htmlFor="ctry-notes">Notes (optional)</label>
            <input id="ctry-notes" value={newForm.notes ?? ''} onChange={e => updNew('notes', e.target.value)} style={iStyle} placeholder="e.g. Payout via Stripe Connect" />
          </div>
          <button
            onClick={() => void addCountry()}
            disabled={adding || !newForm.name.trim()}
            style={{ height: 40, padding: '0 22px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 650, fontSize: 13, cursor: 'pointer', flexShrink: 0, opacity: adding || !newForm.name.trim() ? .5 : 1 }}
          >
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Filter + search */}
      <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all','fundraise','donate'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ padding: '7px 16px', borderRadius: 999, border: '1.5px solid', borderColor: filter === f ? 'var(--brand-text)' : 'var(--b1)', background: filter === f ? 'var(--tint-violet)' : 'var(--s1)', color: filter === f ? 'var(--brand-text)' : 'var(--t2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {f === 'all' ? `All (${countries.length})` : f === 'fundraise' ? `Fundraise (${fundraiseCount})` : `Donate Only (${donateCount})`}
          </button>
        ))}
        <input
          aria-label="Search countries by name or ISO code"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or ISO…"
          style={{ marginLeft: 'auto', padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, width: 220, boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Loading…</div>
      ) : (
        <div className="kf-table-scroll" style={{ background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                {['Flag','Country','ISO','Currency','Fundraise','Donate','Status','Notes','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Fundraise' || h === 'Donate' || h === 'Status' ? 'center' : 'left', fontWeight: 700, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)' }}>No countries found.</td></tr>
              ) : filtered.map(c => (
                <CountryRow key={c.id} country={c} onUpdate={updateCountry} onDelete={deleteCountry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
