import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';
import { getActiveAnnouncements } from '../lib/announcements-data';
import SessionWatcher from '../components/SessionWatcher';
import { ThemeProvider } from '../components/ThemeProvider';
import PWARegister from '../components/PWARegister';
import InstallPrompt from '../components/InstallPrompt';

export const metadata: Metadata = {
  title: { default: 'CharitMe | Raise More Faster With AI', template: '%s | CharitMe' },
  description: 'Create trusted fundraising campaigns in seconds with CharitMe AI. 0% platform fees. Raise more with your personal AI fundraising team.',
  keywords: ['AI fundraising platform', 'GoFundMe alternative', 'free fundraising website', 'nonprofit fundraising software', 'AI donation platform', 'peer-to-peer fundraising', 'fundraising with AI', 'online fundraiser'],
  openGraph: {
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Cached (ISR) fetch — keeps the layout statically generated while putting the
  // banner in the initial HTML so it never injects post-hydration (no layout shift).
  const initialAnnouncements = await getActiveAnnouncements();
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <ThemeProvider>
          {/* Watches for session expiry and signs out when the browser closes */}
          <SessionWatcher />
          <PWARegister />
          <InstallPrompt />
          <AppShell initialAnnouncements={initialAnnouncements}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
