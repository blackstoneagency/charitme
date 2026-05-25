import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata: Metadata = {
  title: { default: 'RaiseMoney — Fund What Matters', template: '%s | RaiseMoney' },
  description: 'Create a fundraising campaign in minutes. Help causes you care about.',
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
