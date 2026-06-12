import 'server-only';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';
import { parseRoles } from './roles';

function metadataText(metadata: User['user_metadata'], key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function syncUserProfile(user: User): Promise<void> {
  const metadata = user.user_metadata;
  const roles = parseRoles(metadata.roles);
  const fullName = metadataText(metadata, 'full_name') ?? metadataText(metadata, 'name');
  const avatarUrl = metadataText(metadata, 'avatar_url');

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      avatar_url: avatarUrl,
      roles,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    throw new Error(`Could not sync user profile: ${error.message}`);
  }
}
