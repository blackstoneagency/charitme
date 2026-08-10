import type { Metadata } from 'next';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferencePage,
  ReferenceSection,
  ReferenceSteps,
} from '../../components/ReferenceMarketing';
import { getGrantCategories, getPublicGrants } from '../../lib/grants-server';
import { getPhotosForPage } from '../../lib/photo-catalog';
import GrantsClient from './GrantsClient';

export const metadata: Metadata = {
  title: 'Grants — Find Funding and Fuel Your Mission',
  description:
    'Search live foundation, government, corporate, community, and education grant opportunities on CharitMe and access practical application resources.',
  alternates: { canonical: 'https://www.charitme.com/grants' },
  openGraph: {
    images: [{ url: '/images/reference/grants-hero.webp' }],
    title: 'Find Funding. Fuel Your Mission.',
    description: 'Explore live grant opportunities and practical resources for your organization.',
    url: 'https://www.charitme.com/grants',
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

const GRANT_TYPES = [
  { icon: 'people', title: 'Foundation Grants', body: 'Support from private foundations focused on your cause.', action: 'Explore foundation grants', href: '#grant-opportunities' },
  { icon: 'home', title: 'Government Grants', body: 'Federal, state, and local funding for nonprofit organizations.', action: 'Explore government grants', href: '#grant-opportunities' },
  { icon: 'briefcase', title: 'Corporate Grants', body: 'Funding from companies invested in making a positive impact.', action: 'Explore corporate grants', href: '#grant-opportunities' },
  { icon: 'leaf', title: 'Community Grants', body: 'Local organizations supporting change in your community.', action: 'Explore community grants', href: '#grant-opportunities' },
  { icon: 'graduation', title: 'Education Grants', body: 'Grants supporting education and youth empowerment.', action: 'Explore education grants', href: '#grant-opportunities' },
];

const STEPS = [
  { icon: 'search', title: 'Search Opportunities', body: 'Use the live search tools to find grants that fit your mission and needs.' },
  { icon: 'document', title: 'Review & Save', body: 'Review guidelines, eligibility, and deadlines, then save promising grants.' },
  { icon: 'edit', title: 'Prepare Your Proposal', body: 'Use CharitMe resources and templates to create a compelling application.' },
  { icon: 'share', title: 'Submit with Confidence', body: 'Submit your application and track its progress in one place.' },
  { icon: 'heart', title: 'Make an Impact', body: 'Secure funding and bring your mission to life in meaningful ways.' },
];

export default async function GrantsPage() {
  const [grants, categories] = await Promise.all([
    getPublicGrants(48).catch(() => []),
    getGrantCategories().catch(() => []),
  ]);
  const photos = getPhotosForPage('Education', 'grants', 4);
  const resources = [
    { icon: 'book', title: 'Grant Writing Guide', body: 'Step-by-step guidance for clear, competitive proposals.', action: 'Read the guide', href: '/guides', image: photos[0] },
    { icon: 'document', title: 'Templates & Samples', body: 'Practical templates and sample proposals to help you get started.', action: 'View templates', href: '/resources', image: photos[1] },
    { icon: 'play', title: 'Webinars & Training', body: 'Learn from experts and build your grant-writing skills.', action: 'Watch webinars', href: '/webinars', image: photos[2] },
    { icon: 'ai', title: 'Grant Research Tips', body: 'Best practices for finding and evaluating grant opportunities.', action: 'Read tips', href: '/blog', image: photos[3] },
  ];

  return (
    <ReferencePage className="rr-page">
      <ReferenceHero
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Grants' },
        ]}
        eyebrow="Grants"
        title={<>Find Funding.<br /><span className="rp-accent">Fuel Your Mission.</span></>}
        lede="Grants can provide the essential support your organization needs to grow, innovate, and create lasting impact. Explore opportunities and find the right funding to bring your mission to life."
        actions={[
          { label: 'Search Grant Opportunities', href: '#grant-opportunities' },
          { label: 'Browse Grant Guides', href: '/guides', variant: 'secondary' },
        ]}
        highlights={[
          { icon: 'search', title: 'Curated Opportunities', body: 'Find relevant grants that match your mission.' },
          { icon: 'document', title: 'Helpful Resources', body: 'Access guides, templates, and expert tips.' },
          { icon: 'shield', title: 'Stronger Together', body: 'More funding means greater impact.' },
        ]}
        image="/images/reference/grants-hero.webp"
        imageAlt="A nonprofit mentor helping a student work on a grant project"
        callout={{
          icon: 'dollar',
          title: 'Funding Possibilities',
          body: 'From local foundations to corporate sponsors, new grants are available every day.',
        }}
      />

      <div className="rr-band rr-band-light">
        <ReferenceSection title="Explore Grants That Fit Your Goals" intro="Discover a variety of grants to support your organization’s work and mission.">
          <ReferenceCardGrid items={GRANT_TYPES} columns={5} />
        </ReferenceSection>

        <section className="rr-steps-band">
          <ReferenceSection title="How It Works" intro="Simple steps to help you find and secure the funding you need." compact>
            <ReferenceSteps items={STEPS} />
          </ReferenceSection>
        </section>

        <ReferenceSection title="Tools and Resources to Help You Succeed" compact>
          <ReferenceCardGrid items={resources} columns={4} />
        </ReferenceSection>

        <ReferenceSection
          title="Open Grant Opportunities"
          intro="Search and filter opportunities currently published in CharitMe. Results update from Supabase without replacing this page’s reference design."
          action={{ label: 'My applications', href: '/dashboard/grants' }}
        >
          <div id="grant-opportunities" className="rr-grants-live">
            <GrantsClient initialGrants={grants} categories={categories} />
          </div>
        </ReferenceSection>

        <ReferenceCta
          icon="hand"
          title="Ready to Find Your Next Grant?"
          body="Explore opportunities and access the resources you need to bring your mission to life."
          actions={[
            { label: 'Search Grants Now', href: '#grant-opportunities' },
            { label: 'Get Help from Our Team', href: '/contact', variant: 'secondary' },
          ]}
        />
      </div>
    </ReferencePage>
  );
}
