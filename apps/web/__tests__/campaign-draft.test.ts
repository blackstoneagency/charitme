import { describe, it, expect } from 'vitest';
import {
  buildDraft,
  serializeDraft,
  parseDraft,
  draftHasContent,
  draftAgeLabel,
  CAMPAIGN_DRAFT_TTL_MS,
} from '../lib/campaign-draft';

const form = { title: 'Help Sam', description: 'A story', goal: '5000', tagline: '', beneficiaryName: '', zipCode: '' };

describe('buildDraft / serializeDraft / parseDraft round-trip', () => {
  it('round-trips a draft', () => {
    const d = buildDraft({ step: 'story', storyMode: 'guided', form, images: [{ url: 'u', name: 'n' }], now: 1000 });
    const back = parseDraft(serializeDraft(d), 1000);
    expect(back).toEqual(d);
  });

  it('returns null for missing/blank/garbage input', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('')).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('123')).toBeNull();
  });

  it('rejects a wrong-version payload', () => {
    expect(parseDraft(JSON.stringify({ v: 2, ts: Date.now(), form }))).toBeNull();
  });

  it('rejects a draft older than the TTL (or with a future timestamp)', () => {
    const d = serializeDraft(buildDraft({ step: 's', storyMode: 'freeform', form, images: [], now: 0 }));
    expect(parseDraft(d, CAMPAIGN_DRAFT_TTL_MS + 1)).toBeNull(); // expired
    expect(parseDraft(d, -1)).toBeNull(); // clock skew / future
    expect(parseDraft(d, CAMPAIGN_DRAFT_TTL_MS - 1)).not.toBeNull(); // still fresh
  });

  it('drops malformed image entries defensively', () => {
    const raw = JSON.stringify({ v: 1, ts: 5, form, images: [{ url: 'ok', name: 'n' }, { name: 'bad' }, null] });
    expect(parseDraft(raw, 5)!.images).toEqual([{ url: 'ok', name: 'n' }]);
  });
});

describe('draftHasContent', () => {
  it('is true when any meaningful field is filled', () => {
    expect(draftHasContent({ title: 'x' } as Record<string, string>)).toBe(true);
    expect(draftHasContent({ goal: '100' } as Record<string, string>)).toBe(true);
  });
  it('is true when at least one image is present even with empty fields', () => {
    expect(draftHasContent({}, 1)).toBe(true);
  });
  it('is false for an untouched form', () => {
    expect(draftHasContent({ title: '', description: '  ' } as Record<string, string>, 0)).toBe(false);
    expect(draftHasContent(undefined)).toBe(false);
  });
});

describe('draftAgeLabel', () => {
  it('formats relative ages', () => {
    expect(draftAgeLabel(1000, 1000)).toBe('just now');
    expect(draftAgeLabel(0, 90_000)).toBe('1 minute ago');
    expect(draftAgeLabel(0, 2 * 3600_000)).toBe('2 hours ago');
    expect(draftAgeLabel(0, 3 * 86_400_000)).toBe('3 days ago');
  });
});
