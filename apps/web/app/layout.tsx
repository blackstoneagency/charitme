import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';
import SessionWatcher from '../components/SessionWatcher';

export const metadata: Metadata = {
  title: { default: 'KindFund - AI Fundraising Platform', template: '%s | KindFund' },
  description: 'AI-powered fundraising with campaign building, donor growth, trust tools, and impact updates.',
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
