import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CharitMe — Intelligent Fundraising',
    short_name: 'CharitMe',
    description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees.',
    start_url: '/',
    // Pins app identity to '/' explicitly. Without `id`, identity is DERIVED from
    // start_url, so ever changing start_url would mint a second installable app
    // rather than update the installed one.
    id: '/',
    // What opens inside the app frame rather than kicking out to a browser tab.
    // Inferred from `start_url` when absent — which is the same value today, so
    // this changes nothing now. It is stated because Bubblewrap reads it to
    // decide which links the Play Store build claims, and an inferred value is
    // one that can move underneath the Android project without anyone editing it.
    scope: '/',
    lang: 'en-US',
    dir: 'ltr',
    display: 'standalone',
    // ⚠️ This is the SPLASH colour, painted before a byte of the app renders —
    // not decoration. It was `#fbfaff` (near-white) while the app opens DARK:
    // `layout.tsx` sets `data-theme="dark"` unless a stored choice says
    // otherwise, and the dark `--bg` is `#000000`. So every launch of the
    // installed app flashed a white screen and then went black. Matching it to
    // the default theme is what removes the flash.
    background_color: '#000000',
    theme_color: '#6d35ff',
    // `portrait-primary` locked the installed app out of landscape entirely,
    // including on tablets. `portrait` still prefers portrait but permits
    // portrait-secondary, and does not fight a user who rotates the device.
    orientation: 'portrait',
    categories: ['finance', 'social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press shortcuts on the installed icon, and the app actions a Play
    // Store TWA exposes.
    //
    // ⚠️ Every URL here is checked by `__tests__/manifest-contract.test.ts`
    // against the same route list the internal-link audit uses. A shortcut to a
    // 404 is worse than no shortcut: it is a dead control on the home screen,
    // outside the app, where nothing on the site can explain it.
    shortcuts: [
      { name: 'Start a fundraiser', short_name: 'Fundraise', url: '/create/choose-path' },
      { name: 'Browse campaigns', short_name: 'Browse', url: '/campaigns' },
      { name: 'Your dashboard', short_name: 'Dashboard', url: '/dashboard' },
    ],
  };
}
