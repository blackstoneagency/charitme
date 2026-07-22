// ─────────────────────────────────────────────────────────────────────────────
// Campaign story analysis (pure, unit-testable).
//
// Real, computed quality signals for the "Strengthen your story" panel — replacing
// the previously-hardcoded badges. No I/O, no AI: cheap heuristics that run live as
// the organizer types. Sibling UI: the story step of app/create/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export type SignalTone = 'good' | 'ok' | 'warn';

export interface StorySignal {
  id: string;
  label: string;
  tone: SignalTone;
  detail?: string;
}

export interface StoryAnalysis {
  wordCount: number;
  signals: StorySignal[];
}

// Claims that read as unverifiable / risky in a fundraising story. Kept short and
// specific to avoid false positives on ordinary language.
const RISKY_CLAIM_PATTERNS: { re: RegExp; word: string }[] = [
  { re: /\bguarantee(d|s)?\b/i, word: 'guaranteed' },
  { re: /\b100%\s+(of\s+)?(donations?|proceeds?|funds?)\b/i, word: '100% of donations' },
  { re: /\bmiracle\b/i, word: 'miracle' },
  { re: /\bcure(s|d)?\b/i, word: 'cure' },
  { re: /\brisk[-\s]?free\b/i, word: 'risk-free' },
  { re: /\bno\s+risk\b/i, word: 'no risk' },
  { re: /\btax[-\s]?deductible\b/i, word: 'tax-deductible' },
];

const ASK_PATTERN = /\b(help|support|donate|donation|contribut|need|raise|goal|please|fund)\w*/i;
const NUMBER_PATTERN = /(\$\s?\d|\d[\d,]*\s?(dollars|usd|%|percent)|\b\d{2,})/i;

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function paragraphs(text: string): number {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length;
}

export function analyzeStory(text: string): StoryAnalysis {
  const wc = words(text).length;
  const signals: StorySignal[] = [];

  // Length
  signals.push(
    wc >= 50
      ? { id: 'length', label: 'Good length', tone: 'good' }
      : wc >= 25
        ? { id: 'length', label: 'Getting there', tone: 'ok', detail: 'Aim for ~50+ words.' }
        : { id: 'length', label: 'Too short', tone: 'warn', detail: 'Add a few more sentences.' },
  );

  // Structure (paragraphs)
  const paras = paragraphs(text);
  signals.push(
    paras >= 2
      ? { id: 'structure', label: 'Well structured', tone: 'good' }
      : { id: 'structure', label: 'Break into paragraphs', tone: 'ok', detail: 'Split your story into 2+ paragraphs.' },
  );

  // Specifics (numbers / amounts build trust)
  signals.push(
    NUMBER_PATTERN.test(text)
      ? { id: 'specifics', label: 'Includes specifics', tone: 'good' }
      : { id: 'specifics', label: 'Add specifics', tone: 'ok', detail: 'Concrete numbers (costs, dates) build trust.' },
  );

  // Clear ask
  signals.push(
    ASK_PATTERN.test(text)
      ? { id: 'ask', label: 'Clear ask', tone: 'good' }
      : { id: 'ask', label: 'State your ask', tone: 'warn', detail: 'Tell donors how their help makes a difference.' },
  );

  // Risky / unverifiable claims
  const found = RISKY_CLAIM_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.word);
  signals.push(
    found.length === 0
      ? { id: 'claims', label: 'No risky claims', tone: 'good' }
      : { id: 'claims', label: 'Review these claims', tone: 'warn', detail: `Unverifiable/risky wording: ${found.join(', ')}.` },
  );

  return { wordCount: wc, signals };
}
