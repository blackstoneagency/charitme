'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Who is raising.
//
// This is NOT the same question as step 2's "who benefits". A neighbour raising
// for a family's vet bill is a personal campaign with someone else as the
// beneficiary; a registered charity raising for its own programme is a nonprofit
// campaign with itself as beneficiary. Collapsing the two questions is how a
// nonprofit ends up with no route to verification.
//
// The answer decides whether step 9 (verification) is worth showing: a
// registered organisation has documents to submit and a status worth proving,
// and an individual has neither.
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignPath = 'personal' | 'nonprofit' | 'team';

export const CAMPAIGN_PATHS: {
  id: CampaignPath;
  title: string;
  blurb: string;
  detail: string;
}[] = [
  {
    id: 'personal',
    title: 'Myself or someone I know',
    blurb: 'Medical bills, memorials, emergencies, education, a family in need.',
    detail: 'Most campaigns. Nothing to prove up front — you can add verification later if you want to.',
  },
  {
    id: 'nonprofit',
    title: 'A registered nonprofit',
    blurb: 'A charity, foundation or community organisation with charitable status.',
    detail: 'Unlocks the verification step, so donors can see the organisation is real before they give.',
  },
  {
    id: 'team',
    title: 'A team or group',
    blurb: 'A club, a school, a sports team, a group of colleagues fundraising together.',
    detail: 'Members can each raise toward one shared total.',
  },
];

export interface StepPathProps {
  value: string;
  onChange: (path: CampaignPath) => void;
}

export default function StepPath({ value, onChange }: StepPathProps) {
  return (
    <div className="cr2-type-panel">
      <h2 className="cr2-step-q">Who is this campaign for?</h2>
      <p className="cr2-step-help">
        This sets up the right steps for you. You can change it any time before you publish.
      </p>

      <div className="cr2-who-grid" role="radiogroup" aria-label="Who is this campaign for?">
        {CAMPAIGN_PATHS.map((path) => {
          const selected = value === path.id;
          return (
            <button
              key={path.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`cr2-who-card${selected ? ' selected' : ''}`}
              onClick={() => onChange(path.id)}
            >
              <strong style={{ fontSize: 15.5, display: 'block', marginBottom: 6 }}>{path.title}</strong>
              <span style={{ display: 'block', fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.5 }}>
                {path.blurb}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.5, marginTop: 8 }}>
                {path.detail}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
