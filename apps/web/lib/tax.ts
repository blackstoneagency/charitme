// ─────────────────────────────────────────────────────────────────────────────
// Tax statement logic (pure — no I/O, fully unit-testable).
//
// A donation is **tax-deductible** only when the receiving campaign is run by a
// registered nonprofit that is BOTH verified and has tax receipts enabled. In
// that case the nonprofit's legal name + EIN (tax_id) belong on the receipt.
// Everything else (personal fundraisers) is a personal gift and is NOT
// tax-deductible — we say so explicitly rather than implying otherwise, because
// misrepresenting deductibility is a real compliance problem.
//
// Only `completed` donations count. Refunded / pending / failed are excluded
// from the deductible totals (a refunded gift was never actually given).
// Platform tips are the donor's optional support of CharitMe, not a gift to the
// cause, so they are reported separately and never counted as deductible.
// ─────────────────────────────────────────────────────────────────────────────

export interface NonprofitTaxInfo {
  name: string;
  /** EIN / tax id, e.g. "12-3456789". */
  taxId: string | null;
  verified: boolean;
  taxReceiptEnabled: boolean;
}

export interface TaxDonationInput {
  id: string;
  amountCents: number;
  tipCents?: number | null;
  currency: string | null;
  status: string;
  createdAt: string; // ISO
  campaignId: string;
  campaignTitle: string;
  receiptNumber?: string | null;
  /** Nonprofit backing the campaign, if any (resolved from the campaign owner). */
  nonprofit?: NonprofitTaxInfo | null;
}

export interface TaxStatementLine {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  campaignTitle: string;
  organization: string | null; // nonprofit legal name, when deductible
  ein: string | null;
  amountCents: number;
  tipCents: number;
  currency: string;
  deductible: boolean;
  receiptNumber: string | null;
}

export interface TaxStatementTotals {
  donationCount: number;
  /** Sum of all completed gift amounts (excludes tips). */
  totalGiftCents: number;
  /** Portion given to verified, receipt-enabled nonprofits. */
  deductibleCents: number;
  /** Portion given to personal fundraisers (not deductible). */
  nonDeductibleCents: number;
  /** Optional platform tips — reported for completeness, never deductible. */
  totalTipCents: number;
}

export interface TaxStatement {
  year: number;
  currency: string;
  lines: TaxStatementLine[];
  totals: TaxStatementTotals;
  /** Distinct verified nonprofits the donor gave to (for the summary block). */
  organizations: { name: string; ein: string | null; deductibleCents: number }[];
}

export class MixedCurrencyError extends Error {
  readonly code = 'MIXED_CURRENCY';
  readonly currencies: string[];

  constructor(currencies: string[]) {
    super('A tax report cannot combine donations in different currencies.');
    this.name = 'MixedCurrencyError';
    this.currencies = currencies;
  }
}

/** True only for a verified nonprofit that has enabled tax receipts. */
export function isDeductible(nonprofit: NonprofitTaxInfo | null | undefined): boolean {
  return Boolean(nonprofit && nonprofit.verified && nonprofit.taxReceiptEnabled);
}

/**
 * Whether an OFFICIAL emailed tax receipt can be auto-issued for a gift. Stricter
 * than {@link isDeductible}: an emailed receipt must carry the organization's EIN,
 * so an EIN is required (a deductible gift to a verified org with no EIN on file
 * still shows on the statement, but we don't email a receipt that omits the EIN).
 */
export function canIssueTaxReceipt(nonprofit: NonprofitTaxInfo | null | undefined): boolean {
  return isDeductible(nonprofit) && Boolean(nonprofit && nonprofit.taxId && nonprofit.taxId.trim());
}

function isoDateOnly(iso: string): string {
  // Keep the calendar date in UTC to match how the year filter is applied.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a donor's consolidated annual giving statement for a tax year.
 * `donations` may contain any statuses / years — this filters to `completed`
 * donations whose UTC year matches `year`, newest first.
 */
export function buildTaxStatement(donations: TaxDonationInput[], year: number): TaxStatement {
  const inYear = donations.filter((d) => {
    if (d.status !== 'completed') return false;
    const t = new Date(d.createdAt);
    return !Number.isNaN(t.getTime()) && t.getUTCFullYear() === year;
  });

  inYear.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const currencies = new Set(inYear.map((d) => (d.currency ?? 'usd').toLowerCase()));
  if (currencies.size > 1) throw new MixedCurrencyError([...currencies].sort());

  const currency = (inYear[0]?.currency ?? 'usd').toLowerCase();

  const lines: TaxStatementLine[] = inYear.map((d) => {
    const deductible = isDeductible(d.nonprofit);
    return {
      id: d.id,
      date: isoDateOnly(d.createdAt),
      campaignTitle: d.campaignTitle,
      organization: deductible ? d.nonprofit!.name : null,
      ein: deductible ? d.nonprofit!.taxId ?? null : null,
      amountCents: Math.max(0, Math.round(d.amountCents)),
      tipCents: Math.max(0, Math.round(d.tipCents ?? 0)),
      currency: (d.currency ?? currency).toLowerCase(),
      deductible,
      receiptNumber: d.receiptNumber ?? null,
    };
  });

  const totals: TaxStatementTotals = {
    donationCount: lines.length,
    totalGiftCents: sum(lines.map((l) => l.amountCents)),
    deductibleCents: sum(lines.filter((l) => l.deductible).map((l) => l.amountCents)),
    nonDeductibleCents: sum(lines.filter((l) => !l.deductible).map((l) => l.amountCents)),
    totalTipCents: sum(lines.map((l) => l.tipCents)),
  };

  // Group deductible giving by organization (name + EIN) for the summary block.
  const orgMap = new Map<string, { name: string; ein: string | null; deductibleCents: number }>();
  for (const l of lines) {
    if (!l.deductible || !l.organization) continue;
    const key = `${l.organization}|${l.ein ?? ''}`;
    const existing = orgMap.get(key);
    if (existing) existing.deductibleCents += l.amountCents;
    else orgMap.set(key, { name: l.organization, ein: l.ein, deductibleCents: l.amountCents });
  }
  const organizations = [...orgMap.values()].sort((a, b) => b.deductibleCents - a.deductibleCents);

  return { year, currency, lines, totals, organizations };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fundraiser (campaign-owner) year-end summary.
//
// What a fundraiser needs for their own records/income reporting is the GROSS
// they raised — the authoritative sum of completed donations to their
// campaigns. CharitMe's platform fee is 0%, so gross ≈ what they received,
// minus Stripe's processing fees which Stripe deducts and reports separately
// (we do NOT estimate those here — presenting an estimate as authoritative for
// taxes would mislead). Tips are the donor's support of CharitMe, not the
// fundraiser's revenue, and are reported separately.
// ─────────────────────────────────────────────────────────────────────────────

export interface FundraiserDonationInput {
  amountCents: number;
  tipCents?: number | null;
  currency: string | null;
  status: string;
  createdAt: string; // ISO
  campaignId: string;
  campaignTitle: string;
}

export interface FundraiserCampaignSummary {
  campaignId: string;
  campaignTitle: string;
  donationCount: number;
  grossCents: number;
  tipCents: number;
}

export interface FundraiserTaxSummary {
  year: number;
  currency: string;
  campaigns: FundraiserCampaignSummary[];
  totals: { donationCount: number; grossCents: number; tipCents: number };
}

export function buildFundraiserTaxSummary(
  donations: FundraiserDonationInput[],
  year: number,
): FundraiserTaxSummary {
  const inYear = donations.filter((d) => {
    if (d.status !== 'completed') return false;
    const t = new Date(d.createdAt);
    return !Number.isNaN(t.getTime()) && t.getUTCFullYear() === year;
  });

  const currencies = new Set(inYear.map((d) => (d.currency ?? 'usd').toLowerCase()));
  if (currencies.size > 1) throw new MixedCurrencyError([...currencies].sort());

  const currency = (inYear[0]?.currency ?? 'usd').toLowerCase();

  const byCampaign = new Map<string, FundraiserCampaignSummary>();
  for (const d of inYear) {
    const existing = byCampaign.get(d.campaignId);
    const gross = Math.max(0, Math.round(d.amountCents));
    const tip = Math.max(0, Math.round(d.tipCents ?? 0));
    if (existing) {
      existing.donationCount += 1;
      existing.grossCents += gross;
      existing.tipCents += tip;
    } else {
      byCampaign.set(d.campaignId, {
        campaignId: d.campaignId,
        campaignTitle: d.campaignTitle,
        donationCount: 1,
        grossCents: gross,
        tipCents: tip,
      });
    }
  }

  const campaigns = [...byCampaign.values()].sort((a, b) => b.grossCents - a.grossCents);
  const totals = {
    donationCount: sum(campaigns.map((c) => c.donationCount)),
    grossCents: sum(campaigns.map((c) => c.grossCents)),
    tipCents: sum(campaigns.map((c) => c.tipCents)),
  };

  return { year, currency, campaigns, totals };
}

/** Years (descending) for which the donor has at least one completed donation. */
export function donationYears(donations: TaxDonationInput[]): number[] {
  const years = new Set<number>();
  for (const d of donations) {
    if (d.status !== 'completed') continue;
    const t = new Date(d.createdAt);
    if (!Number.isNaN(t.getTime())) years.add(t.getUTCFullYear());
  }
  return [...years].sort((a, b) => b - a);
}
