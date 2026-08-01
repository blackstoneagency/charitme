import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community Guidelines',
  description:
    'How to behave on CharitMe — for fundraisers, donors and commenters — and what happens when someone does not.',
  alternates: { canonical: 'https://www.charitme.com/community-guidelines' },
};

// Community Guidelines (design #98).
//
// Deliberately NOT a second copy of the Prohibited Use Policy. That page is the
// enforceable list of what is banned; this one is the behavioural standard —
// what good conduct looks like, how reporting works, and what we do about a
// report. Two pages that restate each other drift, and the day they disagree the
// one a moderator quotes is a coin flip. Where a rule is a hard prohibition,
// this page links there rather than restating it.

export default function CommunityGuidelinesPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Community Guidelines</b></div>
        <h1>Community Guidelines</h1>
        <p>Last updated: August 2026</p>
        <p>
          CharitMe works because strangers trust each other with money. These guidelines
          describe the behaviour that keeps that trust intact — for fundraisers, donors and
          anyone leaving a comment. The hard prohibitions live in the{' '}
          <Link href="/prohibited-use">Prohibited Use Policy</Link>; this page is about
          conduct.
        </p>
      </section>

      <article className="legal-body">
        <h2>Be honest about who you are and what the money is for</h2>
        <ul>
          <li>Use your real name and a real photo. If you are raising for someone else, say so, and name them.</li>
          <li>Describe what the funds will pay for in concrete terms. &ldquo;Medical bills&rdquo; is a category; &ldquo;six weeks of physiotherapy after a car accident&rdquo; is an answer.</li>
          <li>If your circumstances change — you reach your goal early, the surgery is cancelled, the family relocates — post an update. Donors give to a situation, and they are entitled to know when it changes.</li>
          <li>Never imply an endorsement, partnership or charity registration you do not have.</li>
        </ul>

        <h2>Keep your donors informed</h2>
        <ul>
          <li>Post an update when something meaningful happens, and at least once while funds are still being raised.</li>
          <li>Say where the money went. The <Link href="/transparency">Transparency Center</Link> explains the tools we give you for this, including the per-campaign fund ledger.</li>
          <li>Answer questions in good faith. You are not obliged to share private medical or legal detail — say that you would rather not, rather than inventing an answer.</li>
        </ul>

        <h2>Treat people decently</h2>
        <ul>
          <li>No harassment, threats, slurs, or attacks on someone&rsquo;s race, ethnicity, religion, gender, sexual orientation, disability or national origin.</li>
          <li>No pressuring people to give, publicly shaming those who did not, or contacting donors outside the platform without their consent.</li>
          <li>Disagree with a campaign without brigading it. If you believe something is wrong, report it — that is what reports are for.</li>
          <li>Do not post other people&rsquo;s private information: addresses, phone numbers, medical records, immigration status.</li>
        </ul>

        <h2>Protect people who cannot protect themselves</h2>
        <ul>
          <li>Get consent from the person a campaign is about, or from their guardian or next of kin.</li>
          <li>Be careful with photographs of children, patients and people in crisis. Ask whether the image is necessary or merely affecting.</li>
          <li>Campaigns naming a beneficiary must route funds to that beneficiary. See <Link href="/verification">Verification</Link> for how we confirm this.</li>
        </ul>

        <h2>Give and comment in good faith</h2>
        <ul>
          <li>Do not use donations to advertise, to test stolen cards, or to move money between your own accounts.</li>
          <li>Do not create additional accounts to inflate a donor count, vote, or evade a suspension.</li>
          <li>Anonymous giving is welcome. Anonymous abuse is not — the same rules apply to an anonymous donation message.</li>
        </ul>

        <h2>Reporting something</h2>
        <p>
          Every campaign page has a <strong>Report</strong> control, and every donation
          receipt carries a link to our support team. A report reaches a human. Tell us what
          you saw and, where you can, why you believe it is a problem — a report that names
          the specific claim it disputes is far faster to act on than one that says only
          &ldquo;this is a scam&rdquo;.
        </p>
        <p>
          Reporting is confidential. We do not tell the campaign owner who reported them.
        </p>

        <h2>What we do about it</h2>
        <p>Our response is proportionate, and it is not always removal:</p>
        <ul>
          <li><strong>We ask for clarification.</strong> Most reports are about a campaign that is honest but unclear. We ask the fundraiser to explain or correct it.</li>
          <li><strong>We pause payouts.</strong> Where funds are genuinely in question, we hold the money rather than let it move while we look. Donations already made stay with the campaign, not with us.</li>
          <li><strong>We remove content.</strong> Individual comments, images or updates may be taken down while the campaign continues.</li>
          <li><strong>We suspend or remove the campaign.</strong> For fraud, for the prohibitions listed in the <Link href="/prohibited-use">Prohibited Use Policy</Link>, or for repeated breaches after a warning.</li>
          <li><strong>We refund donors.</strong> Where a campaign is found to be fraudulent, see the <Link href="/refunds">Refund Policy</Link>.</li>
        </ul>
        <p>
          If we act against your campaign we will tell you what rule was broken and how to
          respond. If you think we got it wrong, reply to that message — appeals are read by
          someone who was not part of the original decision.
        </p>

        <h2>A note on what these guidelines are not</h2>
        <p>
          CharitMe does not verify the truth of every story told on the platform, and no
          platform can. What we do is make deception harder and consequences real:
          identity checks before payout, held funds when a campaign is questioned, and
          refunds when fraud is established. Read <Link href="/trust-safety">Trust &amp; Safety</Link> for
          how that machinery works, and <Link href="/security">Security</Link> for how your
          data and payments are protected.
        </p>

        <h2>Questions</h2>
        <p>
          Anything here that is unclear is our problem, not yours. <Link href="/contact">Contact us</Link> and
          we will answer — and, where the confusion is ours, fix the wording on this page.
        </p>
      </article>
    </div>
  );
}
