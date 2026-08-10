import 'server-only';
import { supabaseAdmin } from './supabase';

/**
 * How many countries this platform can actually pay out to.
 *
 * ── Why this is a module and not a number in a page ────────────────────────
 * `/fast-payouts` hardcoded "40+ Countries" in three places while
 * `/supported-countries` rendered the real figure from `supported_countries`
 * — measured 15 able to fundraise against the same data. Two pages, two
 * answers to one factual question, and the hardcoded one is the one a visitor
 * cannot check.
 *
 * That is the same failure `/supported-countries` already documents in its own
 * header, and the same one that made three hand-maintained copies of
 * CAMPAIGN_CATEGORIES drift. One reader, one answer.
 *
 * ── Why `null` rather than 0 ──────────────────────────────────────────────
 * A failed read and "we support nowhere" are opposite statements. Returning 0
 * would let a database blip render "0 Countries" on a page whose whole purpose
 * is convincing an organizer they will get paid. `null` means "unknown", and
 * the caller omits the claim instead of making a false one.
 */
export async function countPayoutCountries(): Promise<number | null> {
  try {
    const { count, error } = await supabaseAdmin
      .from('supported_countries')
      .select('id', { count: 'exact', head: true })
      // Payout capability is `can_fundraise` — an organizer receiving money.
      // `can_donate` is the other direction and is a larger set, which is part
      // of how the two pages disagreed in the first place.
      .eq('active', true)
      .eq('can_fundraise', true);
    if (error) return null;
    return count ?? null;
  } catch {
    // supabaseAdmin is a Proxy that THROWS on property access when its env is
    // unset, so this can fail before a query is ever issued.
    return null;
  }
}
