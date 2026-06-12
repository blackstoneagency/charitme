import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find answers to common questions about CharitMe campaigns, donations, payouts, trust & safety, and account management.',
  alternates: { canonical: 'https://www.charitme.com/help' },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
