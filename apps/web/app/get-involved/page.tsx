import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Get Involved',
  description:
    'Every way to take part in CharitMe — donate, volunteer, fundraise, attend an event, sponsor a campaign, or bring your organisation on board.',
  alternates: { canonical: 'https://www.charitme.com/get-involved' },
};

const GIVE = [
  { title: 'Donate', body: 'Give once or monthly to a campaign you choose. No mandatory platform fee.', href: '/donate' },
  { title: 'Explore causes', body: 'Twenty causes, from medical and education to animals, the environment, and disaster relief.', href: '/causes' },
  { title: 'Crisis relief', body: 'Urgent appeals responding to disasters and emergencies happening now.', href: '/crisis' },
  { title: 'Give to many causes', body: 'Split a single gift across several campaigns at once.', href: '/give' },
  { title: 'Double your gift', body: 'Many employers match donations. Find a matching programme that applies to you.', href: '/matching' },
  { title: 'Sponsor a campaign', body: 'Back a campaign publicly and encourage others in your network to follow.', href: '/sponsor' },
  { title: 'Grants', body: 'Funding opportunities for nonprofits and community organisations.', href: '/grants' },
  { title: 'Top fundraisers', body: 'See which campaigns and supporters are raising the most right now.', href: '/leaderboard' },
];

const DO = [
  { title: 'Volunteer', body: 'Find opportunities with organisations that need hands rather than funds.', href: '/volunteer' },
  { title: 'Attend an event', body: 'Fundraising events near you and online.', href: '/events' },
  { title: 'Fundraise yourself', body: 'Start a campaign for a cause, a person, or a project. Roughly five minutes to publish.', href: '/create' },
  { title: 'Find something nearby', body: 'Campaigns, events, and volunteering close to where you are.', href: '/nearby' },
];

const ORGANISATIONS = [
  { title: 'For nonprofits', body: 'Verification, team access, tax receipting, and an organisation dashboard.', href: '/for-nonprofits' },
  { title: 'Corporate partnerships', body: 'Matching, workplace giving, and sponsorship for companies.', href: '/corporate-partnerships' },
  { title: 'Partner with us', body: 'Community groups, schools, clubs, congregations, and platforms.', href: '/partner' },
  { title: 'Build on the API', body: 'Embed campaigns and integrate giving into your own product.', href: '/developers' },
];

const LEARN = [
  { title: 'Fundraising guide', body: 'The six steps to a funded campaign, in the order you take them.', href: '/fundraising-guide' },
  { title: 'Impact education', body: 'How to read a campaign critically and what impact claims are worth.', href: '/impact-education' },
  { title: 'Reports & research', body: 'Platform figures and transparency documents.', href: '/reports' },
  { title: 'Success stories', body: 'What has actually been funded here, and what happened next.', href: '/success-stories' },
];

export default function GetInvolvedPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="GET INVOLVED"
        title="There is more than one way to help"
        lede="Money is the obvious contribution and often not the most useful one. Here is everything you can do on CharitMe, whether you have five dollars, five hours, or an organisation behind you."
        actions={
          <>
            <Link href="/donate" className="cta-primary" style={{ display: 'inline-flex' }}>
              Donate now
            </Link>
            <Link
              href="/volunteer"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Volunteer instead
            </Link>
          </>
        }
      />

      <Section id="give" heading="Give money" intro="The direct route, with the fee model shown before you confirm.">
        <CardGrid min={250}>
          {GIVE.map((i) => <InfoCard key={i.href} title={i.title} body={i.body} href={i.href} />)}
        </CardGrid>
      </Section>

      <Section id="do" heading="Give time" intro="Often worth more than the equivalent in cash, and always in shorter supply.">
        <CardGrid min={250}>
          {DO.map((i) => <InfoCard key={i.href} title={i.title} body={i.body} href={i.href} />)}
        </CardGrid>
      </Section>

      <Section id="organisations" heading="Bring your organisation" intro="For charities, companies, community groups, and developers.">
        <CardGrid min={250}>
          {ORGANISATIONS.map((i) => <InfoCard key={i.href} title={i.title} body={i.body} href={i.href} />)}
        </CardGrid>
      </Section>

      <Section id="learn" heading="Learn first" intro="Worth twenty minutes before you give or start a campaign.">
        <CardGrid min={250}>
          {LEARN.map((i) => <InfoCard key={i.href} title={i.title} body={i.body} href={i.href} />)}
        </CardGrid>
      </Section>

      <CtaBand
        heading="Not sure where to start?"
        body="Browse live campaigns and see what people near you are raising for."
        primary={{ label: 'Browse campaigns', href: '/campaigns' }}
        secondary={{ label: 'Explore causes', href: '/causes' }}
      />
    </PageBody>
  );
}
