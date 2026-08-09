import type { HelpIcon } from '../lib/causes';

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
  // A four-up grid — "all categories".
  all: (
    <>
      <rect x="3.4" y="3.4" width="7" height="7" rx="1.6" />
      <rect x="13.6" y="3.4" width="7" height="7" rx="1.6" />
      <rect x="3.4" y="13.6" width="7" height="7" rx="1.6" />
      <rect x="13.6" y="13.6" width="7" height="7" rx="1.6" />
    </>
  ),
  // A leaf — the planet.
  leaf: (
    <>
      <path d="M20 4c0 8.3-4.6 13.4-11.6 13.4A5.4 5.4 0 0 1 3 12c0-5 4.3-8 11-8h6Z" />
      <path d="M4.5 20.5c1.6-4.4 4.6-7.8 8.5-9.6" />
    </>
  ),
  // A capsule — prescriptions and the pharmacy counter.
  meds: (
    <>
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
      <path d="M9.6 9.6 14.4 14.4" />
    </>
  ),
  // A wheel and a route — getting to the appointment.
  travel: (
    <>
      <path d="M3.2 16.4h1.4M19.4 16.4h1.4" />
      <path d="M4.6 16.4v-3.6l1.9-4.2h9.2l1.9 4.2v3.6" />
      <circle cx="8" cy="17.4" r="2" />
      <circle cx="16" cy="17.4" r="2" />
      <path d="M10 17.4h4" />
    </>
  ),
  // A hammer and spanner — repairs and rebuilding.
  tools: (
    <>
      <path d="M14.2 6.3a3.6 3.6 0 0 0 4.8 4.6l2.3 2.3-2.3 2.3-2.3-2.3a3.6 3.6 0 0 0-4.6-4.8l2.1-2.1Z" />
      <path d="M9.4 3.6 3.6 9.4l2.4 2.4 5.8-5.8-2.4-2.4Z" />
      <path d="m6.8 12.6 4.8 4.8-2.9 2.9-4.8-4.8 2.9-2.9Z" />
    </>
  ),
  // An open book — classrooms and reading.
  book: (
    <>
      <path d="M12 6.6C10.4 5.3 8.2 4.6 5 4.6v12.6c3.2 0 5.4.7 7 2 1.6-1.3 3.8-2 7-2V4.6c-3.2 0-5.4.7-7 2Z" />
      <path d="M12 6.6v12.6" />
    </>
  ),
  // A laptop — digital access and skills.
  laptop: (
    <>
      <rect x="4.4" y="5" width="15.2" height="10" rx="1.6" />
      <path d="M2.6 18.4h18.8" />
    </>
  ),
  // A paw — animals in care.
  paw: (
    <>
      <ellipse cx="6.6" cy="10.4" rx="1.9" ry="2.4" />
      <ellipse cx="17.4" cy="10.4" rx="1.9" ry="2.4" />
      <ellipse cx="9.9" cy="6.3" rx="1.8" ry="2.2" />
      <ellipse cx="14.1" cy="6.3" rx="1.8" ry="2.2" />
      <path d="M12 13.2c3 0 4.8 1.9 4.8 3.9S15 20.6 12 20.6s-4.8-1.5-4.8-3.5 1.8-3.9 4.8-3.9Z" />
    </>
  ),
  // A painter's palette — artists at work.
  palette: (
    <>
      <path d="M12 3.4a8.6 8.6 0 0 0 0 17.2c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6h2A4.9 4.9 0 0 0 21 9.8C20.7 6 16.8 3.4 12 3.4Z" />
      <circle cx="7.9" cy="10.2" r="1.1" />
      <circle cx="12" cy="7.6" r="1.1" />
      <circle cx="16.1" cy="10.2" r="1.1" />
    </>
  ),
  // A quaver — performance and music.
  music: (
    <>
      <path d="M9.4 18.2V5.6l9.2-2v12.6" />
      <circle cx="6.9" cy="18.2" r="2.5" />
      <circle cx="16.1" cy="16.2" r="2.5" />
    </>
  ),
  // A medal — competition and achievement.
  medal: (
    <>
      <circle cx="12" cy="14.8" r="5.2" />
      <path d="m8.6 9.8-3-6.4h4.2L12 7.4l2.2-4h4.2l-3 6.4" />
      <path d="M12 12.4v4.8" />
    </>
  ),
  // A droplet — clean water.
  water: <path d="M12 3.2s6 6.1 6 10a6 6 0 0 1-12 0c0-3.9 6-10 6-10Z" />,
  // A handset — crisis lines and the weekly call.
  phone: (
    <path d="M7.4 3.8 9.7 4l1 3.5-2 1.5a11.5 11.5 0 0 0 5.6 5.6l1.5-2 3.5 1 .2 2.3a2 2 0 0 1-2.1 2.2C10.6 18.4 5.6 13.4 5.2 5.9a2 2 0 0 1 2.2-2.1Z" />
  ),
  // A head in profile — mental health.
  mind: (
    <>
      <path d="M15.6 20.6v-2.5c2.6-1 4.4-3.6 4.4-6.5A7.8 7.8 0 0 0 4.6 10a5 5 0 0 0-.6 2.1c0 .8 1.7 1.6 1.7 1.6l1.1.5v2.2h2v4.2" />
      <path d="M11 9.2a2.2 2.2 0 1 1 2.2 2.2v1.4" />
    </>
  ),
  // A flask — research and trials.
  flask: (
    <>
      <path d="M9.6 3.4v5.4L4.9 17a2.2 2.2 0 0 0 1.9 3.3h10.4a2.2 2.2 0 0 0 1.9-3.3l-4.7-8.2V3.4" />
      <path d="M8.6 3.4h6.8" />
      <path d="M7.3 14.2h9.4" />
    </>
  ),
  // A balance — legal aid and rights.
  scales: (
    <>
      <path d="M12 3.6v16.8M6.4 20.4h11.2" />
      <path d="M4 7.6h16" />
      <path d="M7.4 7.8 4.6 13.6h5.6L7.4 7.8Z" />
      <path d="M16.6 7.8l-2.8 5.8h5.6l-2.8-5.8Z" />
    </>
  ),
  // A plain shield — safety and protection.
  shield: <path d="M12 3.2 4.6 6v6.1c0 4.3 3.1 7.6 7.4 8.7 4.3-1.1 7.4-4.4 7.4-8.7V6L12 3.2Z" />,
  // A case — work and livelihood.
  briefcase: (
    <>
      <rect x="3" y="7.6" width="18" height="12" rx="2" />
      <path d="M8.8 7.6V5.8a1.8 1.8 0 0 1 1.8-1.8h2.8a1.8 1.8 0 0 1 1.8 1.8v1.8" />
      <path d="M3 12.8h18" />
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
