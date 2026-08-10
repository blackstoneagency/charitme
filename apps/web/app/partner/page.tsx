import type { Metadata } from 'next';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceQuote,
  ReferenceSection,
} from '../../components/ReferenceMarketing';
import { getPhotosForPage } from '../../lib/photo-catalog';
import PartnerRoster from './PartnerRoster';

export const metadata: Metadata = {
  title: 'Partner With Us',
  description: 'Partner with CharitMe through corporate giving, nonprofit programs, community fundraising, matching gifts, and technology integrations.',
  alternates: { canonical: 'https://www.charitme.com/partner' },
};

const REASONS = [
  { icon: 'people', title: 'Expand Your Impact', body: 'Reach more people and communities through our trusted platform.' },
  { icon: 'megaphone', title: 'Increase Visibility', body: 'Showcase your brand commitment to causes that matter.' },
  { icon: 'hand', title: 'Build Lasting Relationships', body: 'Collaborate with purpose-driven partners and a global network.' },
  { icon: 'chart', title: 'Drive Real Results', body: 'Make measurable impact with transparent reporting and insights.' },
  { icon: 'shield', title: 'Align With Trust', body: 'Partner with a platform that prioritizes security and transparency.' },
];

const PARTNERSHIPS = [
  { icon: 'briefcase', title: 'Corporate Partnerships', body: 'Workplace giving, employee matching, sponsorship, and purpose-led campaigns.', action: 'Explore corporate giving', href: '/corporate-partnerships' },
  { icon: 'heart', title: 'Nonprofit Partnerships', body: 'Campaign tools, donor engagement, verification, and reporting for mission-driven teams.', action: 'For nonprofits', href: '/for-nonprofits' },
  { icon: 'home', title: 'Community Partnerships', body: 'Flexible fundraising for schools, clubs, congregations, and local organizations.', action: 'Start a conversation', href: '/contact' },
  { icon: 'leaf', title: 'Cause Champions', body: 'Become an advocate and help spread awareness for causes you care about.', action: 'Learn more', href: '/get-involved' },
];

export default async function PartnerPage() {
  const photos = getPhotosForPage('Community', 'partner', 5);
  const cards = PARTNERSHIPS.map((item, index) => ({ ...item, image: photos[index + 1] ?? photos[0] }));

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Resources', href: '/resources' }, { label: 'Partner With Us' }]}
        eyebrow="Partner With Us"
        title={<>Stronger Together.<br /><span className="rp-accent">Greater Impact.</span></>}
        lede="We partner with organizations, businesses, and changemakers who share our mission to create a better world for everyone."
        actions={[
          { label: 'Become a Partner', href: '/contact' },
          { label: 'Watch Video', href: '/how-it-works', variant: 'secondary' },
        ]}
        image="/images/reference/partner-hero.jpg"
        imageAlt="A diverse group joining hands in partnership"
      />

      <ReferenceSection title="Why Partner With CharitMe" intro="Together, we can create more opportunities for generosity and measurable impact.">
        <ReferenceIconGrid items={REASONS} columns={5} />
      </ReferenceSection>

      <ReferenceSection title="Ways to Partner" intro="Choose the model that fits your organization." compact>
        <div id="partnerships"><ReferenceCardGrid items={cards} /></div>
      </ReferenceSection>

      <ReferenceSection title="Organizations Growing Impact With Us">
        <PartnerRoster />
      </ReferenceSection>

      <ReferenceSection title="Built for Long-Term Impact">
        <div className="rp-split">
          <ReferenceQuote quote="CharitMe gave our people a simple way to participate and gave our team clear reporting on the impact we created together." name="Community Partner" context="Partnership program lead" />
          <ReferenceCardGrid columns={2} items={[
            { icon: 'check', title: 'A Plan That Fits', body: 'We shape onboarding, campaign structure, and reporting around your goals.', action: 'Talk to our team', href: '/contact' },
            { icon: 'chart', title: 'Results You Can Share', body: 'Communicate participation and impact with transparent, exportable reporting.', action: 'See transparency', href: '/transparency' },
          ]} />
        </div>
      </ReferenceSection>

      <ReferenceCta
        icon="people"
        title="Let's Create More Impact Together"
        body="Tell us what your organization wants to achieve and we will build the path with you."
        actions={[
          { label: 'Become a Partner', href: '/contact' },
          { label: 'For Nonprofits', href: '/for-nonprofits', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
