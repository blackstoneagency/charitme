import 'server-only';
import { cache } from 'react';
import { getUser } from './auth';
import { ROLE_DEFINITIONS, effectivePrimaryRole } from './role-capabilities';
import { isAdmin } from './roles';
import { parseRoles } from './roles-shared';
import type { ShellSession } from './shell-session';
import { supabaseAdmin } from './supabase';

const SIGNED_OUT_SESSION: ShellSession = {
  id: null,
  userName: null,
  userEmail: '',
  userRole: '',
  navRole: 'donor',
  userAvatarUrl: null,
  hasAdminAccess: false,
};

export const loadShellSession = cache(async (): Promise<ShellSession> => {
  try {
    const user = await getUser();
    if (!user) return SIGNED_OUT_SESSION;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url, roles')
      .eq('id', user.id)
      .single();

    const roles = parseRoles(profile?.roles);
    const hasAdminAccess = await isAdmin(user.id, user.email);
    const navRole = effectivePrimaryRole(roles, hasAdminAccess);
    const metadata = (user.user_metadata ?? {}) as {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      picture?: string;
    };

    return {
      id: user.id,
      userName: profile?.full_name ?? metadata.full_name ?? metadata.name ?? null,
      userEmail: user.email ?? '',
      userRole: ROLE_DEFINITIONS[navRole].label,
      navRole,
      userAvatarUrl: profile?.avatar_url ?? metadata.avatar_url ?? metadata.picture ?? null,
      hasAdminAccess,
    };
  } catch {
    return SIGNED_OUT_SESSION;
  }
});
