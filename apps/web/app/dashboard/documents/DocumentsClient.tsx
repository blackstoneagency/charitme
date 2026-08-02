'use client';

import { useMemo, useState } from 'react';
import { Card, EmptyState, Badge } from '../../../components/ui';

export type DocumentEntry = {
  id: string;
  name: string;
  category: 'Campaign' | 'Verification' | 'Grant';
  context: string | null;
  /** Null when the file is private — verification documents never get a link. */
  url: string | null;
  createdAt: string;
  sensitive: boolean;
};

const CATEGORIES = ['All', 'Campaign', 'Grant', 'Verification'] as const;

export default function DocumentsClient({
  documents,
  failedSources,
}: {
  documents: DocumentEntry[];
  failedSources: string[];
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (category !== 'All' && d.category !== category) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || (d.context ?? '').toLowerCase().includes(q);
    });
  }, [documents, category, query]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: documents.length };
    for (const d of documents) map[d.category] = (map[d.category] ?? 0) + 1;
    return map;
  }, [documents]);

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 900 }}>
      {failedSources.length > 0 && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--b2)',
            borderLeft: '3px solid var(--red)',
            borderRadius: 'var(--r)',
            padding: '12px 14px',
            background: 'var(--s2)',
            fontSize: 14,
            color: 'var(--t2)',
          }}
        >
          <strong style={{ color: 'var(--t1)' }}>Some files couldn&apos;t be loaded.</strong>{' '}
          {failedSources.join(' and ')} failed to load, so this list is incomplete. What you can see
          is accurate — it just isn&apos;t everything.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filter by type">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              style={{
                minHeight: 44,
                padding: '8px 14px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--b2)',
                background: category === c ? 'var(--s3)' : 'transparent',
                color: 'var(--t1)',
                fontWeight: category === c ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {c} ({counts[c] ?? 0})
            </button>
          ))}
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <label htmlFor="doc-search" className="kf-sr-only">
            Search documents
          </label>
          <input
            id="doc-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            style={{
              width: '100%',
              minHeight: 44,
              padding: '10px 12px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--b2)',
              background: 'var(--s1)',
              color: 'var(--t1)',
            }}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={documents.length === 0 ? 'No documents yet' : 'Nothing matches'}
          body={
            documents.length === 0
              ? 'Files you upload to campaigns, grant applications and verification appear here automatically.'
              : 'Try a different search or filter.'
          }
        />
      ) : (
        <Card>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {visible.map((d) => (
              <li
                key={d.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  borderTop: '1px solid var(--b1)',
                  padding: '10px 0',
                }}
              >
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', wordBreak: 'break-word' }}>
                    {d.name}
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t3)' }}>
                    {d.context ? `${d.context} · ` : ''}
                    {new Date(d.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <Badge>{d.category}</Badge>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      minHeight: 44,
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      color: 'var(--violet-ink)',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Open
                  </a>
                ) : (
                  // Identity documents live in a private bucket and are shown
                  // as a record, not a link. Rendering an "Open" that 404s —
                  // or worse, that works — is the failure this avoids.
                  <span style={{ fontSize: 12, color: 'var(--t3)', padding: '0 12px' }}>
                    {d.sensitive ? 'Private' : 'No link'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
