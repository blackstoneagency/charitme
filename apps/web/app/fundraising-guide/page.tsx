import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ReferenceCardGrid,
  ReferenceChecklist,
  ReferenceCta,
  ReferenceHero,
  ReferencePage,
  ReferenceSection,
  ReferenceStats,
  ReferenceSteps,
} from '../../components/ReferenceMarketing';
import { PLATFORM_FEE_COPY, PROCESSING_FEE_COPY } from '../../lib/fee-copy';

export const metadata: Metadata = {
  title: 'Fundraising Guide',
  description: 'Build a trusted fundraising campaign with practical guidance for your story, goal, evidence, launch, updates, and donor follow-through.',
  alternates: { canonical: 'https://www.charitme.com/fundraising-guide' },
};

const TOPICS = [
  { icon: 'edit', title: 'Tell Your Story', body: 'Write a clear, human story that explains the need and why it matters.', action: 'Learn storytelling', href: '/blog/write-a-campaign-story-donors-trust' },
  { icon: 'target', title: 'Set the Right Goal', body: 'Build a goal from real costs so supporters can understand the amount.', action: 'Plan your goal', href: '/create' },
  { icon: 'image', title: 'Choose Strong Media', body: 'Use clear photos and evidence that make the campaign feel real.', action: 'Media guidance', href: '/help' },
  { icon: 'shield', title: 'Build Trust', body: 'Complete verification and explain exactly how the money will be used.', action: 'Verification guide', href: '/verification' },
  { icon: 'share', title: 'Plan Your Launch', body: 'Start with the people closest to you and create early momentum.', action: 'Launch plan', href: '/blog/five-updates-that-keep-donations-moving' },
  { icon: 'megaphone', title: 'Share Consistently', body: 'Use personal messages, social posts, and timely reminders.', action: 'Growth ideas', href: '/blog' },
  { icon: 'refresh', title: 'Post Updates', body: 'Keep donors informed about milestones, progress, and changing needs.', action: 'Update playbook', href: '/blog/five-updates-that-keep-donations-moving' },
  { icon: 'heart', title: 'Thank Supporters', body: 'Close the loop and show donors what their contribution changed.', action: 'Donor care', href: '/resources' },
];

const JOURNEY = [
  { icon: 'target', title: 'Plan', body: 'Define the need, audience, costs, and timeline.' },
  { icon: 'edit', title: 'Create', body: 'Build the page, story, media, and proof.' },
  { icon: 'shield', title: 'Verify', body: 'Connect payouts and complete trust checks.' },
  { icon: 'megaphone', title: 'Launch', body: 'Share personally, then expand your reach.' },
  { icon: 'chart', title: 'Grow', body: 'Update, thank, measure, and keep momentum.' },
];

export default function FundraisingGuidePage() {
  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Resources', href: '/resources' }, { label: 'Fundraising Guide' }]}
        eyebrow="Fundraising Guide"
        title={<>Your Guide to<br />Fundraising Success</>}
        lede="Practical tips, proven strategies, and expert advice to help you raise more and make a bigger impact."
        search={{ action: '/search', placeholder: 'Search fundraising topics...', hidden: [{ name: 'type', value: 'resources' }] }}
        image="/images/reference/fundraising-guide-hero.jpg"
        imageAlt="A team planning a community fundraising campaign"
        callout={{ icon: 'quote', title: 'Plan With Purpose', body: 'Great campaigns start with a plan, a purpose, and the right guidance.' }}
        variant="catalog"
      />

      <ReferenceStats items={[
        { icon: 'document', value: '8', label: 'Core campaign topics' },
        { icon: 'target', value: '5', label: 'Launch stages' },
        { icon: 'dollar', value: '0%', label: 'Mandatory platform fee' },
        { icon: 'shield', value: '1', label: 'Visible trust score' },
      ]} />

      <ReferenceSection title="Browse by Topic">
        <div className="rp-content-rail">
          <ReferenceCardGrid items={TOPICS} />
          <aside className="rp-side-panel" aria-label="Popular fundraising guides">
            <h3>Popular Guides</h3>
            <ol>
              {TOPICS.slice(0, 5).map((topic, index) => (
                <li key={topic.title}><Link href={topic.href}><span>{index + 1}. {topic.title}</span><small>{topic.action}</small></Link></li>
              ))}
            </ol>
            <Link className="rp-text-link" href="/resources">Explore all resources</Link>
          </aside>
        </div>
      </ReferenceSection>

      <ReferenceSection title="Your Fundraising Journey" intro="Five stages keep the work focused and make progress visible.">
        <ReferenceSteps items={JOURNEY} />
      </ReferenceSection>

      <ReferenceSection title="Know the Costs Before You Launch">
        <div className="rp-split">
          <ReferenceChecklist title="Transparent by Design" items={[
            `${PLATFORM_FEE_COPY}.`,
            `Card processing is ${PROCESSING_FEE_COPY}.`,
            'Every charge is shown before a donor confirms payment.',
            'Standard payout status is visible from the organizer dashboard.',
          ]} action={{ label: 'Read the full fee breakdown', href: '/fees' }} />
          <ReferenceChecklist title="Campaign Readiness Check" items={[
            'The first paragraph explains who needs help and why.',
            'The goal is tied to specific, understandable costs.',
            'The campaign includes a clear photo and supporting evidence.',
            'Twenty close contacts are ready to receive the first message.',
          ]} action={{ label: 'Create your campaign', href: '/create' }} />
        </div>
      </ReferenceSection>

      <ReferenceCta
        icon="megaphone"
        title="Ready to Tell Your Story?"
        body="Build your campaign now and use the guide as your launch checklist."
        actions={[
          { label: 'Start a Fundraiser', href: '/create' },
          { label: 'How It Works', href: '/how-it-works', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
