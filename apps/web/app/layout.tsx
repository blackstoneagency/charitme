import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: { default: 'RaiseMoney - AI-Powered Trusted Fundraising', template: '%s | RaiseMoney' },
  description: 'The safest and smartest way to raise money online with AI trust, growth, and transparency.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
