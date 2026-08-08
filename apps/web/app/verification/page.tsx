import type { Metadata } from 'next';
import {
  ReferenceCardGrid,
  ReferenceChecklist,
  ReferenceCta,
  ReferenceHero,
  ReferencePage,
  ReferenceSection,
  ReferenceSteps,
} from '../../components/ReferenceMarketing';

export const metadata: Metadata = {
  title: 'Verification Process',
  description: 'See how CharitMe verifies nonprofit organizations, reviews supporting documents, and helps donors give with confidence.',
  alternates: { canonical: 'https://www.charitme.com/verification' },
};

const PROCESS = [
  { icon: 'edit', title: 'Submit Application', body: 'Provide basic information about your organization and mission.' },
  { icon: 'document', title: 'Provide Documents', body: 'Submit your EIN, governing documents, and current financial information.' },
  { icon: 'search', title: 'Our Review', body: 'Our team verifies your information and checks your organization status.' },
  { icon: 'shield', title: 'Verification Decision', body: 'Receive a decision and any next steps, normally within 5-7 business days.' },
  { icon: 'award', title: 'Verified & Live', body: 'Once verified, you can fundraise and display trust signals to supporters.' },
];

const BENEFITS = [
  { icon: 'people', title: 'Builds Donor Trust', body: 'Verified nonprofits inspire confidence and encourage more giving.' },
  { icon: 'shield', title: 'Ensures Transparency', body: 'Clear standards promote accountable, responsible fundraising.' },
  { icon: 'search', title: 'Protects Our Community', body: 'Review helps protect donors and fundraisers from fraud and misuse.' },
  { icon: 'award', title: 'Recognizes Legitimate Work', body: 'Verification highlights organizations making a real difference.' },
];

const REQUIREMENTS = [
  'Proof of nonprofit or charitable registration.',
  'Employer Identification Number or applicable tax identifier.',
  'Articles of incorporation, bylaws, or equivalent governing documents.',
  'Recent financial information or annual filing.',
  'Contact information for an authorized representative.',
];

const TIPS = [
  'Make sure every document is clear, current, and complete.',
  'Use the same legal organization name across every document.',
  'Reply promptly if the review team requests more information.',
];

export default function VerificationPage() {
  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Resources', href: '/resources' }, { label: 'Verification Process' }]}
        eyebrow="Verification Process"
        title={<>Trust is Earned.<br /><span className="rp-accent">We Verify.</span></>}
        lede="Our verification process ensures that nonprofit organizations on CharitMe are legitimate, transparent, and committed to making a real impact."
        actions={[
          { label: 'Start Verification', href: '/dashboard/nonprofit' },
          { label: 'Watch How It Works', href: '/how-it-works', variant: 'secondary' },
        ]}
        image="/images/reference/verification-hero.jpg"
        imageAlt="A reviewer completing an organization verification checklist"
      />

      <ReferenceSection title="How Our Verification Process Works" intro="A thorough, fair process checks every nonprofit against the same published standards.">
        <ReferenceSteps items={PROCESS} />
      </ReferenceSection>

      <ReferenceSection title="Why Verification Matters">
        <ReferenceCardGrid items={BENEFITS} />
      </ReferenceSection>

      <ReferenceSection title="Prepare Your Application" compact>
        <div className="rp-split">
          <ReferenceChecklist title="What You'll Need to Apply" items={REQUIREMENTS} action={{ label: 'View full requirements checklist', href: '/help' }} />
          <ReferenceChecklist title="Tips for a Smooth Process" items={TIPS} action={{ label: 'Contact support', href: '/contact' }} />
        </div>
      </ReferenceSection>

      <ReferenceCta
        icon="shield"
        title="Ready to Get Verified?"
        body="Join a trusted community of nonprofits and start making an even bigger impact."
        actions={[{ label: 'Start Verification', href: '/dashboard/nonprofit' }]}
      />
    </ReferencePage>
  );
}
