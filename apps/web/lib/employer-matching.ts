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
