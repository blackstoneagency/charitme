import type { Metadata, Viewport } from 'next';
import { DEFAULT_OG_IMAGE } from '../lib/public-routes';
import { headers } from 'next/headers';
import { SESSION_HINT_HEADER } from '../middleware';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import './globals.css';
import { AppShell } from '../components/AppShell';
import { getActiveAnnouncements } from '../lib/announcements-data';
import { getBannerSettings } from '../lib/banner-settings';
import { getFooterSettings } from '../lib/footer-settings';
import { LOCALE_COOKIE } from '../lib/i18n';
import SessionWatcher from '../components/SessionWatcher';
import { ThemeProvider } from '../components/ThemeProvider';
import { LocaleProvider } from '../components/LocaleProvider';
import { getLocaleTag } from '../lib/locale-server';
import PWARegister from '../components/PWARegister';
import InstallPrompt from '../components/InstallPrompt';
import BackToTop from '../components/BackToTop';
import MarketingTracker from '../components/MarketingTracker';
import { safeJsonLd } from '../lib/json-ld';
import { CHARITME_ORIGIN } from '../lib/public-routes';
import { getMaintenanceStatus } from '../lib/maintenance-data';
import { isMaintenanceBypassPath } from '../lib/maintenance-mode';

export const metadata: Metadata = {
  title: { default: 'CharitMe | Raise More Faster With AI', template: '%s | CharitMe' },
  description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees. Raise more with your personal AI fundraising team.',
  keywords: ['AI fundraising platform', 'GoFundMe alternative', 'free fundraising website', 'nonprofit fundraising software', 'AI donation platform', 'peer-to-peer fundraising', 'fundraising with AI', 'online fundraiser'],
  openGraph: {
    images: [{ url: DEFAULT_OG_IMAGE }],
    siteName: 'CharitMe',
    url: 'https://www.charitme.com',
    type: 'website',
  },
  metadataBase: new URL('https://www.charitme.com'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CharitMe',
  },
  // `appleWebApp.capable` emits the modern unprefixed `mobile-web-app-capable`
  // only. Older iOS reads the `apple-` prefixed name, and without it those
  // versions open the installed icon in a Safari chrome instead of standalone.
  // Measured on the served HTML: the prefixed meta was absent entirely.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#6d35ff',
  width: 'device-width',
  initialScale: 1,
  // ⚠️ Edge-to-edge is deliberately NOT enabled here, and that is the fix rather
  // than an omission.
  //
  // My mobile audit reported that every bottom-anchored fixed control sits under
  // the ~34px iOS home indicator, and I opted into edge-to-edge plus insets to
  // "fix" it. That was WRONG, and __tests__/viewport-safe-area.test.ts caught it.
  // The default lays the page out INSIDE the display's safe rectangle, so nothing
  // renders under the home indicator, the notch or the rounded corners, and
  // `env(safe-area-inset-*)` correctly returns 0 because there is nothing to inset
  // past. Opting out makes every edge-anchored and full-bleed element the author's
  // problem at once — so doing it while handling one inset on one element is worse
  // than leaving the default alone.
  //
  // The guard greps this file for the literal setting, so do not spell it out in a
  // comment either: a quoted mention fails the test exactly like a real one.
};

// Inline script runs before React hydration to apply the saved theme with no flash.
// Dark is the default: only an explicit stored 'light' choice yields light mode.
const themeScript = `try{var t=localStorage.getItem('charitme-theme-v2');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){document.documentElement.setAttribute('data-theme','dark')}`;

const platformJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${CHARITME_ORIGIN}/#organization`,
      name: 'CharitMe',
      url: CHARITME_ORIGIN,
      logo: `${CHARITME_ORIGIN}/icons/icon-512.png`,
      description: 'CharitMe is an AI fundraising platform for campaigns, nonprofits, donors, events, grants, sponsorships, matching gifts, and impact reporting.',
      sameAs: [CHARITME_ORIGIN],
    },
    {
      '@type': 'WebSite',
      '@id': `${CHARITME_ORIGIN}/#website`,
      url: CHARITME_ORIGIN,
      name: 'CharitMe',
      publisher: { '@id': `${CHARITME_ORIGIN}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${CHARITME_ORIGIN}/campaigns?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Cached (ISR) fetch — keeps the layout statically generated while putting the
  // banner in the initial HTML so it never injects post-hydration (no layout shift).
  const requestHeaders = await headers();
  const [initialAnnouncements, bannerAppearance, footerSettings, maintenanceStatus] = await Promise.all([
    getActiveAnnouncements(),
    getBannerSettings(),
    getFooterSettings(),
    getMaintenanceStatus(),
  ]);
  const path = requestHeaders.get('x-pathname') ?? '/';
  // Set by middleware from the session lookup it already performs. Read here
  // rather than calling `getUser()` again: this layout wraps every page, and an
  // auth round-trip per public page render would be a real cost for a boolean
  // that has already been computed.
  const hasSession = requestHeaders.get(SESSION_HINT_HEADER) === '1';
  if (maintenanceStatus.enabled && !isMaintenanceBypassPath(path)) redirect('/maintenance');

  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  // Resolved by middleware from the locale cookie or the OS's Accept-Language,
  // so the very first response is already in the visitor's language.
  const locale = await getLocaleTag();
  // Read straight off the request rather than through cookies(), which would opt
  // the whole layout out of static rendering. Absent → the picker adopts the
  // cookie on hydration instead.
  const initialLocale = requestHeaders.get('cookie')
    ?.split('; ').find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return (
    // `lang` must be the resolved locale, not a hardcoded "en": screen readers
    // choose pronunciation from it, and German read with English phonetics is
    // worse than untranslated text.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(platformJsonLd) }} />
      </head>
      <body>
        <LocaleProvider locale={locale}>
        <ThemeProvider>
          {/* Watches for session expiry and signs out when the browser closes */}
          <SessionWatcher />
          <PWARegister />
          <InstallPrompt />
          <Suspense fallback={null}>
            <MarketingTracker />
          </Suspense>
          <AppShell
            hasSession={hasSession}
            initialAnnouncements={initialAnnouncements}
            bannerAppearance={bannerAppearance}
            footerSettings={footerSettings}
            initialLocale={initialLocale}
          >{children}</AppShell>
          {/* Mounted here, not inside AppShell: AppShell short-circuits for
              /dashboard, /admin and /profile, which render their own shell, and
              those pages are the longest ones in the product. BackToTop
              self-excludes the campaign embed widget. */}
          <BackToTop />
        </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
