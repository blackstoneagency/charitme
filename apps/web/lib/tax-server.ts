import 'server-only';
import { supabaseAdmin } from './supabase';
import {
  buildFundraiserTaxSummary,
  buildTaxStatement,
  donationYears,
  fundraiserYears,
  type FundraiserDonationInput,
  type FundraiserTaxSummary,
  type TaxDonationInput,
  type NonprofitTaxInfo,
  type TaxStatement,
} from './tax';
import { normalizeReceiptEmail } from './tax-receipt-access';

const TAX_PAGE_SIZE = 1000;

type DonorDonationRow = {
  id: string;
  donor_id: string | null;
  amount_cents: number;
  tip_cents: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  campaign_id: string;
  campaigns: { title: string; user_id: string } | null;
};

type TaxReceiptRow = {
  donation_id: string | null;
  receipt_number: string;
};

type DonationReceiptRow = TaxReceiptRow & {
  donor_id: string | null;
  donor_email: string | null;
};

type OwnedCampaignRow = {
  id: string;
  title: string;
};

type FundraiserDonationRow = {
  amount_cents: number;
  tip_cents: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  campaign_id: string;
};

async function loadDonorDonationRows(donorId: string): Promise<DonorDonationRow[]> {
  const rows: DonorDonationRow[] = [];
  for (let offset = 0; ; offset += TAX_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('donations')
      .select('id, donor_id, amount_cents, tip_cents, currency, status, created_at, campaign_id, campaigns:campaign_id(title, user_id)')
      .eq('donor_id', donorId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + TAX_PAGE_SIZE - 1);
    if (error || data == null) throw new Error('TAX_DATA_UNAVAILABLE');
    rows.push(...(data as unknown as DonorDonationRow[]));
    if (data.length < TAX_PAGE_SIZE) return rows;
  }
}

async function loadTaxReceiptRows(donorId: string): Promise<TaxReceiptRow[]> {
  const rows: TaxReceiptRow[] = [];
  for (let offset = 0; ; offset += TAX_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('tax_receipts')
      .select('donation_id, receipt_number')
      .eq('donor_id', donorId)
      .range(offset, offset + TAX_PAGE_SIZE - 1);
    if (error || data == null) throw new Error('TAX_DATA_UNAVAILABLE');
    rows.push(...(data as TaxReceiptRow[]));
    if (data.length < TAX_PAGE_SIZE) return rows;
  }
}

async function loadGuestReceiptRows(donorEmail: string): Promise<DonationReceiptRow[]> {
  const rows: DonationReceiptRow[] = [];
  for (let offset = 0; ; offset += TAX_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('donation_receipts')
      .select('donation_id, donor_id, donor_email, receipt_number')
      .eq('donor_email', donorEmail)
      .range(offset, offset + TAX_PAGE_SIZE - 1);
    if (error || data == null) throw new Error('TAX_DATA_UNAVAILABLE');
    rows.push(...(data as DonationReceiptRow[]));
    if (data.length < TAX_PAGE_SIZE) return rows;
  }
}

async function loadDonorDonationRowsByIds(donationIds: string[]): Promise<DonorDonationRow[]> {
  const rows: DonorDonationRow[] = [];
  for (let index = 0; index < donationIds.length; index += 200) {
    const chunk = donationIds.slice(index, index + 200);
    for (let offset = 0; ; offset += TAX_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('donations')
        .select('id, donor_id, amount_cents, tip_cents, currency, status, created_at, campaign_id, campaigns:campaign_id(title, user_id)')
        .in('id', chunk)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + TAX_PAGE_SIZE - 1);
      if (error || data == null) throw new Error('TAX_DATA_UNAVAILABLE');
      rows.push(...(data as unknown as DonorDonationRow[]));
      if (data.length < TAX_PAGE_SIZE) break;
    }
  }
  return rows;
}

async function loadOwnedCampaignRows(ownerId: string): Promise<OwnedCampaignRow[]> {
  const rows: OwnedCampaignRow[] = [];
  for (let offset = 0; ; offset += TAX_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('id, title')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + TAX_PAGE_SIZE - 1);
    if (error || data == null) throw new Error('TAX_DATA_UNAVAILABLE');
    rows.push(...(data as OwnedCampaignRow[]));
    if (data.length < TAX_PAGE_SIZE) return rows;
  }
}

async function loadFundraiserDonationRows(campaignIds: string[]): Promise<FundraiserDonationRow[]> {
  const rows: FundraiserDonationRow[] = [];
  const campaignIdChunks: string[][] = [];
  for (let index = 0; index < campaignIds.length; index += 200) {
    campaignIdChunks.push(campaignIds.slice(index, index + 200));
  }
  for (const campaignChunk of campaignIdChunks) {
    for (let offset = 0; ; offset += TAX_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from('donations')
        .select('amount_cents, tip_cents, currency, status, created_at, campaign_id')
        .in('campaign_id', campaignChunk)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + TAX_PAGE_SIZE - 1);
      if (error || data == null) throw new Error('TAX_DATA_UNAVAILABLE');
      rows.push(...(data as FundraiserDonationRow[]));
      if (data.length < TAX_PAGE_SIZE) break;
    }
  }
  return rows;
}

/**
 * Load a donor's completed donations (across every campaign), resolve which
 * were given to verified receipt-enabled nonprofits, and shape them into the
 * pure tax-statement builder's input. Shared by the JSON/CSV API route and the
 * printable statement page so deductibility is computed identically in both.
 */
export async function loadDonorTaxInputs(
  donorId: string,
  donorEmail?: string | null,
): Promise<TaxDonationInput[]> {
  const [ownedDonations, rawReceipts] = await Promise.all([
    loadDonorDonationRows(donorId),
    loadTaxReceiptRows(donorId),
  ]);
  const normalizedEmail = normalizeReceiptEmail(donorEmail);
  const guestReceipts = normalizedEmail
    ? (await loadGuestReceiptRows(normalizedEmail)).filter(
      (receipt) => receipt.donor_id === null || receipt.donor_id === donorId,
    )
    : [];
  const ownedDonationIds = new Set(ownedDonations.map((donation) => donation.id));
  const guestDonationIds = guestReceipts
    .map((receipt) => receipt.donation_id)
    .filter((donationId): donationId is string => Boolean(donationId) && !ownedDonationIds.has(donationId as string));
  const guestDonations = guestDonationIds.length > 0
    ? await loadDonorDonationRowsByIds(guestDonationIds)
    : [];
  const donations = [
    ...ownedDonations,
    ...guestDonations.filter(
      (donation) => donation.donor_id === null || donation.donor_id === donorId,
    ),
  ];
  const receiptByDonation = new Map(
    [...guestReceipts, ...rawReceipts]
      .filter((receipt) => Boolean(receipt.donation_id))
      .map((receipt) => [receipt.donation_id as string, receipt.receipt_number]),
  );

  const ownerIds = [...new Set(donations.map((d) => d.campaigns?.user_id).filter(Boolean) as string[])];
  const nonprofitByOwner = new Map<string, NonprofitTaxInfo>();
  if (ownerIds.length > 0) {
    const { data: nps, error: nonprofitError } = await supabaseAdmin
      .from('nonprofit_profiles')
      .select('owner_id, name, tax_id, verified, verification_status, tax_receipt_enabled')
      .in('owner_id', ownerIds);
    if (nonprofitError) throw new Error('TAX_DATA_UNAVAILABLE');
    for (const np of (nps ?? []) as {
      owner_id: string; name: string; tax_id: string | null;
      verified: boolean; verification_status: string; tax_receipt_enabled: boolean;
    }[]) {
      const verified = Boolean(np.verified) || np.verification_status === 'verified';
      nonprofitByOwner.set(np.owner_id, {
        name: np.name,
        taxId: np.tax_id ?? null,
        verified,
        taxReceiptEnabled: Boolean(np.tax_receipt_enabled),
      });
    }
  }

  return donations.map((d) => {
    const ownerId = d.campaigns?.user_id;
    const nonprofit = ownerId ? nonprofitByOwner.get(ownerId) ?? null : null;
    return {
      id: d.id,
      amountCents: d.amount_cents,
      tipCents: d.tip_cents ?? 0,
      currency: d.currency,
      status: d.status,
      createdAt: d.created_at,
      campaignId: d.campaign_id,
      campaignTitle: d.campaigns?.title ?? 'CharitMe campaign',
      receiptNumber: receiptByDonation.get(d.id) ?? null,
      nonprofit,
    };
  });
}

export async function getDonorTaxStatement(
  donorId: string,
  year: number,
  currency?: string,
  donorEmail?: string | null,
): Promise<{ statement: TaxStatement; availableYears: number[] }> {
  const inputs = await loadDonorTaxInputs(donorId, donorEmail);
  const selected = currency
    ? inputs.filter((input) => (input.currency ?? 'usd').toLowerCase() === currency.toLowerCase())
    : inputs;
  return { statement: buildTaxStatement(selected, year), availableYears: donationYears(inputs) };
}

export async function loadFundraiserTaxInputs(ownerId: string): Promise<FundraiserDonationInput[]> {
  const ownedCampaigns = await loadOwnedCampaignRows(ownerId);
  if (ownedCampaigns.length === 0) return [];

  const titleById = new Map(ownedCampaigns.map((campaign) => [campaign.id, campaign.title]));
  const donations = await loadFundraiserDonationRows(
    ownedCampaigns.map((campaign) => campaign.id),
  );
  return donations.map((donation) => ({
    amountCents: donation.amount_cents,
    tipCents: donation.tip_cents ?? 0,
    currency: donation.currency,
    status: donation.status,
    createdAt: donation.created_at,
    campaignId: donation.campaign_id,
    campaignTitle: titleById.get(donation.campaign_id) ?? 'CharitMe campaign',
  }));
}

export async function getFundraiserTaxSummary(
  ownerId: string,
  year: number,
  currency?: string,
): Promise<{ summary: FundraiserTaxSummary; availableYears: number[] }> {
  const inputs = await loadFundraiserTaxInputs(ownerId);
  const selected = currency
    ? inputs.filter((input) => (input.currency ?? 'usd').toLowerCase() === currency.toLowerCase())
    : inputs;
  return {
    summary: buildFundraiserTaxSummary(selected, year),
    availableYears: fundraiserYears(inputs),
  };
}
