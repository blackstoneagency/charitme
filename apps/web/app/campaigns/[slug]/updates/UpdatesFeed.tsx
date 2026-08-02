'use client';

import { useMemo, useState } from 'react';
import {
  applyFilter,
  excerpt,
  publicDate,
  type CampaignUpdateRow,
  type UpdateFilter,
} from '../../../../lib/campaign-updates-core';

/**
 * The updates list, with the design's filter dropdown and progressive disclosure.
 *
 * Client-side because the filter and expand/collapse are pure view state over
 * data the server already sent — round-tripping to the server for either would
 * add a network wait to a control that should feel instant, and the whole feed is
 * capped at 100 rows.
 *
 * `updates === null` means the READ FAILED and is rendered differently from an
 * empty array. Collapsing the two is how a database outage comes to read as
 * "this organiser has never posted an update" — a confident, wrong statement
 * about someone else's work.
 */
export default function UpdatesFeed({
  updates,
  campaignSlug,
}: {
  updates: CampaignUpdateRow[] | null;
  campaignSlug: string;
}) {
  const [filter, setFilter] = useState<UpdateFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const shown = useMemo(() => (updates ? applyFilter(updates, filter) : []), [updates, filter]);

  if (updates === null) {
    return (
      <div
        role="alert"
        style={{
          padding: 24, borderRadius: 'var(--rl)', border: '1px solid var(--b1)',
          background: 'var(--tint-amber, var(--s2))',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 750, color: 'var(--t1)', margin: '0 0 6px' }}>
          We could not load updates just now
        </h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
          This is a problem on our side, not a sign that the campaign has gone quiet. Please refresh in a
          moment — the campaign page itself is still available.
        </p>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div style={{ padding: 32, borderRadius: 'var(--rl)', border: '1px dashed var(--b2)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 17, fontWeight: 750, color: 'var(--t1)', margin: '0 0 8px' }}>No updates yet</h2>
        <p style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
          The organiser has not posted a progress report yet. Updates appear here as the campaign reaches
          milestones — donating or following the campaign is the best way to hear about the first one.
        </p>
        <a
          href={`/campaigns/${campaignSlug}`}
          className="cta-primary"
          style={{ display: 'inline-flex', marginTop: 18 }}
        >
          Back to the campaign
        </a>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <label htmlFor="cu-filter" style={{ fontSize: 13, fontWeight: 650, color: 'var(--t2)' }}>
          Show
        </label>
        <select
          id="cu-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as UpdateFilter)}
          style={{
            minHeight: 40, padding: '0 12px', borderRadius: 'var(--r)',
            border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)',
            font: 'inherit', fontSize: 14,
          }}
        >
          <option value="all">All updates</option>
          <option value="recent">Last 30 days</option>
          <option value="milestones">Milestones</option>
        </select>
        {/* aria-live so a filter change is ANNOUNCED, not just visible. Changing a
            select and having the page silently reflow is the classic screen-reader
            dead end. */}
        <span role="status" aria-live="polite" style={{ fontSize: 13, color: 'var(--t3)' }}>
          {shown.length} of {updates.length} update{updates.length === 1 ? '' : 's'}
        </span>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: 24, borderRadius: 'var(--rl)', border: '1px dashed var(--b2)' }}>
          <p style={{ fontSize: 14, color: 'var(--t2)', margin: 0, lineHeight: 1.6 }}>
            No updates match this filter. {filter === 'milestones'
              ? 'Milestones are updates the organiser titled around reaching a goal or completing a stage.'
              : 'Try “All updates” to see everything posted so far.'}
          </p>
        </div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
          {shown.map((update) => {
            const body = (update.body ?? '').trim();
            const short = excerpt(body);
            const isLong = body.length > short.length;
            const open = expanded.has(update.id);
            const date = new Date(publicDate(update));
            return (
              <li
                key={update.id}
                id={`update-${update.id}`}
                style={{
                  border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
                  background: 'var(--s1)', padding: 20, minWidth: 0,
                }}
              >
                <article>
                  <header style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: 17, fontWeight: 750, color: 'var(--t1)', margin: 0, lineHeight: 1.35, minWidth: 0 }}>
                      {update.title || 'Campaign update'}
                    </h2>
                    <time
                      dateTime={date.toISOString()}
                      style={{ fontSize: 12.5, color: 'var(--t3)', whiteSpace: 'nowrap' }}
                    >
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </time>
                  </header>

                  {body && (
                    <p style={{ fontSize: 14.5, color: 'var(--t2)', lineHeight: 1.7, margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>
                      {open ? body : short}
                    </p>
                  )}

                  {isLong && (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`update-${update.id}`}
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(update.id)) next.delete(update.id);
                          else next.add(update.id);
                          return next;
                        })
                      }
                      style={{
                        marginTop: 12, minHeight: 40, padding: '0 14px',
                        border: '1px solid var(--b2)', borderRadius: 'var(--r)',
                        background: 'var(--s2)', color: 'var(--t1)',
                        font: 'inherit', fontSize: 13.5, fontWeight: 650, cursor: 'pointer',
                      }}
                    >
                      {open ? 'Show less' : 'Read full update'}
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
