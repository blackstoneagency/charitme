export type TaxReportRecord = {
  tax_year: number;
  receipt_number: string;
  donation_date: string | null;
  created_at: string;
  campaign_title: string | null;
  recipient_name: string | null;
  recipient_ein: string | null;
  amount_cents: number;
  tip_cents: number;
  processing_fee_cents: number;
  tax_deductible_amount_cents: number;
  currency: string;
  status: string;
};

export type TaxDonationSource = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  processing_fee_cents: number;
  currency: string | null;
  status: string;
  created_at: string;
  campaign_id: string;
  campaigns: {
    title: string;
    nonprofit_verified: boolean | null;
    nonprofit_profiles?: TaxNonprofitSource | TaxNonprofitSource[] | null;
  } | null;
};

export type TaxNonprofitSource = {
  name: string | null;
  ein: string | null;
  tax_id: string | null;
  verified: boolean | null;
  verification_status: string | null;
  tax_receipt_enabled: boolean | null;
};

export type TaxReceiptReference = {
  donation_id: string;
  receipt_number: string;
};

export function buildTaxReportRecords(
  donations: TaxDonationSource[],
  receiptReferences: TaxReceiptReference[],
): TaxReportRecord[] {
  const receiptMap = new Map(receiptReferences.map((receipt) => [receipt.donation_id, receipt.receipt_number]));
  return donations.map((donation) => {
    const nonprofit = donation.campaigns?.nonprofit_profiles;
    const nonprofitProfile = Array.isArray(nonprofit) ? nonprofit[0] ?? null : nonprofit ?? null;
    const taxDeductible = donation.status === 'completed' && (nonprofitProfile
      ? nonprofitProfile.verified === true
        && nonprofitProfile.tax_receipt_enabled === true
        && ['verified', 'approved'].includes(nonprofitProfile.verification_status ?? '')
      : donation.campaigns?.nonprofit_verified === true);
    return {
      tax_year: new Date(donation.created_at).getUTCFullYear(),
      receipt_number: receiptMap.get(donation.id) ?? `CHM-${donation.id.replaceAll('-', '')}`,
      donation_date: donation.created_at,
      created_at: donation.created_at,
      campaign_title: donation.campaigns?.title ?? null,
      recipient_name: nonprofitProfile?.name ?? null,
      recipient_ein: nonprofitProfile?.ein || nonprofitProfile?.tax_id || null,
      amount_cents: donation.amount_cents,
      tip_cents: donation.tip_cents ?? 0,
      processing_fee_cents: donation.processing_fee_cents ?? 0,
      tax_deductible_amount_cents: taxDeductible ? donation.amount_cents : 0,
      currency: (donation.currency ?? 'usd').toLowerCase(),
      status: donation.status,
    };
  });
}

export function taxDeductibleByCurrency(records: TaxReportRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((totals, record) => {
    const currency = record.currency.toLowerCase();
    totals[currency] = (totals[currency] ?? 0) + record.tax_deductible_amount_cents;
    return totals;
  }, {});
}

export function taxSummaryLabel(records: TaxReportRecord[]): string {
  const totals = taxDeductibleByCurrency(records);
  const entries = Object.entries(totals).filter(([, cents]) => cents > 0);
  if (entries.length === 0) return 'No tax-deductible gifts recorded';
  return entries.map(([currency, cents]) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)).join(' + ');
}
