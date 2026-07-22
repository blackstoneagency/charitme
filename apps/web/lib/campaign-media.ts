const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const MEDIA_PATH_PATTERN = new RegExp(
  `^campaigns/(${UUID_PATTERN})/(cover|gallery|video)/(${UUID_PATTERN})\\.(jpeg|jpg|png|gif|webp|avif)$`,
  'i',
);

export type CampaignMediaPath = {
  ownerId: string;
  slot: 'cover' | 'gallery' | 'video';
};

export function parseCampaignMediaPath(path: string): CampaignMediaPath | null {
  const match = MEDIA_PATH_PATTERN.exec(path);
  if (!match) return null;
  const slot = match[2]?.toLowerCase();
  if (slot !== 'cover' && slot !== 'gallery' && slot !== 'video') return null;
  return { ownerId: match[1]!, slot };
}
