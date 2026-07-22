// Curated, static directory of large employers publicly known to offer
// charitable donation matching programs for employees. Ratios/caps vary by
// company and change over time, so we surface a general indicator only and
// always point donors to confirm specifics with their employer.

export interface EmployerMatchEntry {
  name: string;
  /** General, non-binding indicator of how the company typically matches gifts */
  typicalRatio: string;
}

export const EMPLOYER_MATCH_DATABASE: EmployerMatchEntry[] = [
  { name: 'Microsoft', typicalRatio: 'Up to 1:1' },
  { name: 'Google', typicalRatio: 'Up to 1:1' },
  { name: 'Alphabet', typicalRatio: 'Up to 1:1' },
  { name: 'Apple', typicalRatio: 'Up to 1:1' },
  { name: 'Amazon', typicalRatio: 'Up to 1:1' },
  { name: 'Meta', typicalRatio: 'Up to 1:1' },
  { name: 'Salesforce', typicalRatio: 'Up to 1:1' },
  { name: 'Adobe', typicalRatio: 'Up to 1:1' },
  { name: 'Intel', typicalRatio: 'Up to 1:1' },
  { name: 'IBM', typicalRatio: 'Up to 1:1' },
  { name: 'Oracle', typicalRatio: 'Up to 1:1' },
  { name: 'SAP', typicalRatio: 'Up to 1:1' },
  { name: 'Cisco', typicalRatio: 'Up to 1:1' },
  { name: 'Dell', typicalRatio: 'Up to 1:1' },
  { name: 'HP', typicalRatio: 'Up to 1:1' },
  { name: 'Nvidia', typicalRatio: 'Up to 1:1' },
  { name: 'PayPal', typicalRatio: 'Up to 1:1' },
  { name: 'Visa', typicalRatio: 'Up to 1:1' },
  { name: 'Mastercard', typicalRatio: 'Up to 1:1' },
  { name: 'American Express', typicalRatio: 'Up to 1:1' },
  { name: 'Bank of America', typicalRatio: 'Up to 1:1' },
  { name: 'JPMorgan Chase', typicalRatio: 'Up to 1:1' },
  { name: 'Wells Fargo', typicalRatio: 'Up to 1:1' },
  { name: 'Citigroup', typicalRatio: 'Up to 1:1' },
  { name: 'Goldman Sachs', typicalRatio: 'Up to 1:1' },
  { name: 'Morgan Stanley', typicalRatio: 'Up to 1:1' },
  { name: 'Charles Schwab', typicalRatio: 'Up to 1:1' },
  { name: 'Capital One', typicalRatio: 'Up to 1:1' },
  { name: 'State Farm', typicalRatio: 'Up to 1:1' },
  { name: 'Allstate', typicalRatio: 'Up to 1:1' },
  { name: 'Progressive', typicalRatio: 'Up to 1:1' },
  { name: 'MetLife', typicalRatio: 'Up to 1:1' },
  { name: 'Prudential Financial', typicalRatio: 'Up to 1:1' },
  { name: 'Johnson & Johnson', typicalRatio: 'Up to 1:1' },
  { name: 'Pfizer', typicalRatio: 'Up to 1:1' },
  { name: 'Merck', typicalRatio: 'Up to 1:1' },
  { name: 'UnitedHealth Group', typicalRatio: 'Up to 1:1' },
  { name: 'CVS Health', typicalRatio: 'Up to 1:1' },
  { name: 'Procter & Gamble', typicalRatio: 'Up to 1:1' },
  { name: 'Coca-Cola', typicalRatio: 'Up to 1:1' },
  { name: 'PepsiCo', typicalRatio: 'Up to 1:1' },
  { name: 'Nike', typicalRatio: 'Up to 1:1' },
  { name: 'Target', typicalRatio: 'Up to 1:1' },
  { name: 'Walmart', typicalRatio: 'Up to 1:1' },
  { name: 'Costco', typicalRatio: 'Up to 1:1' },
  { name: 'Home Depot', typicalRatio: 'Up to 1:1' },
  { name: 'Lowe’s', typicalRatio: 'Up to 1:1' },
  { name: 'Starbucks', typicalRatio: 'Up to 1:1' },
  { name: 'McDonald’s', typicalRatio: 'Up to 1:1' },
  { name: 'Disney', typicalRatio: 'Up to 1:1' },
  { name: 'Comcast', typicalRatio: 'Up to 1:1' },
  { name: 'AT&T', typicalRatio: 'Up to 1:1' },
  { name: 'Verizon', typicalRatio: 'Up to 1:1' },
  { name: 'T-Mobile', typicalRatio: 'Up to 1:1' },
  { name: 'Boeing', typicalRatio: 'Up to 2:1' },
  { name: 'Lockheed Martin', typicalRatio: 'Up to 3:1' },
  { name: 'General Electric', typicalRatio: 'Up to 1:1' },
  { name: 'General Motors', typicalRatio: 'Up to 1:1' },
  { name: 'Ford', typicalRatio: 'Up to 1:1' },
  { name: 'ExxonMobil', typicalRatio: 'Up to 3:1' },
  { name: 'Chevron', typicalRatio: 'Up to 1:1' },
  { name: 'Deloitte', typicalRatio: 'Up to 1:1' },
  { name: 'PwC', typicalRatio: 'Up to 1:1' },
  { name: 'EY', typicalRatio: 'Up to 1:1' },
  { name: 'KPMG', typicalRatio: 'Up to 1:1' },
  { name: 'Accenture', typicalRatio: 'Up to 1:1' },
  { name: 'McKinsey & Company', typicalRatio: 'Up to 1:1' },
  { name: 'Booz Allen Hamilton', typicalRatio: 'Up to 1:1' },
  { name: 'UPS', typicalRatio: 'Up to 1:1' },
  { name: 'FedEx', typicalRatio: 'Up to 1:1' },
  { name: 'Southwest Airlines', typicalRatio: 'Up to 1:1' },
  { name: 'Delta Air Lines', typicalRatio: 'Up to 1:1' },
  { name: 'United Airlines', typicalRatio: 'Up to 1:1' },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function searchEmployerMatch(query: string, limit = 8): EmployerMatchEntry[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  return EMPLOYER_MATCH_DATABASE
    .filter((e) => normalize(e.name).includes(q))
    .slice(0, limit);
}

// ── Match calculation (pure, unit-testable) ──────────────────────────────────
// The directory's `typicalRatio` strings ("Up to 1:1", "Up to 3:1") are
// human-readable indicators. These helpers parse them into a numeric multiplier
// so we can show a donor what their gift could become — always framed as an
// estimate ("up to"), never a promise, since real terms/caps live with the
// employer. Used by the donor-facing employer-match widget in the donate flow.

export interface MatchRatio {
  /** Matched dollars per donated dollar (e.g. 2 for "2:1"). */
  multiplier: number;
  /** True when the source says "up to" — i.e. the multiplier is a ceiling. */
  isCeiling: boolean;
  /** Original label, e.g. "Up to 2:1". */
  label: string;
}

/** Parse a ratio string like "Up to 2:1" → { multiplier: 2, isCeiling: true }. */
export function parseMatchRatio(ratio: string): MatchRatio | null {
  if (!ratio) return null;
  const m = ratio.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const den = parseFloat(m[2]);
  if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return null;
  return {
    multiplier: num / den,
    isCeiling: /up\s*[-\s]?\s*to/i.test(ratio),
    label: ratio.trim(),
  };
}

export interface EmployerMatchEstimate {
  donationCents: number;
  multiplier: number;
  isCeiling: boolean;
  /** Estimated employer-matched amount, after any cap. */
  matchedCents: number;
  /** Donation + matched — the total the campaign could see from this gift. */
  totalImpactCents: number;
  /** True when an employer cap reduced the raw matched amount. */
  capped: boolean;
  ratioLabel: string;
}

/**
 * Estimate an employer match for a donation. `capCents`, when provided, is the
 * employer's per-donation (or remaining annual) matching cap. Returns null when
 * the entry's ratio can't be parsed. Never negative; rounds to whole cents.
 */
export function estimateEmployerMatch(
  donationCents: number,
  entry: Pick<EmployerMatchEntry, 'typicalRatio'>,
  capCents?: number,
): EmployerMatchEstimate | null {
  const ratio = parseMatchRatio(entry.typicalRatio);
  if (!ratio) return null;

  const donation = Math.max(0, Math.round(donationCents || 0));
  const raw = Math.max(0, Math.round(donation * ratio.multiplier));
  const cap = capCents != null ? Math.max(0, Math.round(capCents)) : null;
  const matched = cap != null ? Math.min(raw, cap) : raw;

  return {
    donationCents: donation,
    multiplier: ratio.multiplier,
    isCeiling: ratio.isCeiling,
    matchedCents: matched,
    totalImpactCents: donation + matched,
    capped: cap != null && raw > matched,
    ratioLabel: ratio.label,
  };
}
