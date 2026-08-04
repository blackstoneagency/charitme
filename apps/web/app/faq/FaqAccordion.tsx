/**
 * One topic's worth of questions on /faq.
 *
 * Native `<details>/<summary>`, like the accordions on /how-it-works and
 * /contact: keyboard operation, screen-reader semantics and expand/collapse for
 * zero client JavaScript, and nowhere to get focus handling wrong.
 *
 * The heading keeps its `id` because other pages link straight to `#payouts`
 * and `#donors`. Renaming one silently breaks an inbound link, so the anchor
 * lives on the section rather than being derived from the title text.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export default function FaqAccordion({
  title,
  items,
  id,
}: {
  title: string;
  items: FaqItem[];
  id?: string;
}) {
  // A topic with nothing in it renders no heading at all.
  if (items.length === 0) return null;

  const headingId = `fq-h-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  return (
    <section className="fq-section" id={id} aria-labelledby={headingId}>
      <h2 id={headingId} className="fq-h2 fq-h2--left">{title}</h2>
      <ul className="fq-list">
        {items.map((item) => (
          <li key={item.question}>
            <details className="fq-item">
              <summary>
                <span className="fq-q">{item.question}</span>
                {/* Decorative: <details> already announces its own expanded
                    state, so a labelled control here would double up. */}
                <span className="fq-mark" aria-hidden="true" />
              </summary>
              <div className="fq-a">
                {/* whitespace-pre-line equivalent: admin-written answers may
                    carry deliberate line breaks. */}
                <p style={{ whiteSpace: 'pre-line' }}>{item.answer}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
