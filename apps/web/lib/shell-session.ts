import type { UserRole } from './roles-shared';

export type ShellSession = Readonly<{
  id: string | null;
  userName: string | null;
  userEmail: string;
  userRole: string;
  navRole: UserRole;
  userAvatarUrl: string | null;
  hasAdminAccess: boolean;
}>;
