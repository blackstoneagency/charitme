// Organizer marketing core — supporter aggregation, target groups, and
// the fixed template catalog for organizer re-engagement sends.
// Pure functions only (no Supabase) so everything is unit-testable.

export interface DonationRow {
  donor_id: string | null;
  amount_cents: number;
  created_at: string;
  anonymous: boolean;
  email: string | null;      // resolved from profiles (or offline_donor_email)
  name: string | null;
}

export interface Supporter {
  key: string;               // donor_id or email
  name: string;
  email: string | null;
  anonymous: boolean;
  giftCount: number;
  totalCents: number;
  firstGiftAt: string;
  lastGiftAt: string;
  isRepeat: boolean;
  isLapsed: boolean;         // no gift in LAPSED_DAYS
  daysSinceLastGift: number;
}

export const LAPSED_DAYS = 30;

/**
 * Collapse donation rows into one supporter per person — the TARGETING view.
 *
 * This is what decides who receives an organizer send, so it deliberately keeps
 * one row per reachable person even when some of their gifts were anonymous:
 * splitting here would mail the same address twice.
 *
 * ⚠️ Do NOT serialize this to an organizer. `name` and `totalCents` sit on the
 * same row, so a donor who gave once anonymously and once openly appears as
 * "Real Name · 2 gifts · $525" — which tells the organizer exactly who gave the
 * anonymous gift. `supporterListRows` is the display view; use that instead.
 */
export function aggregateSupporters(donations: DonationRow[], now: Date = new Date()): Supporter[] {
  const map = new Map<string, Supporter>();
  for (const d of donations) {
    const key = d.donor_id ?? d.email ?? null;
    if (!key) continue; // fully anonymous guest with no email — unreachable, skip
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: d.anonymous ? 'Anonymous donor' : (d.name ?? 'Donor'),
        email: d.email,
        anonymous: d.anonymous,
        giftCount: 1,
        totalCents: d.amount_cents,
        firstGiftAt: d.created_at,
        lastGiftAt: d.created_at,
        isRepeat: false,
        isLapsed: false,
        daysSinceLastGift: 0,
      });
    } else {
      existing.giftCount += 1;
      existing.totalCents += d.amount_cents;
      if (d.created_at < existing.firstGiftAt) existing.firstGiftAt = d.created_at;
      if (d.created_at > existing.lastGiftAt) existing.lastGiftAt = d.created_at;
      if (!d.anonymous && d.name) { existing.name = d.name; existing.anonymous = false; }
      if (d.email && !existing.email) existing.email = d.email;
    }
  }
  const out = [...map.values()];
  for (const s of out) {
    s.isRepeat = s.giftCount >= 2;
    s.daysSinceLastGift = Math.floor((now.getTime() - new Date(s.lastGiftAt).getTime()) / 86_400_000);
    s.isLapsed = s.daysSinceLastGift >= LAPSED_DAYS;
  }
  return out.sort((a, b) => b.totalCents - a.totalCents);
}

// ─────────────────────────────────────────────
// Supporter list — the DISPLAY view
// ─────────────────────────────────────────────

/** A supporter-list row as the organizer sees it. Already redacted. */
export interface SupporterListRow {
  key: string;
  name: string;
  anonymous: boolean;
  emailMasked: string | null;  // always null on an anonymous row — see below
  reachable: boolean;          // true even when the address is withheld
  giftCount: number;
  totalCents: number;
  lastGiftAt: string;
  isRepeat: boolean;
  isLapsed: boolean;
}

/**
 * Build the organizer's supporter list.
 *
 * Anonymity is per GIFT, so one person can produce two rows: what they gave
 * openly, and what they gave anonymously. Merging those — which is what the
 * targeting view does — republishes the identity the donor opted out of: a row
 * reading "Real Name · 2 gifts · $525" beside a public donor wall showing a
 * single $25 gift from Real Name leaves exactly one candidate for the anonymous
 * $500.
 *
 * The two rows must therefore be impossible to rejoin, which is why an
 * anonymous row carries no name, no masked address, and an opaque key rather
 * than the donor id. The masked address is the sharpest of those: an organizer
 * who already knows a donor's email reads `ja***@gm***.com` on both rows and
 * has the link back. `reachable` survives so the send counts still make sense —
 * the organizer can email these donors through the engage flow, which addresses
 * them directly; they just never learn who they are.
 */
export function supporterListRows(donations: DonationRow[], now: Date = new Date()): SupporterListRow[] {
  interface Bucket {
    person: string;
    anonymous: boolean;
    name: string;
    email: string | null;
    giftCount: number;
    totalCents: number;
    lastGiftAt: string;
  }
  const map = new Map<string, Bucket>();
  for (const d of donations) {
    const person = d.donor_id ?? d.email ?? null;
    if (!person) continue; // fully anonymous guest with no email — unreachable, skip
    // Anonymity is part of the key: anonymous money never lands in a named row.
    const key = `${d.anonymous ? 'anon' : 'open'}:${person}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        person,
        anonymous: d.anonymous,
        name: d.anonymous ? 'Anonymous donor' : (d.name ?? 'Donor'),
        email: d.email,
        giftCount: 1,
        totalCents: d.amount_cents,
        lastGiftAt: d.created_at,
      });
    } else {
      existing.giftCount += 1;
      existing.totalCents += d.amount_cents;
      if (d.created_at > existing.lastGiftAt) existing.lastGiftAt = d.created_at;
      if (!d.anonymous && d.name) existing.name = d.name;
      if (d.email && !existing.email) existing.email = d.email;
    }
  }

  let anonSeq = 0;
  return [...map.values()]
    .sort((a, b) => b.totalCents - a.totalCents)
    .map((b) => {
      const daysSince = Math.floor((now.getTime() - new Date(b.lastGiftAt).getTime()) / 86_400_000);
      return {
        // React key only — but it ships to the browser, so an anonymous row gets
        // a positional id. `anon:<donor_id>` would join straight back to the
        // same donor's named row in the very same response.
        key: b.anonymous ? `anon-${++anonSeq}` : `open:${b.person}`,
        name: b.name,
        anonymous: b.anonymous,
        emailMasked: b.anonymous || !b.email ? null : maskEmail(b.email),
        reachable: Boolean(b.email),
        giftCount: b.giftCount,
        totalCents: b.totalCents,
        lastGiftAt: b.lastGiftAt,
        isRepeat: b.giftCount >= 2,
        isLapsed: daysSince >= LAPSED_DAYS,
      };
    });
}

// ─────────────────────────────────────────────
// Target groups
// ─────────────────────────────────────────────

export type TargetGroup = 'recent_donors' | 'all_donors' | 'lapsed_donors' | 'one_time_donors';

export const TARGET_GROUPS: { key: TargetGroup; label: string; description: string }[] = [
  { key: 'recent_donors',   label: 'Recent donors',   description: `Gave within the last ${LAPSED_DAYS} days` },
  { key: 'all_donors',      label: 'All donors',      description: 'Everyone who has supported this campaign' },
  { key: 'lapsed_donors',   label: 'Lapsed donors',   description: `No gift in ${LAPSED_DAYS}+ days` },
  { key: 'one_time_donors', label: 'One-time donors', description: 'Gave once — great candidates for monthly giving' },
];

export function filterTargets(supporters: Supporter[], group: TargetGroup): Supporter[] {
  const emailable = supporters.filter(s => Boolean(s.email));
  switch (group) {
    case 'recent_donors':   return emailable.filter(s => !s.isLapsed);
    case 'all_donors':      return emailable;
    case 'lapsed_donors':   return emailable.filter(s => s.isLapsed);
    case 'one_time_donors': return emailable.filter(s => s.giftCount === 1);
  }
}

// ─────────────────────────────────────────────
// Template catalog (organizer sends are template-constrained —
// no freeform campaigns, protecting deliverability and donors)
// ─────────────────────────────────────────────

export interface OrganizerTemplate {
  key: string;
  label: string;
  description: string;
  defaultTarget: TargetGroup;
  subject: string;            // {{first_name}} {{campaign_title}} supported
  body: string;               // also {{campaign_url}} {{organizer_name}}
}

export const ORGANIZER_TEMPLATES: OrganizerTemplate[] = [
  {
    key: 'thank_recent',
    label: '💜 Thank recent donors',
    description: 'A warm thank-you to everyone who gave recently.',
    defaultTarget: 'recent_donors',
    subject: 'Thank you for supporting {{campaign_title}}',
    body: `Hi {{first_name}},

I just wanted to say thank you — truly. Your donation to {{campaign_title}} means more than you know.

Every gift brings us closer to the goal, and yours made a real difference. I'll keep posting updates so you can see exactly what your generosity is making possible.

With gratitude,
{{organizer_name}}

Follow the campaign: {{campaign_url}}`,
  },
  {
    key: 'update_blast',
    label: '📣 Share an update',
    description: 'Tell everyone who gave what has happened since.',
    defaultTarget: 'all_donors',
    subject: 'An update on {{campaign_title}}',
    body: `Hi {{first_name}},

You supported {{campaign_title}}, so I wanted you to be the first to know how things are going.

[Write 2–3 sentences about your progress here — what the funds have done so far, and what is next.]

None of this happens without you. Thank you for being part of it.

{{organizer_name}}

See the campaign: {{campaign_url}}`,
  },
  {
    key: 'lapsed_nudge',
    label: '🌱 Re-engage lapsed donors',
    description: 'A gentle nudge to donors who have gone quiet.',
    defaultTarget: 'lapsed_donors',
    subject: '{{campaign_title}} — we are still going, thanks to you',
    body: `Hi {{first_name}},

It has been a little while since your donation to {{campaign_title}} — I wanted to reach out personally to say it is still making a difference.

We are continuing to push toward the goal, and if you are able to share the campaign with a friend (or give again), it would mean the world. No pressure either way — you have already helped more than you know.

Warmly,
{{organizer_name}}

{{campaign_url}}`,
  },
  {
    key: 'monthly_upgrade',
    label: '🔁 Invite monthly giving',
    description: 'Ask one-time donors to become monthly supporters.',
    defaultTarget: 'one_time_donors',
    subject: 'Could you make your impact monthly, {{first_name}}?',
    body: `Hi {{first_name}},

Your one-time gift to {{campaign_title}} made a real impact — thank you.

If you are able, a small monthly gift (even $5–10) gives steady support I can count on, and CharitMe charges 0% platform fees on monthly giving — every dollar reaches the campaign.

Either way, thank you for what you have already done.

{{organizer_name}}

Give monthly: {{campaign_url}}`,
  },
];

// ─────────────────────────────────────────────
// Rate limit: protect sender reputation + donors' inboxes
// ─────────────────────────────────────────────

export const MAX_SENDS_PER_CAMPAIGN_PER_DAY = 2;

export function sendsRemainingToday(sendTimestamps: string[], now: Date = new Date()): number {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const today = sendTimestamps.filter(t => new Date(t) >= dayStart).length;
  return Math.max(0, MAX_SENDS_PER_CAMPAIGN_PER_DAY - today);
}

/** Fill template variables for a specific recipient. */
export function personalize(text: string, vars: { firstName: string; campaignTitle: string; campaignUrl: string; organizerName: string }): string {
  return text
    .replaceAll('{{first_name}}', vars.firstName)
    .replaceAll('{{campaign_title}}', vars.campaignTitle)
    .replaceAll('{{campaign_url}}', vars.campaignUrl)
    .replaceAll('{{organizer_name}}', vars.organizerName);
}

/** Mask an email for display: jo***@gm***.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const dotIdx = domain.lastIndexOf('.');
  const dName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain;
  const tld = dotIdx > 0 ? domain.slice(dotIdx) : '';
  return `${local.slice(0, 2)}***@${dName.slice(0, 2)}***${tld}`;
}
