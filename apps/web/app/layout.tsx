import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: { default: 'GiveRise - Free Fundraising Powered by AI', template: '%s | GiveRise' },
  description: 'Fundraising with built-in trust, AI campaign tools, transparent pricing, and fast verified Stripe payouts.',
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
