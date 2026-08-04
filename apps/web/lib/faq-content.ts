import { PROCESSING_FEE_COPY, PLATFORM_FEE_COPY, SUGGESTED_SUPPORT_COPY } from './fee-copy';
import type { PublicAeoEntry } from './aeo';

/**
 * The curated FAQ — the site's real answers, written and maintained in code.
 *
 * ── Why these are not in Supabase ─────────────────────────────────────────
 * They were meant to be. `aeo_entries` is the admin-managed answer store, and
 * /faq rendered BOTH: these sections, and everything published to the `/faq`
 * route below them. But measured against production, all 180 published `/faq`
 * rows are seeder placeholders — 15 distinct questions repeated twelve times
 * with round-robin topics and a `(topic N)` suffix on every one. They are
 * filtered out in lib/aeo.ts.
 *
 * So THIS is the real content, and it is the single source for every FAQ
 * surface on the site. Genuinely admin-published entries still render
 * alongside it the moment any exist — nothing here blocks that.
 *
 * The fee answers interpolate the shared fee copy rather than restating
 * numbers, so a fee change cannot leave this file disagreeing with checkout.
 */

const FAQ_SECTIONS = [
  {
    title: 'Getting started',
    items: [
      { q: 'How do I create a campaign?', a: 'Click "Start free fundraiser," fill in your campaign title, story, goal, and category. Our AI Copilot can help you write a compelling story and title. Campaigns are live in minutes — no approval required for standard campaigns.' },
      { q: 'Do I need an account to donate?', a: 'No, you can donate as a guest. Creating an account lets you track your donations, get receipts, follow campaigns, and see impact updates.' },
      { q: 'What categories can I fundraise for?', a: 'Medical, Memorial/Funeral, Emergency, Disaster Relief, Education, Animal/Pet, Community, Nonprofit, Sports/Teams, and Other. We support both personal and organizational campaigns.' },
      { q: 'Is there an approval process?', a: 'Standard campaigns launch immediately. High-risk categories or campaigns above certain thresholds may be queued for a brief trust review before appearing publicly. Our AI screens every campaign at creation.' },
    ],
  },
  {
    title: 'Fees and pricing',
    items: [
      { q: 'What is the platform fee?', a: `CharitMe charges a ${PLATFORM_FEE_COPY} mandatory platform fee. We earn only from optional donor support tips that donors choose to add at checkout. The tip is suggested at ${SUGGESTED_SUPPORT_COPY} of the donation amount, but donors can change it to any amount including $0.` },
      { q: 'What does Stripe charge?', a: `Stripe charges ${PROCESSING_FEE_COPY} per transaction for standard card payments. This is Stripe\'s fee, not CharitMe\'s. Donors can optionally check a box at checkout to cover this fee so 100% of their stated donation reaches you.` },
      { q: 'How does the optional donor tip work?', a: `At checkout, donors see a transparent breakdown showing exactly how much goes to the campaign, how much covers processing, and the optional tip to CharitMe. The tip is pre-filled at ${SUGGESTED_SUPPORT_COPY} but the donor can change it to any rung on the ladder, including 0%, or a custom amount before paying.` },
      { q: 'Are there fees to withdraw or receive payouts?', a: 'Standard payouts are always free. Same-day payouts have a 1% fee and instant payouts have a 1.5% fee. These are optional speed upgrades, not mandatory fees.' },
    ],
  },
  {
    title: 'Payouts',
    id: 'payouts',
    items: [
      { q: 'How do I receive money from my campaign?', a: 'Connect a Stripe Express account from your dashboard. After verification, donations are transferred directly to your Stripe account on the standard schedule (typically 2 business days after donation).' },
      { q: 'How long does payout verification take?', a: 'Stripe identity verification typically takes 1–3 minutes for most users. Some accounts require additional document review, which can take 1–2 business days. Payouts are available as soon as verification is complete.' },
      { q: 'Can someone outside the US receive payouts?', a: 'CharitMe supports payouts in all countries where Stripe Express is available — over 40 countries. Payout availability, timing, and currency depend on your country and Stripe Connect rules.' },
      { q: 'Why are payouts held for new accounts?', a: 'New fundraiser accounts have a 7-day payout hold on their first campaign to allow for fraud review and donor dispute resolution. This is standard industry practice. Established accounts with prior clean history do not have this hold.' },
    ],
  },
  {
    title: 'Trust and safety',
    items: [
      { q: 'How does the AI trust score work?', a: 'Every campaign gets a 0–99 trust score computed from identity verification, story completeness, evidence (images, documents), payout verification, fundraiser account history, donor momentum, and admin review status. The score is shown publicly to help donors make informed decisions.' },
      { q: 'What if I think a campaign is fraudulent?', a: 'Click "Report" on any campaign page. Our trust and safety team reviews all reports within 24 hours. Campaigns under active review display a notice. Payouts are frozen for campaigns under review.' },
      { q: 'Can organizers see who reported them?', a: 'No. Reports are anonymous. Organizers are notified only that a review has been initiated, not who submitted the report.' },
      { q: 'How do you prevent duplicate or recycled campaigns?', a: 'Our AI screens story text, images, and metadata for duplicate content across all campaigns. Campaigns that appear to copy prior fundraisers are flagged for manual review before going live.' },
    ],
  },
  {
    title: 'AI tools',
    items: [
      { q: 'What can the AI Copilot do?', a: 'The AI Copilot can write your campaign title and story, suggest a realistic goal amount, generate donation tiers, create social media captions, draft email appeals, write donor FAQs, score your campaign quality, and identify missing trust signals.' },
      { q: 'Will donors know AI helped write my campaign?', a: 'AI-generated or AI-assisted content is your content to own and edit. The Copilot suggests — you approve. Think of it like a professional fundraising writer helping you capture your real story.' },
      { q: 'Is the AI Growth Engine included in all plans?', a: 'Basic AI generation is included in the Free plan. Advanced AI optimization, A/B testing, social media studio, and donor outreach automation are included in Growth AI ($19/mo) and Pro AI ($49/mo) plans.' },
    ],
  },
  {
    title: 'For donors',
    id: 'donors',
    items: [
      { q: 'Can I donate anonymously?', a: 'Yes. Check "Make my donation anonymous" at checkout. Your name will not appear on the public campaign page. The campaign organizer also will not see your name — only the donation amount and timestamp.' },
      { q: 'Will I get a receipt?', a: 'Yes. Stripe sends an automated payment receipt to your email after every donation. For donations to verified nonprofit campaigns, a formal tax receipt is also emailed where applicable.' },
      { q: 'Can I get a refund?', a: 'Refund policies depend on the campaign organizer. Contact the organizer first. If a campaign is found to be fraudulent, CharitMe will work with Stripe to issue refunds. Report a campaign if you believe it is fraudulent.' },
      { q: 'Is my payment information secure?', a: 'Yes. All payments are processed by Stripe, a PCI DSS Level 1 certified payment processor. CharitMe never sees, stores, or handles your card number, CVV, or bank account details.' },
    ],
  },
];

export interface CuratedFaqSection {
  title: string;
  /** Anchor target. Linked from other pages, so it must not be renamed casually. */
  id?: string;
  items: { q: string; a: string }[];
}

export const CURATED_FAQ_SECTIONS: CuratedFaqSection[] = FAQ_SECTIONS;

/**
 * The curated answers in the shape the shared FAQ components expect, so a page
 * with no admin-published entries of its own shows real content rather than an
 * empty block.
 */
export function getCuratedFaqs(limit = 5, topics?: string[]): PublicAeoEntry[] {
  // Guarded before the loop, not inside it: the cap is checked AFTER a push, so
  // a limit of 0 would push one entry and then never match, returning the whole
  // set — the opposite of what was asked for.
  if (limit <= 0) return [];

  const sections = topics
    ? CURATED_FAQ_SECTIONS.filter((s) => topics.includes(s.title))
    : CURATED_FAQ_SECTIONS;
  const out: PublicAeoEntry[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      out.push({
        question: item.q,
        answer: item.a,
        topic: section.title,
        schema_type: 'FAQPage',
        route: '/faq',
      });
      if (out.length === limit) return out;
    }
  }
  return out;
}
