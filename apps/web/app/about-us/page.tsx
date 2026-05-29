import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about CharitMe and our mission to make fundraising smarter, safer, and more human.',
};

export default function AboutUsPage() {
  return (
    <div className="pub-page simple-public">
      <section>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>About Us</b></div>
        <h1>Fundraising that thinks for you. Built by people who care.</h1>
        <p>CharitMe combines compassionate design, transparent giving tools, and AI-powered guidance so more organizers can turn real stories into real impact.</p>
        <div className="pub-actions">
          <Link href="/login?mode=signup" className="pub-btn primary">Get Started</Link>
          <Link href="/success-stories" className="pub-btn secondary">See Success Stories <PublicIcon name="arrow" /></Link>
        </div>
      </section>
      <section className="simple-grid">
        {[
          ['shield', 'Trust first', 'Verification, safety signals, and transparent campaign records help donors give with confidence.'],
          ['ai', 'AI with heart', 'Our AI helps organizers tell clearer stories, reach the right people, and share meaningful updates.'],
          ['globe', 'Built for impact', 'From families to nonprofits, CharitMe gives every cause the tools to grow responsibly.'],
        ].map(([icon, title, body]) => (
          <article key={title}><span><PublicIcon name={icon} /></span><h2>{title}</h2><p>{body}</p></article>
        ))}
      </section>
    </div>
  );
}
