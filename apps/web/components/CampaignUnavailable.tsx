import Link from 'next/link';

/**
 * Shown when a campaign row could not be READ.
 *
 * Deliberately distinct from a 404. `notFound()` asserts that nothing exists at
 * this URL — a claim that gets cached by browsers, shared in messages and
 * indexed by search engines. When the database is simply unreachable we do not
 * know whether the campaign exists, and on the donation path guessing "gone" is
 * the most damaging guess available.
 *
 * So this offers a retry rather than sending the visitor elsewhere: the campaign
 * is almost certainly fine and still collecting.
 */
export default function CampaignUnavailable({ slug }: { slug: string }) {
  return (
    <div style={{ maxWidth: '560px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
      <h1 style={{ fontSize: 'var(--fs-h2)', marginBottom: '10px' }}>
        We couldn&rsquo;t load this campaign
      </h1>
      <p style={{ color: 'var(--t3)', lineHeight: 1.6, marginBottom: '22px' }}>
        This is a temporary problem on our side — it does not mean the campaign is gone or has
        stopped accepting donations. Please try again in a moment.
      </p>
      <Link href={`/campaigns/${slug}`} className="cta-primary">Try again</Link>
      <p style={{ marginTop: '18px', fontSize: '14px' }}>
        <Link href="/campaigns" style={{ color: 'var(--t3)' }}>Browse all campaigns</Link>
      </p>
    </div>
  );
}
