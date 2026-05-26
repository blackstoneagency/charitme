import type React from 'react';
import { KindFundShell, type ShellVariant } from './KindFundApp';

type Props = {
  children: React.ReactNode;
  variant?: ShellVariant;
  user: { email: string; name?: string | null };
};

export function DashboardShell({ children, variant = 'dashboard', user }: Props) {
  return (
    <KindFundShell
      active={variant === 'admin' ? 'Dashboard' : 'Dashboard'}
      mode={variant}
      userName={user.name}
      userEmail={user.email}
    >
      {children}
    </KindFundShell>
  );
}
