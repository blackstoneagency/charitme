import 'server-only';
import { supabaseAdmin } from './supabase';
import {
  parseNavOverride,
  parseNavOverrideMap,
  type NavOverride,
  type NavOverrideMap,
} from './nav-customization-core';

/**
 * Reads the two customization layers. Composition lives in
 * `nav-customization-core.ts`; this file only fetches.
 *
 * ⚠️ EVERY failure here returns "no customization", never an exception. These
 * run inside the shell that wraps every signed-in page, so a thrown error is a
 * blank product, not a plain sidebar. `supabaseAdmin` is a Proxy whose `get`
 * trap THROWS when the env is unset — that is why each read is wrapped rather
 * than relying on the `{ data, error }` shape alone; an `if (error)` check does
 * not catch a throw that happens before the query is issued. That exact gap
 * once took the whole site down through the root layout's announcements loader.
 */

export async function loadPlatformNavOverrides(): Promise<NavOverrideMap> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('config')
      .eq('id', 1)
      .maybeSingle();
    if (error) return {};
    const config = data?.config && typeof data.config === 'object' && !Array.isArray(data.config)
      ? (data.config as Record<string, unknown>)
      : {};
    const navigation = config.navigation && typeof config.navigation === 'object' && !Array.isArray(config.navigation)
      ? (config.navigation as Record<string, unknown>)
      : {};
    return parseNavOverrideMap(navigation.byRole);
  } catch {
    return {};
  }
}

export async function loadUserNavOverride(userId: string | null): Promise<NavOverride> {
  if (!userId) return {};
  try {
    const { data, error } = await supabaseAdmin
      .from('user_nav_preferences')
      .select('hidden, item_order')
      .eq('user_id', userId)
      .maybeSingle();
    // 42P01 (undefined table) is the expected state until the migration is
    // applied — this repo's migrations are applied by the owner, not by deploy,
    // so a reader that hard-failed on a missing table would break every signed-in
    // page between merge and migration. Same handling as any other read failure.
    if (error) return {};
    const row = data as { hidden?: unknown; item_order?: unknown } | null;
    if (!row) return {};
    return parseNavOverride({ hidden: row.hidden, order: row.item_order });
  } catch {
    return {};
  }
}
