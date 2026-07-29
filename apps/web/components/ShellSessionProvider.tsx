'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type { ShellProps } from './CharitMeApp';
import { CharitMeShell as BaseCharitMeShell } from './CharitMeApp';
import type { ShellSession } from '../lib/shell-session';

const ShellSessionContext = createContext<ShellSession | null>(null);

export function ShellSessionProvider({
  session,
  children,
}: {
  session: ShellSession;
  children: ReactNode;
}) {
  return (
    <ShellSessionContext.Provider value={session}>
      {children}
    </ShellSessionContext.Provider>
  );
}

export function CharitMeShell(props: ShellProps) {
  const session = useContext(ShellSessionContext);
  return (
    <BaseCharitMeShell
      {...props}
      {...(session ?? {})}
    />
  );
}
