import type { Metadata } from 'next';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferencePage,
  ReferenceSection,
  ReferenceStats,
} from '../../components/ReferenceMarketing';
import { getPhotosForCategory } from '../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'Impact Education',
  description: 'Learn how charitable giving works, how to evaluate a campaign, and how responsible organizations measure and report real impact.',
  alternates: { canonical: 'https://www.charitme.com/impact-education' },
};

const TOPICS = [
  { icon: 'heart', title: 'Poverty & Economic Equity', body: 'Understand poverty, inequality, and how community-led solutions create opportunity.', action: 'Explore articles', href: '/causes/people-in-need' },
  { icon: 'leaf', title: 'Environment & Sustainability', body: 'Explore climate action, conservation, and durable local solutions.', action: 'Explore articles', href: '/causes/environment' },
  { icon: 'heart', title: 'Health & Wellness', body: 'Learn about global health challenges and accountable care programs.', action: 'Explore articles', href: '/causes/health-wellness' },
  { icon: 'graduation', title: 'Education & Youth', body: 'Access education research, youth programs, and learning outcomes.', action: 'Explore articles', href: '/causes/education' },
  { icon: 'people', title: 'Communities & Human Rights', body: 'Study dignity, equity, local leadership, and rights-based impact.', action: 'Explore articles', href: '/causes/community-relief' },
  { icon: 'paw', title: 'Animals & Wildlife', body: 'Protect animals and habitats through evidence-led initiatives.', action: 'Explore articles', href: '/causes/animals-planet' },
  { icon: 'palette', title: 'Arts, Culture & Heritage', body: 'See how creative programs strengthen identity and belonging.', action: 'Explore articles', href: '/causes/arts-culture' },
  { icon: 'hand', title: 'Disaster Relief & Humanitarian Aid', body: 'Understand rapid response, recovery, and responsible emergency giving.', action: 'Explore articles', href: '/causes/disaster-relief' },
];

const WHY = [
  { icon: 'eye', title: 'Give With Confidence', body: 'Better questions make it easier to recognize clear, accountable campaigns.' },
  { icon: 'target', title: 'Focus on Outcomes', body: 'Move beyond activity counts and look for the change a project creates.' },
  { icon: 'shield', title: 'Protect Your Trust', body: 'Understand what verification proves and where healthy caution still matters.' },
  { icon: 'megaphone', title: 'Share Responsibly', body: 'Help strong campaigns travel further without repeating unverified claims.' },
];

export default function ImpactEducationPage() {
  const photos = getPhotosForCategory('Education', 6);
  const whyCards = WHY.map((item, index) => ({ ...item, image: photos[index + 1] ?? photos[0] }));

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Resources', href: '/resources' }, { label: 'Impact Education' }]}
        eyebrow=""
        title={<>Impact Education</>}
        lede="Knowledge creates change. Explore resources, insights, and real-world data to understand the issues that matter and how your support drives lasting impact."
        search={{ action: '/search', placeholder: 'Search impact topics, guides, and resources...', hidden: [{ name: 'type', value: 'resources' }] }}
        image="/images/reference/impact-education-hero.jpg"
        imageAlt="Students learning together in a bright classroom"
        callout={{ icon: 'graduation', title: 'Educate. Empower. Create Change.', body: 'Learning today builds a better tomorrow.' }}
        variant="catalog"
      />

      <ReferenceStats items={[
        { icon: 'book', value: String(TOPICS.length), label: 'Core learning topics' },
        { icon: 'chart', value: '3', label: 'Levels of impact measurement' },
        { icon: 'shield', value: '4', label: 'Trust questions to ask' },
        { icon: 'heart', value: '1', label: 'Goal: meaningful change' },
      ]} />

      <div id="topics">
        <ReferenceSection title="Learn by Topic" action={{ label: 'View all topics', href: '/causes' }}>
          <ReferenceCardGrid items={TOPICS} />
        </ReferenceSection>
      </div>

      <ReferenceSection title="Why Impact Education Matters">
        <ReferenceCardGrid items={whyCards} />
      </ReferenceSection>

      <ReferenceSection title="Choose a Learning Path" intro="Start with the role closest to the decision you are making.">
        <ReferenceCardGrid items={[
          { icon: 'heart', title: 'For Donors', body: 'Evaluate campaigns, understand fees, and follow impact after a gift.', action: 'Donor resources', href: '/for-donors' },
          { icon: 'megaphone', title: 'For Fundraisers', body: 'Make specific claims, publish evidence, and report honestly.', action: 'Fundraising guide', href: '/fundraising-guide' },
          { icon: 'people', title: 'For Nonprofits', body: 'Build accountable systems for campaigns, receipts, and reporting.', action: 'Nonprofit tools', href: '/for-nonprofits' },
          { icon: 'graduation', title: 'For Communities', body: 'Learn together and direct resources toward local priorities.', action: 'Community resources', href: '/community' },
        ]} />
      </ReferenceSection>

      <ReferenceCta
        icon="book"
        title="Turn Knowledge Into Action"
        body="Explore a live campaign and apply what you learned before you give or share."
        actions={[
          { label: 'Browse Campaigns', href: '/campaigns' },
          { label: 'View Reports', href: '/reports', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
