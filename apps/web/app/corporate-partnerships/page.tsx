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
import PartnerRoster from '../partner/PartnerRoster';

export const metadata: Metadata = {
  title: 'Corporate Partnerships — Workplace Giving & Matching',
  description:
    'Build a CharitMe corporate giving program with employee engagement, matching gifts, cause marketing, measurable impact reporting, and secure administration.',
  alternates: { canonical: 'https://www.charitme.com/corporate-partnerships' },
  openGraph: {
    title: 'Corporate Partnerships With CharitMe',
    description: 'Engage employees, match donations, and turn company values into measurable community impact.',
    url: 'https://www.charitme.com/corporate-partnerships',
    images: [{ url: '/images/reference/corporate-partnerships-hero.webp' }],
    type: 'website',
  },
};

const REASONS = [
  { icon: 'target', title: 'Achieve Your Goals', body: 'Advance CSR, ESG, and community goals with measurable impact.' },
  { icon: 'people', title: 'Engage Employees', body: 'Inspire your team through meaningful giving and volunteering.' },
  { icon: 'chart', title: 'Increase Impact', body: 'Multiply company and employee giving through shared campaigns.' },
  { icon: 'megaphone', title: 'Strengthen Brand', body: 'Show a credible commitment to the communities you serve.' },
  { icon: 'document', title: 'Simplify Giving', body: 'Manage donations, campaigns, matching, and reporting together.' },
  { icon: 'heart', title: 'Make It Meaningful', body: 'Support the causes your employees and customers care about.' },
];

// ⚠️ The four figures that used to sit here — "$48M+ Raised by corporate
// partners", "2,100+ Corporate partners worldwide", "6.2M+ Lives positively
// impacted", "1.8M+ Volunteer hours contributed" — were INVENTED. None of them
// appear anywhere in the data, and nothing in this schema records a life
// impacted or a partner-attributed total. They were shown to prospective
// corporate partners as fact.
//
// This is the same call already made for /about-us and /impact: a page may show
// figures it can MEASURE, or none at all — never ones it made up. There is no
// measurable equivalent for these four (matching_programs holds programs, not
// attributed totals), so the band is gone rather than replaced with a number
// that means something different from its label.
//
// If the owner wants these back, the mechanism already exists: make them
// owner-authored with a `source_note`, the way `platform_impact_stats` drives
// /impact, and render them only once published.

// ⚠️ Three testimonials were REMOVED from here: "Erin W., Director of Corporate
// Responsibility", "David L., VP, Global Impact" and "Maria G., Head of Social
// Impact". No such partners exist and no testimonials table does either — they
// were invented copy attributed to named individuals with job titles.
//
// Fabricated testimony about identifiable people is a different order of wrong
// from a made-up total, which is why /impact has a test asserting its invented
// vignettes never appear in the page source. Real, consented quotes can go in a
// table and render from it.

export default function CorporatePartnershipsPage() {
  const businessPhotos = getPhotosForCategory('Business', 4);
  const communityPhotos = getPhotosForCategory('Community', 3);
  const ways = [
    {
      icon: 'people',
      title: 'Corporate Giving',
      body: 'Make direct donations or establish ongoing programs that support the causes your company values.',
      action: 'Learn more',
      href: '/sponsor',
      image: communityPhotos[0],
    },
    {
      icon: 'users',
      title: 'Employee Engagement',
      body: 'Empower employees to fundraise, volunteer, and drive impact in their communities.',
      action: 'Learn more',
      href: '/volunteer',
      image: communityPhotos[1],
    },
    {
      icon: 'gift',
      title: 'Matching Gifts',
      body: 'Amplify employee donations with matching programs that go even further.',
      action: 'Learn more',
      href: '/matching',
      image: businessPhotos[1],
    },
    {
      icon: 'briefcase',
      title: 'Cause Marketing',
      body: 'Launch campaigns that connect your brand with purpose and inspire customers.',
      action: 'Learn more',
      href: '/contact',
      image: businessPhotos[2],
    },
  ];

  return (
    <ReferencePage className="rr-page rr-corporate-page">
      <ReferenceHero
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Corporate Partnerships' },
        ]}
        eyebrow="Corporate Partnerships"
        title={<>Stronger Together.<br /><span className="rp-accent">Better for Everyone.</span></>}
        lede="Partner with CharitMe to create meaningful impact, empower your employees, and build a better future for the communities we all share."
        actions={[
          { label: 'Partner With Us', href: '/contact' },
          { label: 'Partnership Guide', href: '/resources', variant: 'secondary' },
        ]}
        highlights={[
          { icon: 'shield', title: 'Trusted & Secure', body: 'Enterprise-grade security and transparency.' },
          { icon: 'people', title: 'Proven Impact', body: 'Real results for real communities.' },
          { icon: 'hand', title: 'Easy to Implement', body: 'Flexible programs that fit your goals.' },
        ]}
        image="/images/reference/corporate-partnerships-hero.webp"
        imageAlt="Coworkers packing community donations together"
        callout={{
          icon: 'gift',
          title: 'Good for Business. Great for the World.',
          body: 'Corporate partnerships that drive impact, engagement, and purpose.',
        }}
      />

      <div className="rr-band rr-band-light">
        <ReferenceSection
          title="Why Partner with CharitMe?"
          intro="Our platform makes it easy for companies to give back, engage employees, and amplify their impact."
        >
          <ReferenceIconGrid items={REASONS} columns={6} />
        </ReferenceSection>

        <ReferenceSection title="Ways to Partner" intro="Flexible partnership opportunities designed to fit your goals and values." compact>
          <ReferenceCardGrid items={ways} columns={4} />
        </ReferenceSection>

        <ReferenceSection title="Trusted by Purpose-Driven Companies" intro="Proud to partner with forward-thinking organizations across the globe.">
          <PartnerRoster />
        </ReferenceSection>

        <ReferenceCta
          icon="hand"
          title="Let's Create Impact Together"
          body="Join a growing community of companies using business as a force for good."
          actions={[
            { label: 'Become a Partner', href: '/contact' },
            { label: 'Contact Our Team', href: '/contact', variant: 'secondary' },
          ]}
        />
      </div>
    </ReferencePage>
  );
}
