'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { sortNotes, type NoteTargetType } from '../lib/admin-notes-core';

type Note = {
  id: string;
  body: string;
  internal: boolean;
  pinned: boolean;
  created_at: string;
  authorName: string;
};

/**
 * Case notes for one target — the reader and writer `admin_notes` never had.
 *
 * Mounted wherever a moderation decision is made, because that is the moment the
 * previous decision's reasoning matters. A trust review done cold, without the
 * note explaining why the last reviewer did what they did, is a coin flip
 * dressed as a process.
 */
export default function AdminNotesPanel({
  targetType,
  targetId,
  title = 'Case notes',
}: {
  targetType: NoteTargetType;
  targetId: string;
  title?: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (alive: () => boolean = () => true) => {
    try {
      const res = await fetch(`/api/admin/notes?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`);
      if (!alive()) return;
      if (!res.ok) { setState('failed'); return; }
      const data = await res.json() as { notes: Note[] };
      if (!alive()) return;
      setNotes(sortNotes(data.notes ?? []));
      setState('ready');
    } catch {
      // A failed read is not "no notes". Showing an empty thread would tell a
      // reviewer there is no history when there may be a pinned warning.
      if (alive()) setState('failed');
    }
  }, [targetType, targetId]);

  // The same shape the other panels in this repo use: an `active` flag rather
  // than a bare `void load()`, so nothing sets state after the panel unmounts
  // when an admin clicks through cases faster than the request returns.
  useEffect(() => {
    let active = true;
    // The async IIFE is the shape the other panels in this repo use, and it is
    // what the react-hooks rule can actually verify: a direct `load()` looks
    // like it might set state during the effect body, even though every write
    // in it sits behind an await.
    void (async () => { await load(() => active); })();
    return () => { active = false; };
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, body: body.trim(), internal }),
      });
      if (res.ok) { setBody(''); await load(); }
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pinned }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', padding: 16, minWidth: 0 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 750, color: 'var(--t1)' }}>{title}</h3>

      <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, marginBottom: 14 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="What should the next reviewer know?"
          aria-label="New note"
          style={{
            width: '100%', minWidth: 0, padding: 10, fontSize: 13.5, fontFamily: 'inherit',
            color: 'var(--t1)', background: 'var(--s2)', border: '1px solid var(--b1)',
            borderRadius: 'var(--r)', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--t2)' }}>
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Internal only
          </label>
          <button type="submit" className="kf-primary" disabled={busy || !body.trim()} style={{ cursor: busy ? 'wait' : 'pointer' }}>
            Add note
          </button>
        </div>
      </form>

      {state === 'loading' && <p style={{ fontSize: 13, color: 'var(--t3)' }}>Loading notes…</p>}
      {state === 'failed' && (
        <p style={{ fontSize: 13, color: 'var(--red-text)' }}>
          Notes could not be loaded. This is not the same as there being none — do
          not treat this case as unreviewed.
        </p>
      )}
      {state === 'ready' && notes.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>No notes on this yet.</p>
      )}

      {state === 'ready' && notes.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
          {notes.map((note) => (
            <li
              key={note.id}
              style={{
                padding: 11, borderRadius: 'var(--r)', minWidth: 0,
                border: `1px solid ${note.pinned ? 'var(--brand-text)' : 'var(--b1)'}`,
                background: 'var(--s2)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 5 }}>
                <strong style={{ fontSize: 12.5, color: 'var(--t1)' }}>{note.authorName}</strong>
                <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>
                  {new Date(note.created_at).toLocaleString()}
                </span>
                {note.pinned && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-text)' }}>PINNED</span>}
                {!note.internal && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green-text)' }}>SHARED</span>}
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--t2)', margin: '0 0 7px', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                {note.body}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => void togglePin(note.id, !note.pinned)} disabled={busy} style={linkButton('var(--brand-text)')}>
                  {note.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button type="button" onClick={() => void remove(note.id)} disabled={busy} style={linkButton('var(--red-text)')}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const linkButton = (color: string): React.CSSProperties => ({
  fontSize: 11.5, fontWeight: 600, color, background: 'none', border: 'none',
  padding: 0, cursor: 'pointer', textDecoration: 'underline',
});
