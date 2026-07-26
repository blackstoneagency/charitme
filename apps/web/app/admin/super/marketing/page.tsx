import 'server-only';
import { redirect } from 'next/navigation';

// Marketing is a single surface at /admin/marketing.
//
// This page used to be a second, parallel UI over the SAME tables
// (seo_settings / aeo_entries / marketing_campaigns) with its own duplicate API
// routes, so an admin could edit the same records in two places with different
// field sets and no shared validation. It now redirects; SEO and AEO are
// first-class tabs on /admin/marketing (?tab=seo / ?tab=aeo) and marketing
// campaigns live on the Campaigns tab there.
export default function SuperMarketingRedirect() {
  redirect('/admin/marketing');
}
