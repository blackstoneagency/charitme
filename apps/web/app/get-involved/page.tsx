import type { Metadata } from 'next';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferencePage,
  ReferenceSection,
  ReferenceStats,
} from '../../components/ReferenceMarketing';
import { getHomeData } from '../../lib/home-data';
import { formatHomeCents, shortHomeCount, shouldShowPlatformMetrics } from '../../lib/home-utils';
import { getPhotosForCategory } from '../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'All Ways to Take Part',
  description: 'Donate, volunteer, fundraise, attend events, share campaigns, learn, partner, and find every way to make an impact with CharitMe.',
  alternates: { canonical: 'https://www.charitme.com/get-involved' },
};

export const revalidate = 900;

const WAYS = [
  { icon: 'heart', title: 'Donate', body: 'Give once or set up recurring support for causes you care about.', action: 'Learn more', href: '/campaigns' },
  { icon: 'hand', title: 'Volunteer', body: 'Give your time and skills to organizations making a real impact.', action: 'Learn more', href: '/volunteer' },
  { icon: 'megaphone', title: 'Start a Campaign', body: 'Create your own campaign and rally your community around a cause.', action: 'Learn more', href: '/create' },
  { icon: 'briefcase', title: 'Partner', body: 'Collaborate with us to amplify impact through your organization or business.', action: 'Learn more', href: '/partner' },
  { icon: 'gift', title: 'Fundraise', body: 'Host an event or activity to raise funds and awareness.', action: 'Learn more', href: '/events/manage' },
  { icon: 'share', title: 'Share', body: 'Spread the word and inspire others by sharing campaigns and stories.', action: 'Learn more', href: '/campaigns' },
  { icon: 'graduation', title: 'Educate', body: 'Learn, teach, and raise awareness about important social issues.', action: 'Learn more', href: '/impact-education' },
  { icon: 'gift', title: 'Shop with Purpose', body: 'Support causes when you shop with purpose-driven partners.', action: 'Learn more', href: '/sponsor' },
  { icon: 'calendar', title: 'Attend Events', body: 'Join local and virtual events that bring our community together.', action: 'Learn more', href: '/events' },
  { icon: 'hand', title: 'In-Kind Donations', body: 'Donate goods or services to help organizations thrive.', action: 'Learn more', href: '/contact' },
];

export default async function GetInvolvedPage() {
  let metrics: { raisedCents: number; campaigns: number; donations: number; trustAvg: number } | null = null;
  try {
    metrics = (await getHomeData({})).metrics;
  } catch {
    metrics = null;
  }
  const measuredMetrics = metrics !== null && shouldShowPlatformMetrics(metrics, true) ? metrics : null;
  const photos = getPhotosForCategory('Volunteer', 6);
  const stories = [
    { icon: 'heart', title: 'One Gift Became a Community Effort', body: 'A supporter shared a local campaign and helped it reach an entirely new network.', action: 'Explore campaigns', href: '/campaigns', image: photos[1] },
    { icon: 'hand', title: 'Skills Turned Into Service', body: 'Volunteers matched their experience to a nonprofit that needed hands-on help.', action: 'Volunteer', href: '/volunteer', image: photos[2] },
    { icon: 'users', title: 'A Team Reached Further', body: 'Friends pooled their networks and raised toward one clear goal together.', action: 'Team fundraising', href: '/teams', image: photos[3] },
    { icon: 'megaphone', title: 'A Story Found Its Audience', body: 'Regular updates helped one fundraiser turn supporters into advocates.', action: 'Read success stories', href: '/success-stories', image: photos[4] },
  ];

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Get Involved' }]}
        eyebrow=""
        title={<>All Ways to<br /><span className="rp-accent-pink">Take Part.</span></>}
        lede="No matter your time, talents, or resources, there is a meaningful way for you to make a difference."
        actions={[
          { label: 'Start a Campaign', href: '/create' },
          { label: 'Explore Causes', href: '/causes', variant: 'secondary' },
        ]}
        image="/images/reference/get-involved-hero.jpg"
        imageAlt="Volunteers working together in their community"
      />

      <div id="ways">
        <ReferenceSection title="Choose Your Impact" intro="Get involved in the way that is right for you.">
          <ReferenceCardGrid items={WAYS} columns={5} />
        </ReferenceSection>
      </div>

      <ReferenceStats items={[
        { icon: 'dollar', value: measuredMetrics ? formatHomeCents(measuredMetrics.raisedCents) : '—', label: 'Raised through CharitMe' },
        { icon: 'megaphone', value: measuredMetrics ? measuredMetrics.campaigns.toLocaleString() : '—', label: 'Live campaigns' },
        { icon: 'heart', value: measuredMetrics ? shortHomeCount(measuredMetrics.donations) : '—', label: 'Donations recorded' },
        { icon: 'people', value: String(WAYS.length), label: 'Ways to take part' },
      ]} />

      <ReferenceSection title="Real People. Real Impact." intro="A few of the ways participation can become lasting impact.">
        <ReferenceCardGrid items={stories} />
      </ReferenceSection>

      <ReferenceCta
        icon="heart"
        title="Ready to Make Your Impact?"
        body="Choose a cause, find an opportunity, or start something of your own today."
        actions={[
          { label: 'Explore Causes', href: '/causes' },
          { label: 'Start a Campaign', href: '/create', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
