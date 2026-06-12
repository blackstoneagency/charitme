'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const PERIOD_LABELS: Record<string, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
};

const PERIOD_KEYS = Object.keys(PERIOD_LABELS);

export default function PeriodSelect({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const activeLabel = PERIOD_LABELS[current] ?? PERIOD_LABELS['7d'];

  return (
    <div className="campaign-sort-wrap" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {activeLabel} <span>v</span>
      </button>
      {open && (
        <div className="campaign-sort-dropdown" role="menu">
          {PERIOD_KEYS.map(key => (
            <button
              key={key}
              type="button"
              role="menuitem"
              className={key === current ? 'active' : ''}
              onClick={() => {
                setOpen(false);
                router.push(`/dashboard?period=${key}`);
              }}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
