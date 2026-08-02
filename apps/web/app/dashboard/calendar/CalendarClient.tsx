'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, EmptyState, Badge } from '../../../components/ui';

export type CalendarEntry = {
  id: string;
  kind: 'deadline' | 'event' | 'grant';
  title: string;
  /** ISO date or timestamp. */
  date: string;
  endDate?: string | null;
  href: string;
};

const KIND_LABEL: Record<CalendarEntry['kind'], string> = {
  deadline: 'Campaign deadline',
  event: 'Event',
  grant: 'Grant date',
};

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function CalendarClient({
  entries,
  failedSources,
  nowIso,
}: {
  entries: CalendarEntry[];
  failedSources: string[];
  /** Request time from the server. Calling Date.now() during render is impure
   *  (the React compiler rejects it) and would also let the server and client
   *  disagree about which entries are past. */
  nowIso: string;
}) {
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const now = new Date(nowIso).getTime();
    const up: CalendarEntry[] = [];
    const pa: CalendarEntry[] = [];
    for (const e of entries) {
      // An entry with an end date is still "upcoming" while it is running.
      const effective = new Date(e.endDate ?? e.date).getTime();
      (effective >= now ? up : pa).push(e);
    }
    return { upcoming: up, past: pa.reverse() };
  }, [entries, nowIso]);

  const grouped = useMemo(() => {
    const list = showPast ? past : upcoming;
    const groups = new Map<string, CalendarEntry[]>();
    for (const e of list) {
      const key = monthKey(new Date(e.date));
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()];
  }, [showPast, upcoming, past]);

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 860 }}>
      {/* Naming the specific source that failed, rather than blanking the page
          or — worse — showing the remaining entries as if they were all of
          them. An incomplete calendar that looks complete is the failure mode
          this repo keeps finding. */}
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
          <strong style={{ color: 'var(--t1)' }}>Some dates couldn&apos;t be loaded.</strong>{' '}
          {failedSources.join(' and ')} failed to load, so this view is incomplete. Anything below is
          accurate — it just isn&apos;t everything.
        </div>
      )}

      <div style={{ display: 'flex', minWidth: 0, gap: 8 }} role="group" aria-label="Which dates to show">
        {([['Upcoming', false], ['Past', true]] as const).map(([label, val]) => (
          <button
            key={label}
            type="button"
            onClick={() => setShowPast(val)}
            aria-pressed={showPast === val}
            style={{
              minHeight: 44,
              padding: '8px 16px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--b2)',
              background: showPast === val ? 'var(--s3)' : 'transparent',
              color: 'var(--t1)',
              fontWeight: showPast === val ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {label} ({val ? past.length : upcoming.length})
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title={showPast ? 'Nothing in the past' : 'Nothing coming up'}
          body={
            showPast
              ? 'Past deadlines and events will appear here.'
              : 'Campaign deadlines, events and grant dates appear here automatically.'
          }
        />
      ) : (
        grouped.map(([key, list]) => (
          <Card key={key}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>{monthLabel(key)}</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
              {list.map((e) => {
                const d = new Date(e.date);
                return (
                  <li
                    key={e.id}
                    style={{
                      display: 'flex', minWidth: 0,
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 0',
                      borderTop: '1px solid var(--b1)',
                    }}
                  >
                    <time
                      dateTime={e.date}
                      style={{
                        flex: '0 0 56px',
                        textAlign: 'center',
                        fontWeight: 700,
                        color: 'var(--t1)',
                        lineHeight: 1.1,
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 20 }}>{d.getUTCDate()}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--t3)' }}>
                        {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                      </span>
                    </time>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <Link
                        href={e.href}
                        style={{ color: 'var(--t1)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
                      >
                        {e.title}
                      </Link>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t3)' }}>
                        {KIND_LABEL[e.kind]}
                      </p>
                    </div>
                    <Badge>{KIND_LABEL[e.kind]}</Badge>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
