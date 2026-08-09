import { describe, it, expect } from 'vitest';
import { fromRemoteDraft, pickFreshestDraft, type CampaignDraft, type CampaignDraftImage } from '../lib/campaign-draft';

const mk = (ts: number, images: CampaignDraftImage[] = []): CampaignDraft => ({
  v: 1, ts, step: 'story', storyMode: 'guided', form: { title: 'T' }, images,
  builderPath: 'guided', schemaVersion: 2, sourceContext: {},
});

describe('fromRemoteDraft', () => {
  it('normalises a Supabase row into a draft', () => {
    const d = fromRemoteDraft({
      step: 'goal', story_mode: 'freeform', form: { title: 'Hi' },
      images: [{ url: 'https://x.test/a.jpg', name: 'a' }], client_ts: 123,
    });
    expect(d).toEqual({
      v: 1, ts: 123, step: 'goal', storyMode: 'freeform', form: { title: 'Hi' },
      images: [{ url: 'https://x.test/a.jpg', name: 'a', storagePath: '' }],
      builderPath: 'guided', schemaVersion: 1, sourceContext: {},
    });
  });

  it('returns null without a usable form', () => {
    expect(fromRemoteDraft(null)).toBeNull();
    expect(fromRemoteDraft({ form: null })).toBeNull();
    expect(fromRemoteDraft({ form: 'nope' as unknown })).toBeNull();
  });

  it('drops malformed image entries and defaults missing fields', () => {
    const d = fromRemoteDraft({ form: {}, images: [{ url: 'https://x.test/a.jpg' }, { name: 'no-url' }, null] as unknown });
    expect(d!.images).toEqual([{ url: 'https://x.test/a.jpg', name: '', storagePath: '' }]);
    expect(d!.ts).toBe(0);
    expect(d!.storyMode).toBe('freeform');
  });

  it('recovers the owned object path from a legacy canonical public URL', () => {
    const url = 'https://project.supabase.co/storage/v1/object/public/campaign-media/campaigns/user-id/cover/photo.webp';
    const d = fromRemoteDraft({ form: {}, images: [{ url, name: 'photo' }] });
    expect(d!.images[0]).toMatchObject({
      url,
      storagePath: 'campaigns/user-id/cover/photo.webp',
    });
  });
});

describe('pickFreshestDraft', () => {
  it('returns whichever side exists when the other is null', () => {
    const a = mk(5);
    expect(pickFreshestDraft(a, null)).toBe(a);
    expect(pickFreshestDraft(null, a)).toBe(a);
    expect(pickFreshestDraft(null, null)).toBeNull();
  });

  it('prefers the newer timestamp in both directions', () => {
    const local = mk(100); const remote = mk(200);
    expect(pickFreshestDraft(local, remote)).toBe(remote);
    expect(pickFreshestDraft(mk(300), mk(200))).toEqual(mk(300));
  });

  it('breaks a tie toward the copy that still has images', () => {
    const local = mk(100);
    const remote = mk(100, [{ url: 'https://x.test/a.jpg', name: 'a', storagePath: '' }]);
    expect(pickFreshestDraft(local, remote)).toBe(remote);
  });

  it('keeps the local copy on a tie when neither side has more images', () => {
    const local = mk(100, [{ url: 'https://x.test/a.jpg', name: 'a', storagePath: '' }]);
    const remote = mk(100);
    expect(pickFreshestDraft(local, remote)).toBe(local);
  });
});
