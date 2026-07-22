import { CAMPAIGN_CATEGORIES, type CampaignCategory } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic prompt → structured campaign fields.
//
// The "Build with AI" path lets an organizer describe their cause in plain
// language. This turns that free text into the few structured fields the wizard
// otherwise asks for (category, goal, urgency) so the AI path genuinely reduces
// the number of questions — with zero external dependency, so it always works
// (and is fully unit-testable) even with no AI key configured. It never guesses
// the beneficiary's identity: inventing beneficiary facts is out of bounds.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedCampaignFields {
  category?: CampaignCategory;
  goalCents?: number;
  urgency?: 'urgent' | 'normal';
}

// Priority-ordered category signals — more specific/urgent causes win over
// generic ones (e.g. "memorial" before "family", "house fire" before "community").
const CATEGORY_SIGNALS: { category: CampaignCategory; keywords: string[] }[] = [
  { category: 'Memorial',    keywords: ['memorial', 'funeral', 'burial', 'passed away', 'passing', 'celebration of life', 'in memory', 'laid to rest'] },
  { category: 'Medical',     keywords: ['surgery', 'hospital', 'medical', 'cancer', 'chemo', 'treatment', 'diagnosis', 'transplant', 'icu', 'illness', 'injury', 'recovery', 'therapy', 'health'] },
  { category: 'Emergency',   keywords: ['house fire', 'wildfire', 'fire', 'flood', 'hurricane', 'tornado', 'earthquake', 'disaster', 'emergency', 'evicted', 'eviction', 'homeless', 'robbed', 'stolen', 'accident', 'relief'] },
  { category: 'Education',   keywords: ['tuition', 'scholarship', 'college', 'university', 'school', 'student', 'education', 'classroom', 'textbook', 'degree'] },
  { category: 'Animal',      keywords: ['dog', 'cat', 'puppy', 'kitten', 'pet', 'animal', 'wildlife rescue', 'shelter', 'veterinary', 'vet bill', 'rescue'] },
  { category: 'Environment', keywords: ['environment', 'climate', 'conservation', 'reforest', 'ocean', 'pollution', 'sustainab', 'planet', 'green energy'] },
  { category: 'Faith',       keywords: ['church', 'mosque', 'temple', 'synagogue', 'faith', 'ministry', 'mission trip', 'parish', 'congregation'] },
  { category: 'Sports',      keywords: ['team', 'soccer', 'basketball', 'football', 'baseball', 'athletic', 'league', 'tournament', 'sports'] },
  { category: 'Creative',    keywords: ['film', 'album', 'music video', 'art project', 'book', 'video game', 'podcast', 'documentary', 'creative', 'gallery'] },
  { category: 'Business',    keywords: ['business', 'startup', 'small shop', 'store', 'restaurant', 'food truck', 'launch my', 'my company'] },
  { category: 'Event',       keywords: ['wedding', 'gala', 'reunion', 'festival', 'conference', 'fundraising event'] },
  { category: 'Education',   keywords: ['books for'] },
  { category: 'Family',      keywords: ['baby', 'adoption', 'childcare', 'my kids', 'newborn', 'maternity', 'family in need'] },
  { category: 'Travel',      keywords: ['relocat', 'moving abroad', 'flight home', 'travel', 'trip'] },
  { category: 'Volunteer',   keywords: ['volunteer'] },
  { category: 'Wishes',      keywords: ['birthday', 'make a wish', 'dream', 'bucket list', 'gift for'] },
  { category: 'Nonprofit',   keywords: ['nonprofit', 'non-profit', 'charity', 'foundation', '501c3', '501(c)(3)', 'ngo'] },
  { category: 'Community',   keywords: ['community', 'neighborhood', 'neighbor', 'mutual aid', 'local', 'food bank'] },
];

const URGENCY_SIGNALS = ['urgent', 'urgently', 'emergency', 'immediately', 'asap', 'right now', 'time-sensitive', 'critical', 'desperately', "can't wait", 'cannot wait'];

function detectCategory(text: string): CampaignCategory | undefined {
  for (const { category, keywords } of CATEGORY_SIGNALS) {
    if (keywords.some(k => text.includes(k))) return category;
  }
  return undefined;
}

// Parse the most plausible fundraising target from the text. Recognises $-prefixed
// amounts, k/m/thousand/million suffixes, and "<n> dollars". Prefers explicitly
// marked money over bare numbers so "replace 3 chairs" isn't read as a $3 goal.
function detectGoalCents(text: string): number | undefined {
  const re = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?|\b(\d[\d,]*(?:\.\d+)?)\s?(k|m|thousand|million|dollars|usd)\b/gi;
  let best: number | undefined;
  for (const m of text.matchAll(re)) {
    const numRaw = m[1] ?? m[3];
    const unit = (m[2] ?? m[4] ?? '').toLowerCase();
    if (!numRaw) continue;
    let value = parseFloat(numRaw.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    if (unit === 'k' || unit === 'thousand') value *= 1_000;
    else if (unit === 'm' || unit === 'million') value *= 1_000_000;
    // Keep the largest plausible amount (the headline goal, not an aside).
    if (value >= 1 && (best === undefined || value > best)) best = value;
  }
  if (best === undefined) return undefined;
  const cents = Math.round(best * 100);
  // Clamp to the same bounds the campaign API accepts.
  return Math.min(Math.max(cents, 10_000), 1_000_000_000);
}

export function extractCampaignFields(prompt: string): ExtractedCampaignFields {
  const text = (prompt || '').toLowerCase();
  if (!text.trim()) return {};
  const out: ExtractedCampaignFields = {};
  const category = detectCategory(text);
  if (category) out.category = category;
  const goalCents = detectGoalCents(text);
  if (goalCents !== undefined) out.goalCents = goalCents;
  if (URGENCY_SIGNALS.some(k => text.includes(k))) out.urgency = 'urgent';
  return out;
}

// Guard so the category list can't silently drift from the shared source.
export const KNOWN_CATEGORIES = new Set<string>(CAMPAIGN_CATEGORIES);
