import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Your Password',
  description: 'Securely reset your CharitMe account password.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
