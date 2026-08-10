export const LABEL_DEMO_CONFIRMATION = 'LABEL SELECTED DEMO CAMPAIGNS';
export const ARCHIVE_DEMO_CONFIRMATION = 'ARCHIVE SELECTED DEMO CAMPAIGNS';

const HASHED_SEED_SLUG = /^campaign-[0-9]+-[0-9a-f]{8}$/;

export function isApprovedDemoSeedSlug(slug: string): boolean {
  return slug.startsWith('seed-campaign-') || HASHED_SEED_SLUG.test(slug);
}
