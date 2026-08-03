import type { PublicAeoEntry } from '../../lib/aeo';

/**
 * The FAQ accordion from the reference.
 *
 * Built on native `<details>/<summary>`, which gives keyboard operation, screen
 * reader semantics and expand/collapse with **zero JavaScript**. A hand-rolled
 * button + `aria-expanded` + state would ship a client bundle to reproduce
 * behaviour the platform already has correct — and would be one more place to
 * get focus handling wrong.
 *
 * The content is real `aeo_entries` rows, the same table `/faq` renders, so an
 * answer edited in the admin console changes both surfaces instead of drifting.
 */
export default function HowItWorksFaq({ faqs }: { faqs: PublicAeoEntry[] }) {
  // No accordion at all rather than an empty one: a disclosure control with
  // nothing behind it is worse than the absence of the block.
  if (faqs.length === 0) return null;

  return (
    <ul className="hw-faq-list">
      {faqs.map((faq) => (
        <li key={faq.question}>
          <details className="hw-faq">
            <summary>
              <span className="hw-faq-q">{faq.question}</span>
              {/* Decorative: <details> already announces its own expanded state,
                  so a labelled control here would double up. */}
              <span className="hw-faq-mark" aria-hidden="true" />
            </summary>
            <div className="hw-faq-a">
              <p>{faq.answer}</p>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
