'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isEmbedRoute } from './AppShell';

const SHOW_AFTER_PX = 400;

/**
 * Floating "back to top" control, mounted once per shell.
 *
 * Three things here are deliberate:
 *
 * 1. **It is not rendered at all until it is useful.** `hidden`/`opacity: 0`
 *    would leave it in the tab order and the accessibility tree, so a keyboard
 *    user near the top of a short page would tab to a button that does nothing
 *    visible.
 *
 * 2. **It moves focus, not just the viewport.** Scrolling alone leaves focus on
 *    a button that is now off-screen, so the next Tab continues from the bottom
 *    of the page — the keyboard user is teleported back to where they started.
 *    Focus goes to the same `#main-content` target the skip link uses.
 *
 * 3. **Smooth scrolling is opt-out.** A full-page scroll animation is exactly
 *    the motion `prefers-reduced-motion` exists to suppress; the query is read
 *    at click time rather than mount so a mid-session preference change is
 *    honoured.
 *
 * Mounted in the root layout rather than in each shell, so it reaches public
 * pages, the dashboard, admin and anything that renders no shell at all. The one
 * exclusions are the campaign embed widget, which runs inside a third-party
 * iframe, and the standalone maintenance screen.
 */
export default function BackToTop() {
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const read = () => {
      frame.current = null;
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    // rAF-throttled: scroll fires far more often than the screen repaints, and
    // this listener runs on every page of the site.
    const onScroll = () => {
      if (frame.current === null) frame.current = window.requestAnimationFrame(read);
    };

    read(); // a reload can restore a scrolled position with no scroll event
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  const toTop = useCallback(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });

    const main = document.getElementById('main-content');
    if (main) {
      // preventScroll so focusing does not fight the smooth scroll above.
      main.focus({ preventScroll: true });
    }
  }, []);

  if (!visible || path === '/maintenance' || isEmbedRoute(path ?? '')) return null;

  return (
    <button type="button" className="back-to-top" onClick={toTop} aria-label="Back to top">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5m-7 7 7-7 7 7" />
      </svg>
    </button>
  );
}
