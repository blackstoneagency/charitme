import type React from 'react';
import { CharitMeShell, type ShellVariant } from './CharitMeApp';

type Props = {
  children: React.ReactNode;
  variant?: ShellVariant;
  user: { email: string; name?: string | null };
};

export function DashboardShell({ children, variant = 'dashboard', user }: Props) {
  return (
    <CharitMeShell
      active={variant === 'admin' ? 'Dashboard' : 'Dashboard'}
      mode={variant}
      userName={user.name}
      userEmail={user.email}
    >
      {children}
    </CharitMeShell>
  );
}
