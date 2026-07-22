import type { Metadata } from 'next';
import { seoMetadata } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/prohibited-use', {
    title: 'Prohibited Use Policy',
    description: 'Activities and campaigns that are not permitted on the CharitMe platform.',
    alternates: { canonical: 'https://www.charitme.com/prohibited-use' },
  });
}

export default function ProhibitedUsePage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Prohibited Use Policy</b></div>
        <h1>Prohibited Use Policy</h1>
        <p>Last updated: May 2025</p>
        <p>CharitMe is a platform for legitimate fundraising. The following uses are strictly prohibited.</p>
      </section>

      <article className="legal-body">
        <h2>Fraudulent or Deceptive Campaigns</h2>
        <ul>
          <li>Campaigns based on false, misleading, or fabricated stories</li>
          <li>Impersonating another person, organization, or public figure</li>
          <li>Using fake names, fake identities, or forged documents</li>
          <li>Misrepresenting how funds will be used</li>
          <li>Creating duplicate campaigns for the same beneficiary without disclosure</li>
        </ul>

        <h2>Illegal Activities</h2>
        <ul>
          <li>Fundraising for any activity that is illegal under applicable law</li>
          <li>Money laundering, tax evasion, or financial fraud</li>
          <li>Sanctions violations (campaigns involving OFAC-sanctioned individuals or entities)</li>
          <li>Fundraising to pay legal fines, restitution ordered by courts, or bail in certain jurisdictions</li>

          <li>Drug trafficking, weapons, or contraband</li>
        </ul>

        <h2>Harmful Content</h2>
        <ul>
          <li>Hate speech targeting race, ethnicity, religion, gender, sexual orientation, disability, or national origin</li>
          <li>Content promoting violence, terrorism, or self-harm</li>
          <li>Adult or sexually explicit content</li>
          <li>Content that endangers minors</li>
          <li>Harassment or threats against individuals</li>
        </ul>

        <h2>Gambling and Speculation</h2>
        <ul>
          <li>Lottery, raffle, or sweepstakes campaigns (except where lawfully permitted with proper licensing)</li>
          <li>Cryptocurrency speculation or token sales</li>
          <li>Multi-level marketing or pyramid schemes</li>
          <li>Investment solicitations</li>
        </ul>

        <h2>Platform Abuse</h2>
        <ul>
          <li>Creating fake donor accounts to inflate donation counts</li>
          <li>Spamming or bulk messaging to donors without consent</li>
          <li>Circumventing platform fees through off-platform payment arrangements</li>
          <li>Using automated tools to scrape donor data</li>
          <li>Reverse-engineering or attempting to compromise the platform</li>
        </ul>

        <h2>Consequences</h2>
        <p>
          Violations may result in immediate campaign hold, account suspension, funds being held pending investigation,
          and referral to law enforcement. If you suspect a violation, use the &ldquo;Report Campaign&rdquo; button on any campaign page
          or email <a href="mailto:trust@charitme.com">trust@charitme.com</a>.
        </p>

        <h2>Appeals</h2>
        <p>
          If your campaign has been held or removed and you believe this was in error, email{' '}
          <a href="mailto:appeals@charitme.com">appeals@charitme.com</a> with your campaign ID and explanation.
          We review all appeals within 5 business days.
        </p>
      </article>
    </div>
  );
}
