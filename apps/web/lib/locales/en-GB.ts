// English (United Kingdom) — overrides ONLY where British usage genuinely differs
// from the American source. Everything else resolves to `en`.
//
// Deliberately short. An earlier version restated seven keys identical to `en`
// ("Settings", "Analytics", "Apply"…), which the coverage test rejected: a region
// dictionary that repeats its base is a duplicate waiting to drift apart.
import type { Dictionary } from '../i18n';

export const enGB: Dictionary = {
  // 'Organiser' is the only key where British spelling diverges from the source.
  'campaign.organizer': 'Organiser',
};
