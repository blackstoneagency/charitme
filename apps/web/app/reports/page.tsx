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
import PublishedReports from './PublishedReports';

export const metadata: Metadata = {
  title: 'Reports & Research',
  description: 'Explore CharitMe platform figures, impact reporting, research, methodology, transparency documents, and downloadable reports.',
  alternates: { canonical: 'https://www.charitme.com/reports' },
};

export const revalidate = 900;

const TOPICS = [
  { icon: 'heart', title: 'Poverty & Economic Equity', body: 'Research and data on poverty reduction, income security, and opportunity.', action: 'View reports', href: '/reports?topic=poverty' },
  { icon: 'leaf', title: 'Environment & Sustainability', body: 'Reports on climate action, conservation, clean water, and resilience.', action: 'View reports', href: '/reports?topic=environment' },
  { icon: 'heart', title: 'Health & Wellness', body: 'Insights on global health, medical access, and community wellbeing.', action: 'View reports', href: '/reports?topic=health' },
  { icon: 'graduation', title: 'Education & Youth', body: 'Data and research on education access, quality, and youth empowerment.', action: 'View reports', href: '/reports?topic=education' },
  { icon: 'people', title: 'Community & Human Rights', body: 'Reports on social inclusion, rights, safety, and local participation.', action: 'View reports', href: '/reports?topic=community' },
  { icon: 'paw', title: 'Animals & Wildlife', body: 'Research on animal protection, habitat, and conservation outcomes.', action: 'View reports', href: '/reports?topic=animals' },
  { icon: 'palette', title: 'Arts, Culture & Heritage', body: 'Studies on creativity, preservation, and community participation.', action: 'View reports', href: '/reports?topic=arts' },
  { icon: 'hand', title: 'Disaster Relief & Recovery', body: 'Data on emergency response, recovery, and humanitarian impact.', action: 'View reports', href: '/reports?topic=disaster' },
];

export default async function ReportsPage() {
  let metrics: { raisedCents: number; campaigns: number; donations: number; trustAvg: number } | null = null;
  try {
    metrics = (await getHomeData({})).metrics;
  } catch {
    metrics = null;
  }
  const measuredMetrics = metrics !== null && shouldShowPlatformMetrics(metrics, true) ? metrics : null;
  const photos = getPhotosForCategory('Environment', 5);

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Resources', href: '/resources' }, { label: 'Reports & Research' }]}
        eyebrow="Reports & Research"
        title={<>Data. Insights.<br />Lasting Change.</>}
        lede="Explore in-depth reports, research, and data that shine a light on today's most important issues and power a better tomorrow."
        search={{ action: '/search', placeholder: 'Search reports, topics, or keywords...', hidden: [{ name: 'type', value: 'resources' }] }}
        image="/images/reference/reports-hero.jpg"
        imageAlt="A community landscape representing long-term impact"
        callout={{ icon: 'chart', title: 'Evidence Drives Impact.', body: 'Access reliable research to make informed decisions and maximize your impact.' }}
        variant="catalog"
      />

      <ReferenceStats items={[
        { icon: 'dollar', value: measuredMetrics ? formatHomeCents(measuredMetrics.raisedCents) : '—', label: 'Raised on CharitMe' },
        { icon: 'megaphone', value: measuredMetrics ? measuredMetrics.campaigns.toLocaleString() : '—', label: 'Live campaigns' },
        { icon: 'heart', value: measuredMetrics ? shortHomeCount(measuredMetrics.donations) : '—', label: 'Donations recorded' },
        { icon: 'shield', value: measuredMetrics && measuredMetrics.trustAvg > 0 ? `${measuredMetrics.trustAvg}%` : '—', label: 'Average trust score' },
      ]} />

      <ReferenceSection title="Explore by Topic" action={{ label: 'View all topics', href: '/causes' }}>
        <ReferenceCardGrid items={TOPICS} />
      </ReferenceSection>

      <div className="rp-section rp-published"><PublishedReports /></div>

      <div id="methodology">
        <ReferenceSection title="How the Figures Are Produced" intro="A number is useful only when its definition and limits are clear.">
          <ReferenceCardGrid columns={3} items={[
            { icon: 'check', title: 'Completed Activity Only', body: 'Raised totals count completed donations, not pledges, pending payments, or refunded gifts.' },
            { icon: 'clock', title: 'Current Measurements', body: 'Platform figures are read from the production database and refreshed on a published schedule.' },
            { icon: 'shield', title: 'Privacy by Default', body: 'Reports use aggregate data and do not publish donor identities or person-level giving histories.' },
          ]} />
        </ReferenceSection>
      </div>

      <ReferenceSection title="Transparency Documents">
        <ReferenceCardGrid items={[
          { icon: 'document', title: 'Transparency Report', body: 'How donations, payouts, fees, and data are handled.', action: 'Read report', href: '/transparency', image: photos[1] },
          { icon: 'shield', title: 'Trust & Safety', body: 'How campaigns are reviewed and how concerns are handled.', action: 'View standards', href: '/trust-safety', image: photos[2] },
          { icon: 'dollar', title: 'Fees in Full', body: 'Every charge a donor or fundraiser can encounter.', action: 'View fees', href: '/fees', image: photos[3] },
          { icon: 'lock', title: 'Security', body: 'How accounts, payments, and personal data are protected.', action: 'Security overview', href: '/security', image: photos[4] },
        ]} />
      </ReferenceSection>

      <ReferenceCta
        icon="chart"
        title="See the Data at Campaign Level"
        body="Every public campaign shows its progress, updates, trust signals, and available transparency information."
        actions={[
          { label: 'Browse Campaigns', href: '/campaigns' },
          { label: 'Request Aggregate Data', href: '/contact', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
