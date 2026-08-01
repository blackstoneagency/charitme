'use client';

import { useMemo, useState } from 'react';
import { Btn, Input, Card, EmptyState, Select } from '../../../components/ui';
import DegradedReadNotice from '../../../components/DegradedReadNotice';

export type Task = {
  id: string;
  owner_id: string;
  campaign_id: string | null;
  assignee_id: string | null;
  title: string;
  notes: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  due_at: string | null;
  completed_at: string | null;
};

export type CampaignOption = { id: string; title: string; slug: string };

type Filter = 'all' | 'mine' | 'assigned' | 'open' | 'done' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'mine', label: 'Mine' },
  { id: 'assigned', label: 'Assigned to me' },
  { id: 'done', label: 'Completed' },
];

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  high: 'var(--red)',
  medium: 'var(--blue)',
  low: 'var(--t3)',
};

export default function TasksClient({
  initialTasks,
  campaigns,
  currentUserId,
  nowIso = new Date().toISOString(),
}: {
  initialTasks: Task[] | null;
  campaigns: CampaignOption[];
  currentUserId: string;
  nowIso?: string;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
  const [filter, setFilter] = useState<Filter>('open');
  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const counts = useMemo(() => {
    const now = new Date(nowIso).getTime();
    return {
      all: tasks.length,
      open: tasks.filter((t) => t.status !== 'done').length,
      overdue: tasks.filter((t) => t.status !== 'done' && t.due_at && new Date(t.due_at).getTime() < now).length,
      mine: tasks.filter((t) => t.owner_id === currentUserId).length,
      assigned: tasks.filter((t) => t.assignee_id === currentUserId).length,
      done: tasks.filter((t) => t.status === 'done').length,
    } as Record<Filter, number>;
  }, [tasks, currentUserId, nowIso]);

  const visible = useMemo(() => {
    const now = new Date(nowIso).getTime();
    return tasks.filter((t) => {
      switch (filter) {
        case 'open': return t.status !== 'done';
        case 'overdue': return t.status !== 'done' && !!t.due_at && new Date(t.due_at).getTime() < now;
        case 'mine': return t.owner_id === currentUserId;
        case 'assigned': return t.assignee_id === currentUserId;
        case 'done': return t.status === 'done';
        default: return true;
      }
    });
  }, [tasks, filter, currentUserId, nowIso]);

  if (initialTasks === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="We couldn't load your tasks">
          This is a problem reading the database, not a sign your tasks were deleted. If this is a
          new deploy, the <code>20260821000000_tasks</code> migration may not be applied yet.
        </DegradedReadNotice>
      </div>
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority,
          campaignId: campaignId || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const data: { task?: Task; error?: string } = await res.json();
      if (!res.ok || !data.task) throw new Error(data.error ?? 'Could not create the task');
      setTasks((prev) => [data.task as Task, ...prev]);
      setTitle('');
      setDueAt('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(task: Task, status: Task['status']) {
    setErr('');
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data: { task?: Task; error?: string } = await res.json();
    if (res.ok && data.task) setTasks((prev) => prev.map((t) => (t.id === task.id ? (data.task as Task) : t)));
    else setErr(data.error ?? 'Could not update the task');
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
    else {
      const data: { error?: string } = await res.json().catch(() => ({}));
      setErr(data.error ?? 'Could not delete the task');
    }
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gap: 20, maxWidth: 880 }}>
      {err && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 14, margin: 0 }}>
          {err}
        </p>
      )}

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Add a task</h2>
        <form onSubmit={create} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 240px', minWidth: 0 }}>
            <label htmlFor="t-title" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Task
            </label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Send thank-you notes to major donors"
              maxLength={200}
              required
            />
          </div>
          {campaigns.length > 0 && (
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <label htmlFor="t-campaign" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                Campaign
              </label>
              <Select id="t-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div style={{ flex: '0 1 130px' }}>
            <label htmlFor="t-priority" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Priority
            </label>
            <Select
              id="t-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <div style={{ flex: '0 1 180px' }}>
            <label htmlFor="t-due" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Due
            </label>
            <Input id="t-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <Btn type="submit" disabled={busy || title.trim().length === 0}>
            Add
          </Btn>
        </form>
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filter tasks">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            style={{
              minHeight: 44,
              padding: '8px 14px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--b2)',
              background: filter === f.id ? 'var(--s3)' : 'transparent',
              color: 'var(--t1)',
              fontWeight: filter === f.id ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No tasks yet' : 'Nothing here'}
          body={filter === 'all' ? 'Add one above to get started.' : 'Try a different filter.'}
        />
      ) : (
        <Card>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {visible.map((t) => {
              const overdue = t.status !== 'done' && t.due_at && new Date(t.due_at).getTime() < new Date(nowIso).getTime();
              const canEdit = t.owner_id === currentUserId;
              return (
                <li
                  key={t.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    border: '1px solid var(--b2)',
                    borderRadius: 'var(--r)',
                    padding: 12,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={(e) => setStatus(t, e.target.checked ? 'done' : 'todo')}
                      aria-label={`Mark "${t.title}" ${t.status === 'done' ? 'not done' : 'done'}`}
                    />
                  </label>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--t1)',
                        textDecoration: t.status === 'done' ? 'line-through' : 'none',
                      }}
                    >
                      {t.title}
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: overdue ? 'var(--red)' : 'var(--t3)' }}>
                      <span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 700 }}>{t.priority}</span>
                      {t.due_at && ` · due ${new Date(t.due_at).toLocaleDateString('en-US')}`}
                      {overdue && ' · overdue'}
                      {!canEdit && ' · assigned to you'}
                    </p>
                  </div>
                  {canEdit && (
                    <Btn type="button" variant="secondary" onClick={() => remove(t.id)}>
                      Delete
                    </Btn>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
