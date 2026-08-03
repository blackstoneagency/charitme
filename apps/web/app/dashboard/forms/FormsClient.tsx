'use client';

import { useState } from 'react';
import { Btn, Input, Card, EmptyState, Select } from '../../../components/ui';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
import { formatCents } from '@shared/currencies';

export type DonationForm = {
  id: string;
  nonprofit_id: string | null;
  campaign_id: string | null;
  title: string;
  slug: string;
  default_amounts_cents: number[];
  recurring_enabled: boolean;
  currencies: string[];
  embed_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignOption = { id: string; title: string; slug: string };

const MAX_AMOUNTS = 6;

export default function FormsClient({
  initialForms,
  campaigns,
}: {
  initialForms: DonationForm[] | null;
  campaigns: CampaignOption[];
}) {
  const [forms, setForms] = useState<DonationForm[]>(initialForms ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(initialForms?.[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  // A failed read and an empty list are opposite messages. Rendering "no forms
  // yet" for a query that errored would tell someone their forms were deleted.
  if (initialForms === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="We couldn't load your donation forms">
          This is a temporary problem reading the database, not a sign that your forms are gone.
          Reload the page to try again.
        </DegradedReadNotice>
      </div>
    );
  }

  const selected = forms.find((f) => f.id === selectedId) ?? null;

  async function createForm(campaignId: string, title: string) {
    setCreating(true);
    setErr('');
    try {
      const res = await fetch('/api/donation-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, campaignId }),
      });
      const data: { form?: DonationForm; error?: string } = await res.json();
      if (!res.ok || !data.form) throw new Error(data.error ?? 'Could not create the form');
      setForms((prev) => [data.form as DonationForm, ...prev]);
      setSelectedId((data.form as DonationForm).id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function replace(updated: DonationForm) {
    setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }

  function remove(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  if (campaigns.length === 0) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <EmptyState
          title="Create a campaign first"
          body="A donation form collects money for a campaign, so you'll need one before you can build a form."
          action={<a className="kf-btn kf-btn-primary" href="/create">Start a campaign</a>}
        />
      </div>
    );
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
      {err && (
        <div role="alert" style={{ color: 'var(--red)', fontSize: 14 }}>
          {err}
        </div>
      )}

      <NewFormCard campaigns={campaigns} busy={creating} onCreate={createForm} />

      {forms.length === 0 ? (
        <EmptyState
          title="No donation forms yet"
          body="Build one above. You'll get an embeddable form you can drop into any website."
        />
      ) : (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)' }}>
          <nav aria-label="Your donation forms" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, alignContent: 'start' }}>
            {forms.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                aria-current={f.id === selectedId ? 'true' : undefined}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  minHeight: 44,
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--b2)',
                  background: f.id === selectedId ? 'var(--s2)' : 'transparent',
                  color: 'var(--t1)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{f.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)' }}>/{f.slug}</span>
              </button>
            ))}
          </nav>

          {selected ? (
            <FormEditor
              key={selected.id}
              form={selected}
              onSaved={replace}
              onDeleted={() => remove(selected.id)}
            />
          ) : (
            <Card>
              <p style={{ color: 'var(--t3)', fontSize: 14, margin: 0 }}>Select a form to edit it.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function NewFormCard({
  campaigns,
  busy,
  onCreate,
}: {
  campaigns: CampaignOption[];
  busy: boolean;
  onCreate: (campaignId: string, title: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');

  return (
    <Card>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>New donation form</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim().length >= 2 && campaignId) onCreate(campaignId, title.trim());
        }}
        style={{ display: 'flex', minWidth: 0, gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <label htmlFor="df-title" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Form title
          </label>
          <Input
            id="df-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Support Clean Water"
            maxLength={120}
            required
          />
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <label htmlFor="df-campaign" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Campaign
          </label>
          <Select id="df-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>
        <Btn type="submit" disabled={busy || title.trim().length < 2}>
          {busy ? 'Creating…' : 'Create form'}
        </Btn>
      </form>
    </Card>
  );
}

function FormEditor({
  form,
  onSaved,
  onDeleted,
}: {
  form: DonationForm;
  onSaved: (f: DonationForm) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(form.title);
  const [slug, setSlug] = useState(form.slug);
  const [amounts, setAmounts] = useState<number[]>(form.default_amounts_cents ?? []);
  const [recurring, setRecurring] = useState(form.recurring_enabled);
  const [embed, setEmbed] = useState(form.embed_enabled);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const currency = form.currencies?.[0] ?? 'usd';

  async function save() {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const res = await fetch(`/api/donation-forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          defaultAmountsCents: amounts,
          recurringEnabled: recurring,
          embedEnabled: embed,
        }),
      });
      const data: { form?: DonationForm; error?: string } = await res.json();
      if (!res.ok || !data.form) throw new Error(data.error ?? 'Could not save');
      onSaved(data.form);
      setSlug(data.form.slug);
      setMsg('Saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/donation-forms/${form.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not delete');
      }
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const embedSnippet = `<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/f/${slug}" width="100%" height="620" style="border:0" title="${title}"></iframe>`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
      <Card>
        <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Form settings</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <div>
            <label htmlFor="ed-title" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Title
            </label>
            <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label htmlFor="ed-slug" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Form URL
            </label>
            <Input id="ed-slug" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={60} />
            <p style={{ fontSize: 12, color: 'var(--t3)', margin: '6px 0 0' }}>
              Used by the embed. Changing it breaks any embed already published.
            </p>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 13, marginBottom: 6, padding: 0 }}>Suggested amounts</legend>
            <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap' }}>
              {amounts.map((cents, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <label className="kf-sr-only" htmlFor={`amt-${i}`}>
                    Amount {i + 1} in {currency.toUpperCase()}
                  </label>
                  <input
                    id={`amt-${i}`}
                    type="number"
                    min={1}
                    max={100000}
                    value={Math.round(cents / 100)}
                    onChange={(e) => {
                      const next = [...amounts];
                      next[i] = Math.max(100, Math.round(Number(e.target.value) * 100));
                      setAmounts(next);
                    }}
                    style={{
                      width: 90,
                      minHeight: 44,
                      padding: '8px 10px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--b2)',
                      background: 'var(--s1)',
                      color: 'var(--t1)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setAmounts(amounts.filter((_, j) => j !== i))}
                    aria-label={`Remove amount ${i + 1}`}
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      border: '1px solid var(--b2)',
                      borderRadius: 'var(--r)',
                      background: 'transparent',
                      color: 'var(--t2)',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {amounts.length < MAX_AMOUNTS && (
                <Btn type="button" variant="secondary" onClick={() => setAmounts([...amounts, 5000])}>
                  Add amount
                </Btn>
              )}
            </div>
          </fieldset>

          <label style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', fontSize: 14, minHeight: 44 }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Offer a monthly option
          </label>
          <label style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', fontSize: 14, minHeight: 44 }}>
            <input type="checkbox" checked={embed} onChange={(e) => setEmbed(e.target.checked)} />
            Allow embedding on other sites
          </label>

          <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
            <Btn type="button" onClick={save} disabled={saving || amounts.length === 0}>
              {saving ? 'Saving…' : 'Save changes'}
            </Btn>
            <Btn type="button" variant="secondary" onClick={destroy} disabled={saving}>
              Delete form
            </Btn>
          </div>
          {msg && (
            <p role="status" style={{ color: 'var(--green)', fontSize: 13, margin: 0 }}>
              {msg}
            </p>
          )}
          {error && (
            <p role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>
              {error}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Preview</h2>
        <div
          style={{
            border: '1px solid var(--b2)',
            borderRadius: 'var(--rl)',
            padding: 18,
            background: 'var(--s1)',
            maxWidth: 380,
          }}
        >
          <p style={{ margin: '0 0 12px', fontWeight: 700 }}>{title || 'Your donation form'}</p>
          <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {amounts.map((c, i) => (
              <span
                key={i}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--b2)',
                  borderRadius: 'var(--r)',
                  fontSize: 14,
                }}
              >
                {formatCents(c, currency)}
              </span>
            ))}
          </div>
          {recurring && (
            <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 12px' }}>Make this monthly</p>
          )}
          <div
            style={{
              background: 'var(--green)',
              color: '#fff',
              textAlign: 'center',
              padding: '10px 14px',
              borderRadius: 'var(--r)',
              fontWeight: 600,
            }}
          >
            Donate
          </div>
        </div>
      </Card>

      {embed && (
        <Card>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Embed</h2>
          <label htmlFor="embed-code" className="kf-sr-only">
            Embed code
          </label>
          <textarea
            id="embed-code"
            readOnly
            value={embedSnippet}
            rows={3}
            style={{
              width: '100%',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              padding: 10,
              borderRadius: 'var(--r)',
              border: '1px solid var(--b2)',
              background: 'var(--s2)',
              color: 'var(--t1)',
            }}
          />
        </Card>
      )}
    </div>
  );
}
