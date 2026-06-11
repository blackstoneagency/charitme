import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to the most common questions about CharitMe — fees, payouts, AI tools, trust scores, and donor safety.',
};

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
      { q: 'What is the platform fee?', a: 'CharitMe charges 0% mandatory platform fee. We earn only from optional donor support tips that donors choose to add at checkout. The default tip is 8% of the donation amount, but donors can change it to any amount including $0.' },
      { q: 'What does Stripe charge?', a: 'Stripe charges 2.9% + $0.30 per transaction for standard card payments. This is Stripe\'s fee, not CharitMe\'s. Donors can optionally check a box at checkout to cover this fee so 100% of their stated donation reaches you.' },
      { q: 'How does the optional donor tip work?', a: 'At checkout, donors see a transparent breakdown showing exactly how much goes to the campaign, how much covers processing, and the optional tip to CharitMe. The tip is pre-filled at 8% but the donor can change it to 0%, 5%, 10%, 12%, or any custom amount before paying.' },
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

export default function FaqPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-20">
        <div className="container">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              FAQ
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Clear answers before you start.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Everything you need to know about fees, payouts, trust scores, verification, AI tools, and donor safety.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start a campaign
              </Link>
              <Link href="/contact" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick answers */}
      <section className="border-b border-slate-100 bg-emerald-50 py-10">
        <div className="container">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Platform fee', value: '0%', sub: 'Always free to fundraise' },
              { label: 'Donor tip', value: 'Optional', sub: 'Default 8%, editable to $0' },
              { label: 'Fast payout', value: 'Verified users', sub: 'Standard is always free' },
              { label: 'Trust score', value: 'Every campaign', sub: 'Computed automatically' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-5 text-center shadow-sm">
                <div className="text-2xl font-black text-emerald-700">{item.value}</div>
                <div className="mt-1 text-sm font-black text-slate-950">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ sections */}
      <section className="py-16">
        <div className="container">
          <div className="mx-auto max-w-3xl space-y-14">
            {FAQ_SECTIONS.map((section) => (
              <div key={section.title} id={'id' in section ? section.id : undefined}>
                <h2 className="mb-6 text-2xl font-black text-slate-950">{section.title}</h2>
                <div className="space-y-4">
                  {section.items.map((item) => (
                    <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="font-black text-slate-950">{item.q}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-50 py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-black text-slate-950">Still have questions?</h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-600">Our team is here to help with fundraising questions, nonprofit onboarding, enterprise giving, or trust and safety reviews.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-soft">
              Contact support
            </Link>
            <Link href="/create" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-900">
              Start a campaign
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
