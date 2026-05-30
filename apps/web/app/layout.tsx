import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';
import SessionWatcher from '../components/SessionWatcher';

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Watches for session expiry and signs out when the browser closes */}
        <SessionWatcher />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
