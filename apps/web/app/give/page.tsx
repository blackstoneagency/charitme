import { permanentRedirect } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// "Give once, fund many" (portfolio split gifts) has been WITHDRAWN.
//
// The feature took one payment and divided it across several campaigns. Stripe's
// `transfer_data.destination` accepts exactly ONE connected account, so a split
// gift could not be a destination charge: the money landed on CharitMe's own
// balance and a webhook fanned it out afterwards. That made this the only place
// in the product where CharitMe genuinely held donor funds — briefly when the
// fan-out worked, and indefinitely when a leg of it did not.
//
// This page is a REDIRECT rather than a deletion, on purpose:
//   · `/give` was linked from the footer, the supporter space, and the campaigns
//     list, and is a canonical URL that has been indexed. A 404 is a worse
//     answer than the page that now does the job.
//   · The withdrawn checkout used `${origin}/give` as its Stripe cancel_url, so
//     a session created before this shipped still lands somewhere sane if the
//     donor backs out.
//
// ⚠️ The webhook's portfolio settle path is deliberately still in place. Nothing
// can create a new portfolio session now, but Checkout Sessions live ~24h, so
// one opened before deploy can still be PAID after it. Without that handler the
// donation would go unrecorded and the money would sit on the platform balance
// with nothing saying whose it is. It can be deleted once no unpaid portfolio
// session can remain — see `handlePortfolioComplete` in the Stripe webhook.
// ─────────────────────────────────────────────────────────────────────────────

export default function GivePage(): never {
  permanentRedirect('/campaigns');
}
