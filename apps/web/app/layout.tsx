import type { Metadata, Viewport } from 'next';
import { DEFAULT_OG_IMAGE } from '../lib/public-routes';
import { headers } from 'next/headers';
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
};

export const viewport: Viewport = {
  themeColor: '#6d35ff',
  width: 'device-width',
  initialScale: 1,
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
