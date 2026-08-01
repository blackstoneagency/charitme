import 'server-only';
import { supabaseAdmin } from './supabase';
import { isAdmin } from './roles';

/**
 * Shared ownership rule for `donation_forms`.
 *
 * The API routes use the service-role client, which BYPASSES RLS — so this
 * function, not the policy, is what actually runs on every request. It is
 * written to mirror `donation_forms_owner_write`
 * (20260813000000_donation_forms_slug_and_campaign_owner.sql) exactly: admin, or
 * owner of the linked nonprofit, or owner of the linked campaign. Keeping one
 * rule in two places is how authorization quietly diverges, so both were widened
 * in the same change and this comment names the policy to check against.
 */
export async function canManageDonationForm(
  user: { id: string; email?: string | null },
  form: { nonprofit_id: string | null; campaign_id: string | null },
): Promise<boolean> {
  if (await isAdmin(user.id, user.email)) return true;

  if (form.nonprofit_id) {
    const { data } = await supabaseAdmin
      .from('nonprofit_profiles')
      .select('id')
      .eq('id', form.nonprofit_id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) return true;
  }

  if (form.campaign_id) {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', form.campaign_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) return true;
  }

  return false;
}

/**
 * A form with neither link belongs to nobody, so nobody could ever edit it
 * again — `canManageDonationForm` would return false for every caller including
 * its creator. Rejected at creation rather than left to become an orphan row.
 */
export function hasOwner(form: { nonprofit_id?: string | null; campaign_id?: string | null }): boolean {
  return Boolean(form.nonprofit_id || form.campaign_id);
}

/** URL-safe slug. Collisions are caught by `donation_forms_slug_uidx`, not here. */
export function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const DEFAULT_AMOUNTS_CENTS = [2500, 5000, 10000, 25000];
