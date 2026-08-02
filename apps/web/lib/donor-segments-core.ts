/**
 * Donor segments: a saved rule set over `donor_crm_contacts`.
 *
 * `donor_segments` and `donor_segment_members` both shipped with RLS and foreign
 * keys and neither a reader nor a writer. The contacts table they point at is
 * already wired (`/api/crm/contacts`) and already carries everything a rule
 * needs — `tags`, `lifetime_value_cents`, `last_donated_at`, consent flags — so
 * a segment is saved criteria over existing data, not a new data model.
 *
 * This module is pure: the rule shape, matching, and validation. No database, so
 * every branch is testable, which matters because a segment decides **who gets
 * emailed**. A rule that quietly matches everyone is not a cosmetic bug — it is
 * a mailing to the entire contact list.
 */

export type SegmentRules = Readonly<{
  /** Contact must carry ALL of these tags. Empty means "no tag requirement". */
  tags?: readonly string[];
  /** Inclusive floor on lifetime value, in cents. */
  minLifetimeValueCents?: number;
  /** Inclusive ceiling on lifetime value, in cents. */
  maxLifetimeValueCents?: number;
  /** Donated within this many days. */
  donatedWithinDays?: number;
  /** Has NOT donated for at least this many days — the lapsed-donor case. */
  notDonatedForDays?: number;
  /** Restrict to contacts who accept email, or who accept SMS. */
  requiresEmailConsent?: boolean;
  requiresSmsConsent?: boolean;
}>;

export type SegmentContact = Readonly<{
  id: string;
  email: string | null;
  full_name: string | null;
  tags: readonly string[] | null;
  lifetime_value_cents: number | null;
  last_donated_at: string | null;
  consent_email: boolean;
  consent_sms: boolean;
}>;

const DAY_MS = 86_400_000;

/**
 * Is this rule set meaningful?
 *
 * An empty rule object matches EVERY contact. That is a legitimate thing to
 * want — "everyone" is a real segment — but it must be chosen, not arrived at by
 * a form that silently dropped its inputs. Callers use this to require an
 * explicit confirmation rather than to reject.
 */
export function isEmptyRuleSet(rules: SegmentRules): boolean {
  return (
    (rules.tags?.length ?? 0) === 0 &&
    rules.minLifetimeValueCents === undefined &&
    rules.maxLifetimeValueCents === undefined &&
    rules.donatedWithinDays === undefined &&
    rules.notDonatedForDays === undefined &&
    !rules.requiresEmailConsent &&
    !rules.requiresSmsConsent
  );
}

/**
 * Rules that can never match anything — a floor above a ceiling, or a window
 * that demands "donated in the last 7 days" AND "has not donated for 30 days".
 *
 * Worth naming separately from "invalid": these are well-formed and will save
 * happily, then produce an empty segment the fundraiser cannot explain.
 */
export function isContradictory(rules: SegmentRules): boolean {
  const { minLifetimeValueCents: min, maxLifetimeValueCents: max } = rules;
  if (min !== undefined && max !== undefined && min > max) return true;
  const { donatedWithinDays: within, notDonatedForDays: lapsed } = rules;
  if (within !== undefined && lapsed !== undefined && lapsed <= within) return true;
  return false;
}

/** Structural validity — negatives and non-finite numbers are not rules. */
export function isValidRuleSet(rules: SegmentRules): boolean {
  const numbers = [
    rules.minLifetimeValueCents,
    rules.maxLifetimeValueCents,
    rules.donatedWithinDays,
    rules.notDonatedForDays,
  ];
  for (const n of numbers) {
    if (n === undefined) continue;
    if (!Number.isFinite(n) || n < 0) return false;
  }
  if (rules.tags?.some((t) => typeof t !== 'string' || t.trim() === '')) return false;
  return true;
}

/**
 * Does this contact belong in the segment?
 *
 * Every rule is an AND. Rules are omitted, never set to a sentinel — an absent
 * `minLifetimeValueCents` means "no floor", where a 0 floor would be a real
 * (if permissive) rule. Conflating them is how "donors worth over nothing"
 * becomes indistinguishable from "no criterion at all".
 */
export function matchesSegment(
  contact: SegmentContact,
  rules: SegmentRules,
  now: number = Date.now(),
): boolean {
  if (!isValidRuleSet(rules)) return false;

  if (rules.tags && rules.tags.length > 0) {
    const owned = new Set((contact.tags ?? []).map((t) => t.toLowerCase()));
    for (const tag of rules.tags) {
      if (!owned.has(tag.toLowerCase())) return false;
    }
  }

  const ltv = contact.lifetime_value_cents ?? 0;
  if (rules.minLifetimeValueCents !== undefined && ltv < rules.minLifetimeValueCents) return false;
  if (rules.maxLifetimeValueCents !== undefined && ltv > rules.maxLifetimeValueCents) return false;

  if (rules.donatedWithinDays !== undefined) {
    // A contact who has never donated is not "within" any window. Treating a
    // null date as 0 would place them in every recency segment.
    if (!contact.last_donated_at) return false;
    const when = Date.parse(contact.last_donated_at);
    if (!Number.isFinite(when)) return false;
    if (now - when > rules.donatedWithinDays * DAY_MS) return false;
  }

  if (rules.notDonatedForDays !== undefined) {
    // Symmetrically: someone who has NEVER donated has by definition not donated
    // in the last N days, so they belong in a lapsed segment.
    if (contact.last_donated_at) {
      const when = Date.parse(contact.last_donated_at);
      if (Number.isFinite(when) && now - when < rules.notDonatedForDays * DAY_MS) return false;
    }
  }

  if (rules.requiresEmailConsent && !contact.consent_email) return false;
  if (rules.requiresSmsConsent && !contact.consent_sms) return false;

  return true;
}

export function selectMembers(
  contacts: readonly SegmentContact[],
  rules: SegmentRules,
  now: number = Date.now(),
): SegmentContact[] {
  return contacts.filter((c) => matchesSegment(c, rules, now));
}

/**
 * A one-line English rendering of the rules, for the segment list.
 *
 * The fundraiser has to be able to see what a saved segment does without opening
 * it — a list of names with no criteria is how the wrong list gets emailed.
 */
export function describeRules(rules: SegmentRules): string {
  if (isEmptyRuleSet(rules)) return 'Every contact';
  const parts: string[] = [];
  if (rules.tags?.length) parts.push(`tagged ${rules.tags.join(' + ')}`);
  if (rules.minLifetimeValueCents !== undefined) {
    parts.push(`gave $${Math.round(rules.minLifetimeValueCents / 100).toLocaleString()}+`);
  }
  if (rules.maxLifetimeValueCents !== undefined) {
    parts.push(`gave under $${Math.round(rules.maxLifetimeValueCents / 100).toLocaleString()}`);
  }
  if (rules.donatedWithinDays !== undefined) parts.push(`donated in the last ${rules.donatedWithinDays} days`);
  if (rules.notDonatedForDays !== undefined) parts.push(`no donation for ${rules.notDonatedForDays} days`);
  if (rules.requiresEmailConsent) parts.push('accepts email');
  if (rules.requiresSmsConsent) parts.push('accepts SMS');
  return parts.join(', ');
}

/** Narrow unknown JSON from the `rules` jsonb column into a rule set. */
export function parseRules(value: unknown): SegmentRules {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const num = (key: string): number | undefined => {
    const n = raw[key];
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    : undefined;
  return {
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(num('minLifetimeValueCents') !== undefined ? { minLifetimeValueCents: num('minLifetimeValueCents') } : {}),
    ...(num('maxLifetimeValueCents') !== undefined ? { maxLifetimeValueCents: num('maxLifetimeValueCents') } : {}),
    ...(num('donatedWithinDays') !== undefined ? { donatedWithinDays: num('donatedWithinDays') } : {}),
    ...(num('notDonatedForDays') !== undefined ? { notDonatedForDays: num('notDonatedForDays') } : {}),
    ...(raw.requiresEmailConsent === true ? { requiresEmailConsent: true } : {}),
    ...(raw.requiresSmsConsent === true ? { requiresSmsConsent: true } : {}),
  };
}
