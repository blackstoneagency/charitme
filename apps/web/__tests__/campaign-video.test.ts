import { describe, expect, it } from 'vitest';
import { parseCampaignVideoUrl } from '../lib/campaign-video';

describe('parseCampaignVideoUrl', () => {
  it('normalizes supported YouTube and Vimeo links for preview', () => {
    expect(parseCampaignVideoUrl('https://youtu.be/dQw4w9WgXcQ')?.previewUrl)
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(parseCampaignVideoUrl('https://vimeo.com/123456789')?.previewUrl)
      .toBe('https://player.vimeo.com/video/123456789');
  });

  it('rejects insecure, unsupported, and malformed links', () => {
    expect(parseCampaignVideoUrl('http://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(parseCampaignVideoUrl('https://cdn.example.com/story.mp4')).toBeNull();
    expect(parseCampaignVideoUrl('https://example.com/watch')).toBeNull();
    expect(parseCampaignVideoUrl('not a url')).toBeNull();
  });
});
