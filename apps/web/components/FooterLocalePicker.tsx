'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MARKET_LOCALE,
  MARKET_LOCALES,
  resolveMarketLocale,
  type MarketLocale,
} from '../lib/i18n';

/**
 * The locale control in the footer's bottom bar: a collapsed
 * "🇺🇸 United States · English" trigger that opens the full market list.
 *
 * Implemented as a listbox rather than a <select> because the design shows the
 * flag, the country and the language in the collapsed state and self-names in
 * the open state — a native select renders one text label and cannot do both.
 * That trade means the keyboard and ARIA behaviour a select gives for free has
 * to be built: arrow keys, Home/End, Escape, focus return to the trigger.
 *
 * `initialLocale` comes from the request cookie, read server-side in the root
 * layout. There is deliberately no client-side cookie fallback: the layout
 * already reads headers() for the CSP nonce, so it is never statically cached
 * and the value is always available at render — a hydration-time re-read would
 * be a second source of truth that can only disagree with the first.
 */
export default function FooterLocalePicker({ initialLocale }: { initialLocale?: string }) {
  const [current, setCurrent] = useState<MarketLocale>(
    () => resolveMarketLocale(initialLocale ?? DEFAULT_MARKET_LOCALE),
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Move real focus with the active option so screen readers announce it and
  // the visible focus ring tracks the keyboard.
  //
  // `block: 'nearest'` also drags the menu into view on a short viewport. The
  // menu opens upward from a trigger at the foot of the page, so its height is
  // bounded by the space above that trigger; without this, a tall list is
  // clipped off the top of the screen. Narrow screens additionally switch to a
  // viewport-anchored bottom sheet in CSS, where clipping cannot happen at all.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus({ preventScroll: false });
  }, [open, activeIndex]);

  const openList = useCallback(() => {
    const index = Math.max(0, MARKET_LOCALES.findIndex((l) => l.tag === current.tag));
    setActiveIndex(index);
    setOpen(true);
  }, [current.tag]);

  const closeList = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(async (locale: MarketLocale) => {
    const previous = current;
    setCurrent(locale);       // optimistic — the picker should feel instant
    setSaving(true);
    closeList();
    try {
      const res = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: locale.tag }),
      });
      // Revert on rejection rather than leaving the trigger showing a choice the
      // server refused — a picker that lies about its own state is the bug this
      // guards against.
      if (!res.ok) setCurrent(previous);
    } catch {
      setCurrent(previous);
    } finally {
      setSaving(false);
    }
  }, [current, closeList]);

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const last = MARKET_LOCALES.length - 1;
    switch (event.key) {
      case 'Escape':    event.preventDefault(); closeList(); break;
      case 'ArrowDown': event.preventDefault(); setActiveIndex((i) => (i >= last ? 0 : i + 1)); break;
      case 'ArrowUp':   event.preventDefault(); setActiveIndex((i) => (i <= 0 ? last : i - 1)); break;
      case 'Home':      event.preventDefault(); setActiveIndex(0); break;
      case 'End':       event.preventDefault(); setActiveIndex(last); break;
      case 'Tab':       setOpen(false); break;   // let focus leave naturally
      default: break;
    }
  };

  return (
    <div className="foot-locale" ref={wrapRef}>
      {/* Roving tabindex, not aria-activedescendant: real DOM focus moves to the
          active option (see the effect above), so the focused element IS the
          active one. Declaring both would be contradictory, and it is what the
          a11y linter flags — the container never holds focus itself. */}
      {open && (
        <ul
          className="foot-locale-menu"
          role="listbox"
          aria-label="Choose a country and language"
          onKeyDown={onListKeyDown}
        >
          {MARKET_LOCALES.map((locale, index) => {
            const selected = locale.tag === current.tag;
            return (
              <li key={locale.tag} role="none">
                <button
                  type="button"
                  id={`locale-opt-${locale.tag}`}
                  role="option"
                  aria-selected={selected}
                  tabIndex={index === activeIndex ? 0 : -1}
                  ref={(node) => { optionRefs.current[index] = node; }}
                  className={selected ? 'foot-locale-opt is-selected' : 'foot-locale-opt'}
                  onClick={() => void choose(locale)}
                  onFocus={() => setActiveIndex(index)}
                >
                  <span aria-hidden="true" className="foot-locale-flag">{locale.flag}</span>
                  <span>{locale.nativeLabel}</span>
                  {selected && <span className="foot-locale-check" aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        ref={triggerRef}
        className="foot-locale-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); openList(); }
        }}
      >
        <span aria-hidden="true" className="foot-locale-flag">{current.flag}</span>
        <span className="foot-locale-country">{current.countryName}</span>
        <span className="foot-locale-dot" aria-hidden="true">·</span>
        <span className="foot-locale-lang">{current.languageName}</span>
        {/* The trigger's visible text is the country and language, which alone
            reads as a statement rather than a control. */}
        <span className="sr-only">
          — change country and language, currently {current.nativeLabel}
          {saving ? ', saving' : ''}
        </span>
      </button>
    </div>
  );
}
