import Link from 'next/link';
import type { PublicAeoEntry } from '../../lib/aeo';

/**
 * The FAQ accordion on /contact.
 *
 * Native `<details>/<summary>`, which gives keyboard operation, screen reader
 * semantics and expand/collapse with **zero JavaScript**. A hand-rolled button
 * plus state would ship a client bundle to reproduce behaviour the platform
 * already has correct, and would be one more place to get focus handling wrong.
 *
 * The content is real `aeo_entries` rows — the same table `/faq` renders — so
 * an answer edited in the admin console changes both surfaces instead of the
 * two drifting apart. The five questions previously hard-coded here were a
 * sixth copy of that content, and one of them already disagreed with
 * /fast-payouts about how long a payout takes.
 */
export default function ContactFaq({ faqs }: { faqs: PublicAeoEntry[] }) {
  // No accordion at all rather than an empty one: a disclosure control with
  // nothing behind it is worse than the absence of the block.
  if (faqs.length === 0) return null;

  return (
    <section className="ct-faq-band" aria-labelledby="ct-faq-h">
      <h2 id="ct-faq-h" className="ct-h2">Quick answers before you reach out</h2>
      <ul className="ct-faq-list">
        {faqs.map((faq) => (
          <li key={faq.question}>
            <details className="ct-faq">
              <summary>
                <span className="ct-faq-q">{faq.question}</span>
                {/* Decorative: <details> already announces its own expanded
                    state, so a labelled control here would double up. */}
                <span className="ct-faq-mark" aria-hidden="true" />
              </summary>
              <div className="ct-faq-a">
                <p>{faq.answer}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <p className="ct-faq-more">
        <Link href="/faq">See all frequently asked questions →</Link>
      </p>
    </section>
  );
}
