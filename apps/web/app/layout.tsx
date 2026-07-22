import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';
import SessionWatcher from '../components/SessionWatcher';
import { ThemeProvider } from '../components/ThemeProvider';
import PWARegister from '../components/PWARegister';
import InstallPrompt from '../components/InstallPrompt';
import { safeJsonLd } from '../lib/json-ld';
import { CHARITME_ORIGIN } from '../lib/public-routes';

export const metadata: Metadata = {
  title: { default: 'CharitMe | Raise More Faster With AI', template: '%s | CharitMe' },
  description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees. Raise more with your personal AI fundraising team.',
  keywords: ['AI fundraising platform', 'GoFundMe alternative', 'free fundraising website', 'nonprofit fundraising software', 'AI donation platform', 'peer-to-peer fundraising', 'fundraising with AI', 'online fundraiser'],
  applicationName: 'CharitMe',
  authors: [{ name: 'CharitMe' }],
  creator: 'CharitMe',
  publisher: 'CharitMe',
  category: 'Fundraising software',
  classification: 'Donation platform',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'CharitMe | Raise More Faster With AI',
    description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees. Raise more with your personal AI fundraising team.',
    siteName: 'CharitMe',
    url: CHARITME_ORIGIN,
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'CharitMe AI fundraising platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CharitMe | Raise More Faster With AI',
    description: 'Launch trusted fundraising campaigns and grow donations with AI.',
    images: ['/opengraph-image'],
  },
  metadataBase: new URL(CHARITME_ORIGIN),
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
      description:
        'CharitMe is an AI fundraising platform for campaigns, nonprofits, donors, events, grants, sponsorships, matching gifts, and impact reporting.',
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
    {
      '@type': 'SoftwareApplication',
      '@id': `${CHARITME_ORIGIN}/#app`,
      name: 'CharitMe',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: CHARITME_ORIGIN,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      publisher: { '@id': `${CHARITME_ORIGIN}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(platformJsonLd) }}
        />
      </head>
      <body>
        <ThemeProvider>
          {/* Watches for session expiry and signs out when the browser closes */}
          <SessionWatcher />
          <PWARegister />
          <InstallPrompt />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
