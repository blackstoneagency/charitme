export type CampaignVideo = {
  kind: 'embed';
  sourceUrl: string;
  previewUrl: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseCampaignVideoUrl(raw: string | null | undefined): CampaignVideo | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const candidate = host === 'youtu.be'
      ? pathSegments[0]
      : pathSegments[0] === 'shorts'
        ? pathSegments[1]
        : url.searchParams.get('v');
    if (!candidate || !YOUTUBE_ID.test(candidate)) return null;
    return {
      kind: 'embed',
      sourceUrl: url.toString(),
      previewUrl: `https://www.youtube-nocookie.com/embed/${candidate}`,
    };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const candidate = url.pathname.split('/').filter(Boolean).at(-1);
    if (!candidate || !/^\d{6,12}$/.test(candidate)) return null;
    return {
      kind: 'embed',
      sourceUrl: url.toString(),
      previewUrl: `https://player.vimeo.com/video/${candidate}`,
    };
  }
  return null;
}
