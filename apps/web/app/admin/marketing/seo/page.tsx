import 'server-only';
import { redirect } from 'next/navigation';

// SEO & AEO are now tabs on the single Marketing page. Keep this route so old
// links/bookmarks still land in the right place.
export default function MarketingSeoRedirect() {
  redirect('/admin/marketing?tab=seo');
}
