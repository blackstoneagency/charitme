'use client';

import { useState } from 'react';
import { Btn, Card, Badge } from '../../../components/ui';
import DegradedReadNotice from '../../../components/DegradedReadNotice';

export type Policy = {
  id: string;
  category: string;
  retention_days: number;
  auto_delete: boolean;
  updated_at: string;
};

export type RetentionRun = {
  id: string;
  category: string;
  cutoff_at: string;
  matched_count: number;
  deleted_count: number;
  dry_run: boolean;
  error: string | null;
  ran_at: string;
};

type CategoryInfo = {
  key: string;
  label: string;
  description: string;
  table: string;
  defaultDays: number;
};

export default function RetentionClient({
  categories,
  initialPolicies,
  initialRuns,
}: {
  categories: CategoryInfo[];
  initialPolicies: Policy[] | null;
  initialRuns: RetentionRun[] | null;
}) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies ?? []);
  const [err, setErr] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  if (initialPolicies === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="Retention policies are unavailable">
          The policy table could not be read. If this is a new deploy, the
          <code> 20260822000000_data_retention_policies </code> migration has probably not been
          applied. Nothing is deleted while this is the case — the retention job needs a policy row
          to act on, so an unreadable table means no deletions, not silent ones.
        </DegradedReadNotice>
      </div>
    );
  }

  const byCategory = new Map(policies.map((p) => [p.category, p]));

  async function save(key: string, retentionDays: number, autoDelete: boolean) {
    setSavingKey(key);
    setErr('');
    try {
      const res = await fetch('/api/admin/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: key, retentionDays, autoDelete }),
      });
      const data: { policy?: Policy; error?: string } = await res.json();
      if (!res.ok || !data.policy) throw new Error(data.error ?? 'Could not save');
      setPolicies((prev) => {
        const rest = prev.filter((p) => p.category !== key);
        return [...rest, data.policy as Policy].sort((a, b) => a.category.localeCompare(b.category));
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 900 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Data Retention</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--t3)', fontSize: 14 }}>
          How long operational data is kept. Financial and identity records are not listed — they
          carry legal retention requirements that override any setting here.
        </p>
      </header>

      <div
        role="note"
        style={{
          border: '1px solid var(--b2)',
          borderLeft: '3px solid var(--blue)',
          borderRadius: 'var(--r)',
          padding: '12px 14px',
          background: 'var(--s2)',
          fontSize: 14,
          color: 'var(--t2)',
        }}
      >
        <strong style={{ color: 'var(--t1)' }}>Deleting needs two separate opt-ins.</strong> A
        category only has data removed when <em>Auto-delete</em> is on <em>and</em> the scheduled job
        runs with dry-run turned off. With either missing it counts what is past its window and
        removes nothing. Deletion is permanent, so it is never the default.
      </div>

      {err && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 14, margin: 0 }}>
          {err}
        </p>
      )}

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Categories</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
          {categories.map((c) => {
            const policy = byCategory.get(c.key);
            return (
              <li key={c.key} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: 12 }}>
                <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{c.label}</strong>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t3)' }}>{c.description}</p>
                    <code style={{ fontSize: 11, color: 'var(--t3)' }}>{c.table}</code>
                  </div>
                  {policy ? (
                    <Badge>{policy.auto_delete ? 'Auto-delete on' : 'Report only'}</Badge>
                  ) : (
                    <Badge>Not configured</Badge>
                  )}
                </div>

                <RetentionRow
                  categoryKey={c.key}
                  defaultDays={policy?.retention_days ?? c.defaultDays}
                  autoDelete={policy?.auto_delete ?? false}
                  saving={savingKey === c.key}
                  onSave={save}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Recent runs</h2>
        {initialRuns === null ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            Run history could not be loaded — this is not the same as no runs having happened.
          </p>
        ) : (initialRuns ?? []).length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            No runs recorded yet. The job is at <code>/api/cron/apply-retention</code>.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {initialRuns.map((r) => (
              <li key={r.id} style={{ fontSize: 13, color: 'var(--t2)', borderTop: '1px solid var(--b1)', paddingTop: 8 }}>
                <strong style={{ color: 'var(--t1)' }}>{r.category}</strong> —{' '}
                {r.dry_run ? `${r.matched_count} past retention (report only)` : `${r.deleted_count} deleted`}
                {' · '}
                {new Date(r.ran_at).toUTCString()}
                {r.error && <span style={{ color: 'var(--red)' }}> · {r.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RetentionRow({
  categoryKey,
  defaultDays,
  autoDelete,
  saving,
  onSave,
}: {
  categoryKey: string;
  defaultDays: number;
  autoDelete: boolean;
  saving: boolean;
  onSave: (key: string, days: number, autoDelete: boolean) => void;
}) {
  const [days, setDays] = useState(defaultDays);
  const [auto, setAuto] = useState(autoDelete);

  return (
    <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
      <label htmlFor={`days-${categoryKey}`} style={{ fontSize: 13 }}>
        Keep for
      </label>
      <input
        id={`days-${categoryKey}`}
        type="number"
        min={1}
        max={3650}
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{
          width: 100,
          minHeight: 44,
          padding: '8px 10px',
          borderRadius: 'var(--r)',
          border: '1px solid var(--b2)',
          background: 'var(--s1)',
          color: 'var(--t1)',
        }}
      />
      <span style={{ fontSize: 13, color: 'var(--t3)' }}>days</span>

      <label style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', fontSize: 13, minHeight: 44 }}>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Auto-delete past this window
      </label>

      <Btn type="button" onClick={() => onSave(categoryKey, days, auto)} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Btn>
    </div>
  );
}
