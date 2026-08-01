// ─────────────────────────────────────────────────────────────────────────────
// Release notes (design #166).
//
// Editorial content, kept in code — the same convention as lib/blog-posts.ts.
// There is no `releases` table and this deliberately does not invent one: a
// changelog is written by a person at release time, not accumulated by the app,
// so a table would add a migration (inert in production until the runbook runs)
// and buy nothing.
//
// ⚠️ TWO RULES, because a changelog is a public claim about what the product
// does:
//
//   1. Every entry below describes work that is ACTUALLY MERGED to master. No
//      "coming soon", no roadmap items. This file is trivially checkable against
//      the repo, and an entry for something unshipped is a lie a customer can
//      catch.
//   2. Entries are anchored to DATES, not invented semver. The design mock shows
//      "v2.4.1", but this repo has no release tags and no versioning process —
//      printing a version number would imply one exists and that a given build
//      corresponds to it. Dates are true and verifiable.
// ─────────────────────────────────────────────────────────────────────────────

export type ChangeKind = 'added' | 'improved' | 'fixed';

export interface ChangelogEntry {
  /** ISO date the work reached master. */
  date: string;
  title: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  added: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-01',
    title: 'Donation forms, webhooks and a unified calendar',
    changes: [
      {
        kind: 'added',
        text: 'Donation Form Builder — create an embeddable donation form for any campaign, with your own suggested amounts and an optional monthly option.',
      },
      {
        kind: 'added',
        text: 'Calendar — campaign deadlines, events and grant dates from across your account, in one place.',
      },
      {
        kind: 'added',
        text: 'Webhook endpoints — register and manage HTTPS endpoints, with a signing secret shown once and stored only as a hash.',
      },
      {
        kind: 'added',
        text: 'Email Templates — see and edit the copy your marketing automations send.',
      },
      {
        kind: 'fixed',
        text: 'Admin refunds now record every refund in the ledger, and warn instead of silently losing the record.',
      },
      {
        kind: 'fixed',
        text: 'Recurring donations are recorded reliably — a failed write now retries instead of being dropped.',
      },
    ],
  },
  {
    date: '2026-07-28',
    title: 'Receipts, saved causes and system status',
    changes: [
      { kind: 'added', text: 'Receipt preview — see a donation receipt before it is sent.' },
      { kind: 'added', text: 'Saved Causes — the campaigns you saved now have a page of their own.' },
      { kind: 'added', text: 'System Status — a public page reporting live service health.' },
      { kind: 'added', text: 'Fundraising Tools hub and the Donation Widget configurator.' },
      { kind: 'improved', text: 'Grouped header navigation: Explore, Causes and Resources.' },
    ],
  },
  {
    date: '2026-07-26',
    title: 'Languages and the Ambassador Programme',
    changes: [
      {
        kind: 'added',
        text: 'CharitMe now detects your language and translates the site across all 11 supported markets.',
      },
      { kind: 'added', text: 'Public Ambassador Programme page, with referral tiers.' },
      { kind: 'added', text: 'Community Guidelines.' },
    ],
  },
];
