import { PageScaffold } from '../../../components/KindFundApp';

const updateItems: Array<[string, string, string | undefined, string, string]> = [
  ['Mia’s Surgery Was a Success!', 'We’re so happy to share that Mia’s heart surgery was successful.', '/hero-child-crop.png', 'Published', '1,250 views'],
  ['Thank You for Changing Lives', 'Because of your incredible support, Mia is on the road to recovery.', undefined, 'Published', '980 views'],
  ['We’re So Close to Our Goal!', 'With your help, we can give Mia the healthy future she deserves.', undefined, 'Published', '1,480 views'],
  ['Mia’s Journey So Far', 'A quick update on Mia’s diagnosis and path that led us here.', undefined, 'Published', '860 views'],
  ['What’s Next for Mia', 'More about Mia’s upcoming recovery and rehabilitation process.', undefined, 'Scheduled', ''],
];

const rows = updateItems.map(([title, subtitle, image, status, amount]) => ({ title, subtitle, image, status, amount, meta: ['May 20, 2024', '10:30 AM'] }));

export default function UpdatesPage() {
  return (
    <PageScaffold
      active="Updates"
      title="Updates"
      subtitle="Share progress, stories, and impact with your supporters."
      metrics={[
        { label: 'Total Updates', value: '56', change: '↑ 20% vs last 7 days', icon: 'doc', tone: 'violet' },
        { label: 'Total Views', value: '12,450', change: '↑ 18% vs last 7 days', icon: 'chart', tone: 'green' },
        { label: 'Total Engagements', value: '2,340', change: '↑ 24% vs last 7 days', icon: 'users', tone: 'blue' },
        { label: 'Avg. Engagement Rate', value: '18.8%', change: '↑ 6% vs last 7 days', icon: 'send', tone: 'orange' },
      ]}
      rows={rows}
      tabs={['All Updates (56)', 'Published (52)', 'Scheduled (2)', 'Drafts (2)']}
    />
  );
}
