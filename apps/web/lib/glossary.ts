// ─────────────────────────────────────────────────────────────────────────────
// Glossary terms.
//
// Kept in a module rather than inline in the page so the A–Z index is DERIVED
// from the terms instead of hand-maintained beside them — a hardcoded letter row
// drifts the moment a term is added, and the failure is a letter that links to
// nothing.
//
// Definitions describe what CharitMe actually does, not the generic industry
// meaning. "Platform fee" says 0% because that is this platform's fee; a
// glossary that defined it generically would contradict /pricing and /fees.
// ─────────────────────────────────────────────────────────────────────────────

export interface GlossaryTerm {
  term: string;
  definition: string;
  /** Optional page that explains the term properly. */
  href?: string;
}

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  { term: 'Anonymous donation', definition: 'A gift where the donor’s name is hidden from public view. CharitMe honours two separate signals: the per-donation anonymous option and the account-wide profile-visibility setting. Either one hides you.' },
  { term: 'Beneficiary', definition: 'The person or organisation a campaign raises money for, who may be someone other than the organiser. Beneficiaries confirm the arrangement before payouts are released.' },
  { term: 'Campaign', definition: 'A fundraising effort created by an individual or organisation to raise money for a specific purpose.', href: '/campaigns' },
  { term: 'CharitScore', definition: 'CharitMe’s 0–99 trust score, computed from verification status, evidence attached, update frequency and campaign history. A higher score means a more complete campaign — not a more deserving one.', href: '/verification' },
  { term: 'Deadline', definition: 'The date a campaign stops accepting donations. A campaign whose status is no longer active has ended regardless of its deadline, and every surface says “Ended” rather than showing a countdown.' },
  { term: 'Donor', definition: 'Anyone who contributes money to a campaign. Donors can give once or set up a recurring monthly gift.', href: '/donate' },
  { term: 'Employer matching', definition: 'A programme where a company matches its employees’ charitable donations, often doubling the gift.', href: '/matching' },
  { term: 'Grant', definition: 'Funding awarded to a nonprofit or community organisation, usually through an application rather than public fundraising.', href: '/grants' },
  { term: 'Nonprofit verification', definition: 'The check that confirms an organisation is a registered charity. Only verified nonprofits are marked tax deductible and issue official receipts.', href: '/verification' },
  { term: 'Payout', definition: 'The transfer of raised funds from CharitMe to the organiser’s connected bank account. Standard payouts follow a two-business-day schedule once Stripe onboarding is complete.', href: '/fast-payouts' },
  { term: 'Peer-to-peer fundraising', definition: 'Supporters raising money on behalf of a campaign, each with their own page and link. Everything they raise counts toward the parent campaign.', href: '/teams' },
  { term: 'Platform fee', definition: 'What the platform charges organisers as a percentage of donations. On CharitMe this is 0% — the platform is funded by optional donor support instead.', href: '/pricing' },
  { term: 'Processing fee', definition: 'The charge taken by the payment processor, not by CharitMe. Card payments are 2.9% + $0.30; other methods differ and the exact rate is shown before a donor confirms.', href: '/fees' },
  { term: 'Recurring donation', definition: 'A donation set to repeat automatically each month. It can be changed or cancelled at any time from the donor dashboard.' },
  { term: 'Refund', definition: 'The return of a donation to the donor. Refunds reverse the campaign’s raised total as well as the payment.', href: '/refunds' },
  { term: 'Stripe Connect', definition: 'The payment infrastructure CharitMe uses to verify organisers and move funds to their bank accounts. Identity is confirmed before any money can leave the platform.' },
  { term: 'Tax receipt', definition: 'An official document for a donation that may be used for tax deductions. Issued automatically for gifts to verified nonprofits.' },
  { term: 'Team', definition: 'A group fundraising together toward one shared goal, with each member raising through their own page.', href: '/teams' },
  { term: 'Tip', definition: 'An optional contribution a donor can add to support CharitMe itself. Always reducible to zero, with no dark patterns.', href: '/fees' },
  { term: 'Transparency ledger', definition: 'The public record on a campaign showing what was raised and what it went to.', href: '/transparency' },
  { term: 'Trust & Safety', definition: 'The team and automated systems that review campaigns, investigate reports, and can pause payouts while a review is open.', href: '/trust-safety' },
  { term: 'Update', definition: 'A post from an organiser reporting progress to donors. Campaigns that post updates raise measurably more than those that do not.' },
  { term: 'Verified fundraiser', definition: 'An organiser whose identity has been confirmed and whose payouts are enabled. It means we know who receives the money — not that we endorse the campaign.', href: '/verification' },
];

/** Distinct first letters that actually have a term, in order. Derived, never typed. */
export function glossaryLetters(terms: readonly GlossaryTerm[] = GLOSSARY_TERMS): string[] {
  return [...new Set(terms.map((t) => t.term[0].toUpperCase()))].sort();
}

/** Terms grouped by first letter, alphabetically within each group. */
export function glossaryByLetter(
  terms: readonly GlossaryTerm[] = GLOSSARY_TERMS,
): { letter: string; terms: GlossaryTerm[] }[] {
  const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term));
  const groups = new Map<string, GlossaryTerm[]>();
  for (const t of sorted) {
    const l = t.term[0].toUpperCase();
    groups.set(l, [...(groups.get(l) ?? []), t]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, ts]) => ({ letter, terms: ts }));
}
