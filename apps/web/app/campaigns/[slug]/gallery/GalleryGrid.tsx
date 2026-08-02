'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  filterGallery,
  countGallery,
  type GalleryFilter,
  type GalleryItem,
} from '../../../../lib/campaign-gallery-core';

/**
 * The gallery grid, its type tabs, and a keyboard-operable lightbox.
 *
 * `items === null` means the read FAILED and renders differently from an empty
 * gallery — a database outage must not read as "this organiser never posted a
 * photo", which is a confident claim about someone else's work.
 */
export default function GalleryGrid({
  items,
  campaignSlug,
}: {
  items: GalleryItem[] | null;
  campaignSlug: string;
}) {
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  const counts = useMemo(() => countGallery(items ?? []), [items]);
  const shown = useMemo(() => filterGallery(items ?? [], filter), [items, filter]);
  // Only items that can actually be displayed are reachable from the lightbox.
  const viewable = useMemo(() => shown.filter((i) => i.url && i.kind === 'image'), [shown]);

  // Escape closes; arrows move between images. A lightbox without these is a
  // trap for anyone not using a mouse.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
      if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? null : (i + 1) % viewable.length));
      if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? null : (i - 1 + viewable.length) % viewable.length));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openIndex, viewable.length]);

  // Move focus INTO the dialog on open and back to the trigger on close.
  // Without this a keyboard user opens the lightbox and their focus is still
  // behind it, on a page they can no longer see.
  useEffect(() => {
    if (openIndex !== null) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
    } else {
      lastFocused.current?.focus();
    }
  }, [openIndex]);

  if (items === null) {
    return (
      <div role="alert" style={{ padding: 24, borderRadius: 'var(--rl)', border: '1px solid var(--b1)', background: 'var(--tint-amber, var(--s2))' }}>
        <h2 style={{ fontSize: 16, fontWeight: 750, color: 'var(--t1)', margin: '0 0 6px' }}>
          We could not load the gallery
        </h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
          This is a problem on our side, not a sign that the campaign has no photos. Please refresh in a
          moment — the campaign page itself is still available.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 32, borderRadius: 'var(--rl)', border: '1px dashed var(--b2)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 17, fontWeight: 750, color: 'var(--t1)', margin: '0 0 8px' }}>No media yet</h2>
        <p style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto' }}>
          The organiser has not posted photos or videos for this campaign. Media usually appears once a
          campaign is underway and there is progress to show.
        </p>
        <a href={`/campaigns/${campaignSlug}`} className="cta-primary" style={{ display: 'inline-flex', marginTop: 18 }}>
          Back to the campaign
        </a>
      </div>
    );
  }

  const TABS: { key: GalleryFilter; label: string; n: number }[] = [
    { key: 'all', label: 'All', n: counts.all },
    { key: 'image', label: 'Photos', n: counts.image },
    { key: 'video', label: 'Videos', n: counts.video },
    { key: 'document', label: 'Documents', n: counts.document },
  ];

  return (
    <>
      {/* Real tabs: a tablist with roving selection, not styled links. */}
      <div role="tablist" aria-label="Media type" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {TABS.filter((t) => t.n > 0 || t.key === 'all').map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(tab.key)}
              style={{
                minHeight: 40, padding: '0 16px', borderRadius: 999,
                border: `1px solid ${active ? 'transparent' : 'var(--b2)'}`,
                background: active ? 'var(--fill-brand)' : 'var(--s1)',
                color: active ? '#fff' : 'var(--t2)',
                font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {tab.label} ({tab.n})
            </button>
          );
        })}
      </div>

      {/* The unavailable count is stated plainly rather than hidden. Quietly
          dropping these rows would make the gallery look complete while the
          organiser wonders where their uploads went. */}
      {counts.unavailable > 0 && (
        <p
          style={{
            fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.6, margin: '0 0 18px',
            padding: '12px 14px', borderRadius: 'var(--r)',
            border: '1px solid var(--b1)', background: 'var(--s2)',
          }}
        >
          <strong style={{ color: 'var(--t1)' }}>{counts.unavailable}</strong> of {counts.all} item
          {counts.all === 1 ? '' : 's'} could not be loaded — the stored file is missing. The captions are
          shown so nothing is silently dropped.
        </p>
      )}

      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Showing {shown.length} of {counts.all} items
      </span>

      <ul
        style={{
          listStyle: 'none', margin: 0, padding: 0, display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 16,
        }}
      >
        {shown.map((item) => {
          const viewIndex = viewable.findIndex((v) => v.id === item.id);
          return (
            <li key={item.id} style={{ minWidth: 0 }}>
              <figure
                style={{
                  margin: 0, border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
                  overflow: 'hidden', background: 'var(--s1)', height: '100%',
                  display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)',
                }}
              >
                {item.url && item.kind === 'image' ? (
                  <button
                    type="button"
                    onClick={() => setOpenIndex(viewIndex)}
                    aria-label={`View larger: ${item.alt}`}
                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt}
                      loading="lazy"
                      style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }}
                    />
                  </button>
                ) : item.url && item.kind === 'video' ? (
                  <video
                    src={item.url}
                    controls
                    preload="metadata"
                    style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', background: '#000' }}
                  >
                    <track kind="captions" />
                  </video>
                ) : item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      aspectRatio: '4 / 3', background: 'var(--s2)', color: 'var(--brand-text)',
                      fontSize: 14, fontWeight: 700, textDecoration: 'none',
                    }}
                  >
                    Open document →
                  </a>
                ) : (
                  // Not a broken <img>, and deliberately not a stock substitute.
                  <div
                    role="img"
                    aria-label={`Media unavailable: ${item.alt}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      aspectRatio: '4 / 3', background: 'var(--s3)', color: 'var(--t3)',
                      fontSize: 13, textAlign: 'center', padding: 16,
                    }}
                  >
                    File unavailable
                  </div>
                )}
                <figcaption style={{ padding: '12px 14px', fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.55 }}>
                  {item.caption ?? item.alt}
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>

      {openIndex !== null && viewable[openIndex] && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={viewable[openIndex].alt}
          tabIndex={-1}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          {/* Click-to-dismiss lives on its own BUTTON rather than on the dialog
              container. A click handler on a plain <div> is invisible to keyboard
              and assistive tech — the Escape handler above covers keyboards, but
              the element itself still has to be a real control. tabIndex={-1}
              keeps it out of the tab order, where the labelled ✕ below is the
              affordance a keyboard user should actually reach. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpenIndex(null)}
            style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', cursor: 'zoom-out' }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewable[openIndex].url as string}
            alt={viewable[openIndex].alt}
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', position: 'relative' }}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpenIndex(null); }}
            aria-label="Close"
            style={{
              position: 'absolute', top: 16, right: 16, minWidth: 44, minHeight: 44,
              borderRadius: 999, border: '1px solid rgba(255,255,255,.4)',
              background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 20, cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <p style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 14, margin: 0, padding: '0 24px' }}>
            {viewable[openIndex].caption ?? viewable[openIndex].alt}
            {viewable.length > 1 && (
              <span style={{ opacity: 0.7 }}> · {openIndex + 1} of {viewable.length} · use ← → to browse</span>
            )}
          </p>
        </div>
      )}
    </>
  );
}
