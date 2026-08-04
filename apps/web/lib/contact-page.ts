import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';
import { getFooterSettings } from './footer-settings';

/**
 * Everything /contact needs from Supabase: the measured support figures, and
 * the contact details an operator controls.
 *
 * ── Why the phone number and address are gated ─────────────────────────────
 * The previous page printed `+1 (888) 123-4567` and `123 Impact Way, Suite 400,
 * San Francisco, CA 94107` as hard-coded JSX. Neither exists anywhere in the
 * schema or the settings store, and `platform_settings.config` is empty in
 * production, so nothing was overriding them — they were invented.
 *
 * A fabricated statistic is bad. A fabricated phone number and postal address
 * on a contact page are worse: they are instructions to a visitor who then
 * calls a stranger or posts a letter into the void. So both render ONLY from a
 * configured value, and the shipped default for the phone is empty rather than
 * the `(555) 123-4567` placeholder that `general.supportPhone` carried.
 *
 * The email is different — it comes from the footer settings, is already used
 * as a live `mailto:` on every page of the site, and is therefore real.
 */

export interface ContactDetails {
  /** Always present: the same address the footer links, validated on read there. */
  email: string;
  /** `null` unless configured. Never a placeholder. */
  phone: string | null;
  /** `null` unless configured. Never a placeholder. */
  address: string | null;
}

export interface ContactStats {
  /** Total support cases ever opened. `null` = not measurable, never 0. */
  totalCases: number | null;
  /** Cases in a resolved or closed state. Exact, not sampled. */
  resolvedCases: number | null;
  activeCampaigns: number | null;
  /** A FLOOR, not a total — distinct donors across the most recent sample. */
  donorsHelped: number | null;
}

const NO_STATS: ContactStats = {
  totalCases: null,
  resolvedCases: null,
  activeCampaigns: null,
  donorsHelped: null,
};

/*
 * ── Why there is no "average response time" here ───────────────────────────
 * The previous page published one, computed as `updated_at - created_at` over
 * resolved cases. Measured against production it produced **250 days**, and
 * that number is an artifact, not a support metric:
 *
 *   • `updated_at` is not a response timestamp. It moves on ANY edit to the
 *     row, so it measures "last touched", not "first replied".
 *   • The rows are seeded. `created_at` is spread across two years while
 *     `updated_at` clusters in mid-2026, because the seeder backdated creation
 *     without backdating the update. The gap it measures is the seed run.
 *   • `support_cases` HAS a `resolved_at` column, which would be the right one
 *     — and it is NULL on all 186 resolved cases, so nothing real is there
 *     either.
 *
 * So the figure is not measurable, and the tile is gone rather than filled
 * with a proxy. Restoring it needs `resolved_at` to be populated (or a
 * first-response column to exist) — not a different formula over `updated_at`.
 */

/**
 * Reject the shipped placeholders as firmly as an empty string.
 *
 * `(555) 123-4567` is the North American fiction reserved exchange and is what
 * `general.supportPhone` defaults to; `(888) 123-4567` was the invented number
 * on the old page. Treating a placeholder as "configured" is how it ends up on
 * a live page looking like a real number.
 */
const PLACEHOLDER_PHONE = /(?:^|\D)(?:555|888)[)\s.-]*123[\s.-]*4567/;

export function usableContactValue(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  if (PLACEHOLDER_PHONE.test(value)) return null;
  // "123 Impact Way" — the invented office. Named explicitly rather than
  // pattern-matched, because a real address could legitimately be 123 anything.
  if (/^123 Impact Way/i.test(value)) return null;
  return value.slice(0, 200);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const fetchContactDetails = unstable_cache(
  async (): Promise<{ phone: string | null; address: string | null }> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('platform_settings')
        .select('config')
        .eq('id', 1)
        .maybeSingle();
      // supabase-js RESOLVES on a failed query rather than throwing, so the
      // error has to be checked or `data` is silently null.
      if (error) return { phone: null, address: null };

      const general = asRecord(asRecord(data?.config).general);
      return {
        phone: usableContactValue(general.supportPhone),
        address: usableContactValue(general.officeAddress),
      };
    } catch {
      return { phone: null, address: null };
    }
  },
  ['contact-details'],
  { revalidate: 60, tags: ['contact-details', 'platform-settings'] },
);

export async function getContactDetails(): Promise<ContactDetails> {
  const [footer, configured] = await Promise.all([getFooterSettings(), fetchContactDetails()]);
  return { email: footer.contactEmail, phone: configured.phone, address: configured.address };
}

/**
 * ⚠️ One of these reads is platform-proportional and must stay capped.
 *
 * `__tests__/unbounded-reads.test.ts` treats any filter as bounding the query —
 * true of `.eq('user_id', …)`, NOT true of a STATUS filter.
 * `.eq('status','completed')` on `donations` selects nearly every row that
 * exists. So the donor read is explicitly capped and its figure is labelled for
 * what it is: a floor.
 *
 * The three case/campaign figures are head-only `count: 'exact'` queries, which
 * transfer no rows and are exact rather than sampled.
 */
const DONOR_SAMPLE = 5000;

const fetchContactStats = unstable_cache(
  async (): Promise<ContactStats> => {
    try {
      const [casesCountRes, resolvedCountRes, activeCampRes, donationsRes] = await Promise.all([
        supabaseAdmin.from('support_cases').select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('support_cases')
          .select('id', { count: 'exact', head: true })
          .in('status', ['resolved', 'closed']),
        supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabaseAdmin
          .from('donations')
          .select('donor_id')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(DONOR_SAMPLE),
      ]);

      // A failed read is NOT zero. Rendering "0 Active Campaigns" on a public
      // page because a query timed out states something false about the
      // platform.
      if (casesCountRes.error || resolvedCountRes.error || activeCampRes.error || donationsRes.error) {
        return NO_STATS;
      }

      return {
        totalCases: casesCountRes.count,
        resolvedCases: resolvedCountRes.count,
        activeCampaigns: activeCampRes.count,
        donorsHelped: new Set(
          ((donationsRes.data ?? []) as { donor_id: string | null }[])
            .map((d) => d.donor_id)
            .filter(Boolean),
        ).size,
      };
    } catch {
      return NO_STATS;
    }
  },
  ['public-contact-stats'],
  { revalidate: 60, tags: ['contact-stats'] },
);

export async function getContactStats(): Promise<ContactStats> {
  return fetchContactStats();
}

/**
 * `null` = could not measure. An em dash, never a confident 0.
 *
 * ⚠️ The previous version returned the string '24/7' for a measured zero, so a
 * platform with no resolved cases advertised round-the-clock support. A count
 * of zero is a count; it renders as 0.
 */
export function formatContactCount(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString('en-US');
}
