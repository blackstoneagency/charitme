export type MaybeDemoRow = {
  is_demo?: unknown;
};

// Loose data must never cause a real campaign to be labelled as a demo.
export function isDemoCampaign(row: MaybeDemoRow | null | undefined): boolean {
  if (!row) return false;
  return row.is_demo === true;
}

export const DEMO_BADGE_LABEL = 'Demo campaign';

export const DEMO_BADGE_EXPLANATION =
  'This is seeded example data, not a real fundraiser. It cannot accept donations.';
