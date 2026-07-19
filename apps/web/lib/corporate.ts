// Pure business logic for corporate giving (matching-gift rules + caps).
// No Supabase/Next imports — unit-testable, reusable server + client.

export interface MatchingGiftRule {
  category: string | null; // null = applies to all categories
  ratio: number;
  perGiftCapCents: number | null;
  annualCapCents: number | null;
  active: boolean;
}

export interface CorporateMatchAccount {
  defaultMatchRatio: number;
  annualCapCents: number | null; // per-employee annual cap at the account level
  active: boolean;
}

/** Extracts the lowercased domain from an email, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/** Whether an email belongs to a corporate account's domain. */
export function emailMatchesDomain(email: string | null | undefined, accountDomain: string | null | undefined): boolean {
  const d = emailDomain(email);
  if (!d || !accountDomain) return false;
  return d === accountDomain.trim().toLowerCase();
}

/**
 * Picks the most specific active rule for a category: a category-specific rule
 * wins over a catch-all (null category) rule. Returns null when none apply.
 */
export function selectRule(rules: MatchingGiftRule[], category: string | null): MatchingGiftRule | null {
  const active = rules.filter((r) => r.active);
  const cat = (category ?? '').trim().toLowerCase();
  const specific = active.find((r) => r.category != null && r.category.trim().toLowerCase() === cat);
  if (specific) return specific;
  return active.find((r) => r.category == null) ?? null;
}

export interface MatchComputation {
  ratio: number;
  /** Matched amount after applying per-gift + annual caps. */
  matchedCents: number;
  /** True if a cap reduced the raw matched amount. */
  capped: boolean;
  cappedBy: 'per_gift' | 'annual' | null;
}

/**
 * Computes the matched amount for one donation given the resolved ratio and the
 * applicable caps, accounting for how much has already been matched this year.
 */
export function computeMatchedCents(opts: {
  donationCents: number;
  ratio: number;
  perGiftCapCents?: number | null;
  annualCapCents?: number | null;
  priorMatchedThisYearCents?: number;
}): MatchComputation {
  const { donationCents, ratio } = opts;
  const perGiftCap = opts.perGiftCapCents ?? null;
  const annualCap = opts.annualCapCents ?? null;
  const prior = Math.max(0, opts.priorMatchedThisYearCents ?? 0);

  if (!Number.isFinite(donationCents) || donationCents <= 0 || !Number.isFinite(ratio) || ratio <= 0) {
    return { ratio: Math.max(0, ratio || 0), matchedCents: 0, capped: false, cappedBy: null };
  }

  const raw = Math.round(donationCents * ratio);
  let matched = raw;
  let cappedBy: 'per_gift' | 'annual' | null = null;

  if (perGiftCap != null && matched > perGiftCap) {
    matched = perGiftCap;
    cappedBy = 'per_gift';
  }

  if (annualCap != null) {
    const remaining = Math.max(0, annualCap - prior);
    if (matched > remaining) {
      matched = remaining;
      cappedBy = 'annual';
    }
  }

  return { ratio, matchedCents: matched, capped: matched < raw, cappedBy };
}

/**
 * End-to-end resolution: given a corporate account, its rules, a donation
 * amount + category, and prior yearly matching, produce the match. Falls back
 * to the account default ratio when no rule matches.
 */
export function resolveCorporateMatch(opts: {
  account: CorporateMatchAccount;
  rules: MatchingGiftRule[];
  donationCents: number;
  category: string | null;
  priorMatchedThisYearCents?: number;
}): MatchComputation {
  const { account, rules, donationCents, category } = opts;
  if (!account.active) return { ratio: 0, matchedCents: 0, capped: false, cappedBy: null };

  const rule = selectRule(rules, category);
  const ratio = rule ? rule.ratio : account.defaultMatchRatio;
  const perGiftCap = rule ? rule.perGiftCapCents : null;
  // Rule annual cap takes precedence; otherwise the account-level annual cap.
  const annualCap = rule && rule.annualCapCents != null ? rule.annualCapCents : account.annualCapCents;

  return computeMatchedCents({
    donationCents,
    ratio,
    perGiftCapCents: perGiftCap,
    annualCapCents: annualCap,
    priorMatchedThisYearCents: opts.priorMatchedThisYearCents,
  });
}
