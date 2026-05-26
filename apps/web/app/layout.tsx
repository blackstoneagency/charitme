import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: { default: 'KindFund - AI Fundraising Platform', template: '%s | KindFund' },
  description: 'AI-powered fundraising with campaign building, donor growth, trust tools, and impact updates.',
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
