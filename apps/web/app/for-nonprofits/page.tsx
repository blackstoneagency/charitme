import type { Metadata } from 'next';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceSection,
} from '../../components/ReferenceMarketing';
import { getPhotosForCategory } from '../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'For Nonprofits - Fundraising Tools and Support',
  description: 'CharitMe gives nonprofits fundraising, donor engagement, verification, reporting, team access, and practical resources in one place.',
  alternates: { canonical: 'https://www.charitme.com/for-nonprofits' },
};

const CAPABILITIES = [
  { icon: 'heart', title: 'Raise More Funds', body: 'Create campaigns that inspire action and increase donations.' },
  { icon: 'chart', title: 'Engage Supporters', body: 'Build lasting relationships with donors, volunteers, and your community.' },
  { icon: 'megaphone', title: 'Tell Your Story', body: 'Share your impact with beautiful campaigns and updates.' },
  { icon: 'gear', title: 'Streamline Operations', body: 'Manage your organization, campaigns, and donors in one place.' },
  { icon: 'shield', title: 'Trust & Transparency', body: 'Built-in verification and reporting help supporters give confidently.' },
  { icon: 'graduation', title: 'Access Resources', body: 'Guides, training, and practical tools help your mission grow.' },
];

const BENEFITS = [
  { icon: 'dollar', title: 'Reduce Costs', body: 'Verified 501(c)(3) organizations keep more of every gift with no mandatory platform fee.', action: 'Learn more', href: '/fees' },
  { icon: 'chart', title: 'Powerful Tools', body: 'Fundraising, donor management, reporting, and communication tools built for nonprofits.', action: 'Explore tools', href: '/features' },
  { icon: 'people', title: 'Community Support', body: 'Join nonprofits collaborating, sharing knowledge, and growing together.', action: 'Meet the community', href: '/community' },
  { icon: 'book', title: 'Education & Training', body: 'Access expert resources, webinars, and guides to strengthen your skills and impact.', action: 'Start learning', href: '/fundraising-guide' },
];

const RESOURCES = [
  { icon: 'book', title: 'Fundraising Guide', body: 'A step-by-step guide to building successful campaigns.', action: 'Read guide', href: '/fundraising-guide' },
  { icon: 'play', title: 'Webinars', body: 'Live and on-demand training to grow your organization.', action: 'Watch now', href: '/webinars' },
  { icon: 'document', title: 'Templates', body: 'Campaign, email, and social templates ready to use.', action: 'Browse resources', href: '/resources' },
  { icon: 'help', title: 'Help Center', body: 'Answers to common questions and practical how-to articles.', action: 'Visit help center', href: '/help' },
  { icon: 'users', title: 'Nonprofit Community', body: 'Connect with other nonprofits and share what works.', action: 'Join community', href: '/community' },
];

export default function ForNonprofitsPage() {
  const nonprofitPhotos = getPhotosForCategory('Nonprofit', 5);
  const benefits = BENEFITS.map((benefit, index) => ({ ...benefit, image: nonprofitPhotos[index + 1] ?? nonprofitPhotos[0] }));

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Resources', href: '/resources' }, { label: 'For Nonprofits' }]}
        eyebrow="For Nonprofits"
        title={<>More Support.<br />Greater Impact.<span className="rp-script">Together.</span></>}
        lede="CharitMe empowers nonprofits with the tools, resources, and community they need to raise more, reach more, and change more lives."
        actions={[
          { label: 'Get Started', href: '/create' },
          { label: 'Watch Overview', href: '/how-it-works', variant: 'secondary' },
        ]}
        image="/images/reference/nonprofit-hero.jpg"
        imageAlt="A nonprofit team working together"
      />

      <ReferenceSection title="Everything You Need to Succeed" intro="Powerful tools and support designed specifically for nonprofit organizations.">
        <ReferenceIconGrid items={CAPABILITIES} />
      </ReferenceSection>

      <ReferenceSection title="Benefits for Your Organization">
        <ReferenceCardGrid items={benefits} />
      </ReferenceSection>

      <ReferenceSection title="Resources for Nonprofits" action={{ label: 'View all resources', href: '/resources' }}>
        <ReferenceCardGrid items={RESOURCES} columns={5} />
      </ReferenceSection>

      <ReferenceCta
        icon="hand"
        title="Ready to Grow Your Impact?"
        body="Join nonprofits already making a difference with CharitMe."
        actions={[
          { label: 'Register Your Nonprofit', href: '/login?mode=signup' },
          { label: 'Contact Our Team', href: '/contact', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
