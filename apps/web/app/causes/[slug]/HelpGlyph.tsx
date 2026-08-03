import type { HelpIcon } from '../../../lib/causes';

/**
 * The glyph inside a "how your support helps" badge.
 *
 * ── Why this is a component and not five hearts ──────────────────────────────
 *
 * The block previously drew the SAME heart on every card and varied only the
 * badge colour. That reads as decoration rather than meaning: five identical
 * shapes tell a visitor nothing about which card is about equipment and which
 * is about coaching, so the colour was doing work colour cannot do on its own
 * (and cannot do at all for a reader who does not perceive it).
 *
 * Each glyph is inline SVG on a shared 24×24 grid with `currentColor`, so the
 * badge keeps colouring it through `.cl-helps-ic--N` and the block still ships
 * no font and no image request.
 *
 * `aria-hidden` is applied by the CALLER, on the badge that wraps this — the
 * card's own <h3> already names the thing, so announcing the icon would repeat
 * it. Keeping the attribute on the wrapper means there is exactly one place
 * that decision is made.
 */
const PATHS: Record<HelpIcon, React.ReactNode> = {
  // A jersey — kit and equipment.
  gear: <path d="M8.5 3 5 4.8 3.4 8.4l2.7 1.2.9-1.6V21h10V8l.9 1.6 2.7-1.2L18.5 3 15 4.3a3.2 3.2 0 0 1-6 0L8.5 3Z" />,
  // A whistle — coaching.
  coach: (
    <>
      <path d="M10.5 9.5H21l-1.6 4.8A6 6 0 1 1 10.5 9.5Z" />
      <path d="M13.5 3.5v4" />
      <circle cx="7.5" cy="14.5" r="1.6" />
    </>
  ),
  // A figure mid-stride — chances to play.
  run: (
    <>
      <circle cx="15" cy="4.2" r="1.9" />
      <path d="M13.4 21l1.7-5.3-3.1-2.6.9-4.6 3.1 3.2 3.1.8" />
      <path d="M12.9 8.5 9.4 9.9 8 13.1" />
      <path d="m11.9 13.1-3.4 1.2L6 20.6" />
    </>
  ),
  // Three figures — belonging.
  community: (
    <>
      <path d="M16.5 20.5v-1.7a3.4 3.4 0 0 0-3.4-3.4H6.9a3.4 3.4 0 0 0-3.4 3.4v1.7" />
      <circle cx="10" cy="8.1" r="3.4" />
      <path d="M20.5 20.5v-1.7a3.4 3.4 0 0 0-2.6-3.3M15.6 4.9a3.4 3.4 0 0 1 0 6.4" />
    </>
  ),
  // A mortarboard — life beyond the season.
  learn: (
    <>
      <path d="M21.5 8.6 12 4 2.5 8.6 12 13.2l9.5-4.6Z" />
      <path d="M6.6 10.9v5.2c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-5.2" />
    </>
  ),
  // A bowl — a meal.
  food: (
    <>
      <path d="M3 11.4h18a9 9 0 0 1-9 8.1 9 9 0 0 1-9-8.1Z" />
      <path d="M8.6 8.2c0-1.5 1.3-1.9 1.3-3.2M12 8.2c0-1.5 1.3-1.9 1.3-3.2M15.4 8.2c0-1.5 1.3-1.9 1.3-3.2" />
    </>
  ),
  // A house — somewhere to sleep.
  home: (
    <>
      <path d="M3.5 10.4 12 3.6l8.5 6.8" />
      <path d="M5.6 12v8.4h12.8V12" />
      <path d="M10 20.4v-5h4v5" />
    </>
  ),
  // A cross in a shield — treatment and care.
  health: (
    <>
      <path d="M12 3.2 4.6 6v6.1c0 4.3 3.1 7.6 7.4 8.7 4.3-1.1 7.4-4.4 7.4-8.7V6L12 3.2Z" />
      <path d="M12 8.6v6.2M8.9 11.7h6.2" />
    </>
  ),
  // Hands under a heart — dignity after a loss.
  hope: (
    <>
      <path d="M18.3 5.1a4.3 4.3 0 0 0-6.1 0l-.2.2-.2-.2a4.3 4.3 0 1 0-6.1 6.1l6.3 6.2 6.3-6.2a4.3 4.3 0 0 0 0-6.1Z" />
      <path d="M4 20.4h16" />
    </>
  ),
};

/** Falls back to the heart when a cause names no icon. */
export default function HelpGlyph({ icon }: { icon?: HelpIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[icon ?? 'hope']}
    </svg>
  );
}
