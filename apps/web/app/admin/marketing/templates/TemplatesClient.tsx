'use client';

import { useMemo, useState } from 'react';
import { Btn, Input, Card, EmptyState, Badge } from '../../../../components/ui';
import DegradedReadNotice from '../../../../components/DegradedReadNotice';

export type EmailTemplate = {
  id: string;
  name: string;
  category: string;
  subject: string;
  preview_text: string | null;
  body: string;
  variables: string[] | null;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export default function TemplatesClient({
  initialTemplates,
}: {
  initialTemplates: EmailTemplate[] | null;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates?.[0]?.id ?? null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const byCategory = useMemo(() => {
    const groups = new Map<string, EmailTemplate[]>();
    for (const t of templates) {
      groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  if (initialTemplates === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="We couldn't load the email templates">
          This is a temporary problem reading the database, not a sign the templates were deleted.
          Do not recreate them from memory — automations pick a template by category, so a duplicate
          would change which one gets sent. Reload to try again.
        </DegradedReadNotice>
      </div>
    );
  }

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  async function create() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/marketing/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Untitled template',
          category: 'general',
          subject: '',
          body: '',
        }),
      });
      const data: { template?: EmailTemplate; error?: string } = await res.json();
      if (!res.ok || !data.template) throw new Error(data.error ?? 'Could not create the template');
      setTemplates((prev) => [data.template as EmailTemplate, ...prev]);
      setSelectedId((data.template as EmailTemplate).id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
      {/* Heading and subtitle now come from the shell's TopBar. The action stays
          here rather than moving into TopBar's `actions` slot, because it needs
          this component's `create`/`busy` state and TopBar renders on the server. */}
      <header style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn type="button" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'New template'}
        </Btn>
      </header>

      {err && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 14, margin: 0 }}>
          {err}
        </p>
      )}

      {templates.length === 0 ? (
        <EmptyState
          title="No email templates yet"
          body="Create one to control what your automations send."
        />
      ) : (
        <div className="email-template-layout" style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)' }}>
          <nav aria-label="Email templates" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, alignContent: 'start' }}>
            {byCategory.map(([category, list]) => (
              <div key={category}>
                <h2
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                    color: 'var(--t3)',
                    margin: '0 0 8px',
                  }}
                >
                  {category}
                  {list.length > 1 && (
                    <span style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                      ⚠️ {list.length} share this category
                    </span>
                  )}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
                  {list.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={t.id === selectedId ? 'true' : undefined}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        minHeight: 44,
                        borderRadius: 'var(--r)',
                        border: '1px solid var(--b2)',
                        background: t.id === selectedId ? 'var(--s2)' : 'transparent',
                        color: 'var(--t1)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{t.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)' }}>
                        {t.subject || 'No subject'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {selected ? (
            <TemplateEditor
              key={selected.id}
              template={selected}
              onSaved={(t) => setTemplates((prev) => prev.map((x) => (x.id === t.id ? t : x)))}
              onDeleted={() => {
                setTemplates((prev) => prev.filter((x) => x.id !== selected.id));
                setSelectedId(null);
              }}
            />
          ) : (
            <Card>
              <p style={{ color: 'var(--t3)', fontSize: 14, margin: 0 }}>Select a template to edit it.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onSaved,
  onDeleted,
}: {
  template: EmailTemplate;
  onSaved: (t: EmailTemplate) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [category, setCategory] = useState(template.category);
  const [subject, setSubject] = useState(template.subject);
  const [previewText, setPreviewText] = useState(template.preview_text ?? '');
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const res = await fetch(`/api/admin/marketing/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, subject, previewText: previewText || null, body }),
      });
      const data: { template?: EmailTemplate; error?: string } = await res.json();
      if (!res.ok || !data.template) throw new Error(data.error ?? 'Could not save');
      onSaved(data.template);
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
      const res = await fetch(`/api/admin/marketing/templates/${template.id}`, { method: 'DELETE' });
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

  return (
    <Card>
      <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16, flex: '1 1 auto' }}>Edit template</h2>
        {template.is_system && <Badge>Built-in</Badge>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
        <div>
          <label htmlFor="t-name" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Name
          </label>
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>

        <div>
          <label htmlFor="t-category" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Category
          </label>
          <Input
            id="t-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={40}
            disabled={template.is_system}
            aria-describedby="t-category-help"
          />
          <p id="t-category-help" style={{ fontSize: 12, color: 'var(--t3)', margin: '6px 0 0' }}>
            {template.is_system
              ? 'Built-in templates keep their category — automations select them by it.'
              : 'Automations pick a template by category. Two templates sharing one is ambiguous.'}
          </p>
        </div>

        <div>
          <label htmlFor="t-subject" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Subject line
          </label>
          <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </div>

        <div>
          <label htmlFor="t-preview" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Preview text
          </label>
          <Input
            id="t-preview"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="t-body" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            Body
          </label>
          <textarea
            id="t-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            style={{
              width: '100%',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              padding: 10,
              borderRadius: 'var(--r)',
              border: '1px solid var(--b2)',
              background: 'var(--s1)',
              color: 'var(--t1)',
            }}
          />
          {template.variables && template.variables.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--t3)', margin: '6px 0 0' }}>
              Available variables: {template.variables.map((v) => `{{${v}}}`).join(', ')}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
          <Btn type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Btn>
          {!template.is_system && (
            <Btn type="button" variant="secondary" onClick={destroy} disabled={saving}>
              Delete
            </Btn>
          )}
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
  );
}
