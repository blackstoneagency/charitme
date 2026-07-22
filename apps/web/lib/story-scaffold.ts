// ─────────────────────────────────────────────────────────────────────────────
// Structured story scaffold + tone presets (pure, unit-testable).
//
// Powers the "Guided sections" authoring mode on the story step of
// app/create/page.tsx. Organizers who freeze on a blank textarea get four
// focused prompts — intro, problem, solution, ask — that compose into the SAME
// single `description` field the freeform editor writes, so there is no schema
// change and no lossy fork of the data model. Tone presets map to the AI
// endpoint's existing `tone` parameter.
// ─────────────────────────────────────────────────────────────────────────────

export type StorySectionId = 'intro' | 'problem' | 'solution' | 'ask';

export interface StorySectionDef {
  id: StorySectionId;
  label: string;
  prompt: string;
  hint: string;
}

// Ordered — this is also the order paragraphs are composed and re-parsed in.
export const STORY_SECTIONS: StorySectionDef[] = [
  {
    id: 'intro',
    label: 'Introduce yourself',
    prompt: 'Who are you, and who is this fundraiser for?',
    hint: 'A name and a face build trust immediately.',
  },
  {
    id: 'problem',
    label: 'What happened',
    prompt: 'What is the challenge or situation you are facing?',
    hint: 'Be specific and honest — dates, places, and facts.',
  },
  {
    id: 'solution',
    label: 'How funds help',
    prompt: 'Exactly what will the money be used for?',
    hint: 'Break it down: costs, care, rent, equipment, travel…',
  },
  {
    id: 'ask',
    label: 'Your ask',
    prompt: 'What do you want donors to do, and what does their help mean?',
    hint: 'Invite people to give and to share — both matter.',
  },
];

export type StorySections = Record<StorySectionId, string>;

export function emptySections(): StorySections {
  return { intro: '', problem: '', solution: '', ask: '' };
}

/** Join the non-empty sections, in canonical order, into a single story. */
export function composeStory(sections: StorySections): string {
  return STORY_SECTIONS.map((s) => sections[s.id]?.trim())
    .filter((v): v is string => Boolean(v && v.length))
    .join('\n\n');
}

/**
 * Best-effort split of an existing freeform story back into sections so the
 * guided editor can seed itself without clobbering what the organizer wrote.
 * Paragraphs map to sections in order; any surplus paragraphs fold into the
 * final "ask" section so nothing is ever dropped.
 */
export function sectionsFromText(text: string): StorySections {
  const out = emptySections();
  const paras = (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 0) return out;

  const ids: StorySectionId[] = ['intro', 'problem', 'solution', 'ask'];
  paras.forEach((para, i) => {
    const id = ids[Math.min(i, ids.length - 1)];
    out[id] = out[id] ? `${out[id]}\n\n${para}` : para;
  });
  return out;
}

/** Count how many sections are meaningfully filled (≥ 15 chars). */
export function sectionsFilled(sections: StorySections): number {
  return STORY_SECTIONS.filter((s) => (sections[s.id]?.trim().length ?? 0) >= 15).length;
}

// ── Tone presets ──────────────────────────────────────────────────────────────
// Each maps to the AI campaign endpoint's `tone` parameter (see
// app/api/ai/campaign/route.ts). "authentic" is the default the story step uses.
export interface TonePreset {
  id: string;
  label: string;
  description: string;
  /** Value sent as the AI endpoint's `tone`. */
  tone: string;
}

export const TONE_PRESETS: TonePreset[] = [
  { id: 'authentic', label: 'Heartfelt', description: 'Warm, personal, sincere.', tone: 'authentic' },
  { id: 'urgent', label: 'Urgent', description: 'Time-sensitive, direct call to act now.', tone: 'urgent' },
  { id: 'hopeful', label: 'Hopeful', description: 'Uplifting and forward-looking.', tone: 'hopeful' },
  { id: 'plain', label: 'Straightforward', description: 'Clear, factual, no embellishment.', tone: 'straightforward' },
];

export function toneById(id: string): TonePreset | undefined {
  return TONE_PRESETS.find((t) => t.id === id);
}
