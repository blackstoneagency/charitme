import 'server-only';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';
import { parseRoles } from './roles';

function metadataText(metadata: User['user_metadata'], key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Safety net for auth users whose row predates the on_auth_user_created
 * trigger: create the missing profiles row from auth metadata.
 *
 * Existing rows are never modified — profiles is the canonical store for
 * roles (admin suspend/promote writes there) and for user-edited fields
 * like full_name, so auth metadata must not overwrite it. Profile persistence
 * is required, so failures are surfaced instead of reporting false success.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return;
  if (selectError) {
    throw new Error('PROFILE_SYNC_FAILED');
  }

  const metadata = user.user_metadata;
  const { error: insertError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: metadataText(metadata, 'full_name') ?? metadataText(metadata, 'name'),
      avatar_url: metadataText(metadata, 'avatar_url'),
      roles: parseRoles(metadata.roles),
    }, { onConflict: 'id', ignoreDuplicates: true });

  if (insertError) {
    throw new Error('PROFILE_SYNC_FAILED');
  }
}

// Alias for callers written against the original name. Same insert-if-missing
// semantics: existing profiles (roles, edited names) are never overwritten.
export const syncUserProfile = ensureUserProfile;
