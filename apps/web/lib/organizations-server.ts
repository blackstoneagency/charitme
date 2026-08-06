import 'server-only';
import { supabaseAdmin } from './supabase';
import { isOrgRole, type OrgRole } from './organizations-core';

/**
 * Readers for `organizations`, `organization_members` and `brands`.
 *
 * ⚠️ **These three tables had NO reader in the application at all** — the
 * multi-tenancy migration (`20260807000000_organizations_multitenancy.sql`) has
 * been in the repo for a long time and nothing has ever queried what it creates.
 * That is the "shipped but unreachable" pattern this codebase keeps finding, one
 * step earlier: shipped schema, unreachable from any code path.
 *
 * ⚠️ **Every read tolerates the table not existing.** The migration is applied by
 * the owner, so environments that have not run it answer PostgREST `42P01`. That
 * is treated as "no organizations" rather than an error — the same pattern
 * `cause-landing.ts` and `platform-reports-server.ts` use. It is what lets this
 * ship now and light up the moment the migration lands, instead of waiting and
 * leaving the tables unread indefinitely.
 *
 * `null` from any of these means the read genuinely FAILED, which callers must
 * not conflate with "this user belongs to no organisation".
 */

export type Organization = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  plan: string;
  status: string;
};

export type OrgMembership = { org_id: string; user_id: string; role: string };

export type Brand = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  is_default: boolean;
};

/** `42P01` = the migration has not been applied here. Not a failure. */
function missingTable(code: string | undefined): boolean {
  return code === '42P01';
}

/** Organisations the user belongs to, with their role in each. */
export async function getUserOrganizations(
  userId: string,
): Promise<{ org: Organization; role: OrgRole }[] | null> {
  try {
    const { data: memberRows, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('org_id, user_id, role')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .limit(100);

    if (memberError) {
      if (missingTable(memberError.code)) return [];
      console.warn('[organizations] membership read failed', { code: memberError.code });
      return null;
    }

    const memberships = (memberRows ?? []) as OrgMembership[];
    if (memberships.length === 0) return [];

    const { data: orgRows, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name, description, website_url, logo_url, plan, status')
      // Batched `.in()`, not one query per membership — the N+1 this repo audits for.
      .in('id', memberships.map((m) => m.org_id))
      .is('deleted_at', null);

    if (orgError) {
      if (missingTable(orgError.code)) return [];
      console.warn('[organizations] org read failed', { code: orgError.code });
      return null;
    }

    const byId = new Map((orgRows ?? []).map((o) => [o.id as string, o as Organization]));
    return memberships
      .map((m) => {
        const org = byId.get(m.org_id);
        // A membership whose organisation is soft-deleted or unreadable is
        // dropped rather than rendered as a nameless row.
        if (!org || !isOrgRole(m.role)) return null;
        return { org, role: m.role as OrgRole };
      })
      .filter((x): x is { org: Organization; role: OrgRole } => x !== null);
  } catch {
    // supabaseAdmin throws on property access when its env is unset.
    return null;
  }
}

/** One user's role in one organisation, or `null` if they are not a member. */
export async function getUserOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return null;
    const role = (data as { role?: string } | null)?.role;
    return isOrgRole(role) ? role : null;
  } catch {
    return null;
  }
}

/** Brands belonging to an organisation, default first. */
export async function getOrgBrands(orgId: string): Promise<Brand[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('id, org_id, slug, name, logo_url, is_default')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
      .limit(50);

    if (error) {
      if (missingTable(error.code)) return [];
      console.warn('[organizations] brands read failed', { code: error.code });
      return null;
    }
    return (data ?? []) as Brand[];
  } catch {
    return null;
  }
}
