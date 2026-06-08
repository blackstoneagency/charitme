import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import AdminSponsorsClient from './_components/AdminSponsorsClient';

export const dynamic = 'force-dynamic';

// ── Seed 50 fake sponsors on first visit (idempotent) ────────────────────────
async function maybeSeed() {
  const { count } = await supabaseAdmin
    .from('sponsors')
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;

  const sponsors = [
    { name: 'Google.org',          logo_url: 'https://logo.clearbit.com/google.org',          website: 'https://google.org',          active: true,  sort_order: 1  },
    { name: 'Salesforce',          logo_url: 'https://logo.clearbit.com/salesforce.com',       website: 'https://salesforce.com',       active: true,  sort_order: 2  },
    { name: 'Microsoft',           logo_url: 'https://logo.clearbit.com/microsoft.com',        website: 'https://microsoft.com',        active: true,  sort_order: 3  },
    { name: 'Apple',               logo_url: 'https://logo.clearbit.com/apple.com',            website: 'https://apple.com',            active: true,  sort_order: 4  },
    { name: 'Amazon',              logo_url: 'https://logo.clearbit.com/amazon.com',           website: 'https://amazon.com',           active: true,  sort_order: 5  },
    { name: 'Meta',                logo_url: 'https://logo.clearbit.com/meta.com',             website: 'https://meta.com',             active: true,  sort_order: 6  },
    { name: 'Stripe',              logo_url: 'https://logo.clearbit.com/stripe.com',           website: 'https://stripe.com',           active: true,  sort_order: 7  },
    { name: 'Shopify',             logo_url: 'https://logo.clearbit.com/shopify.com',          website: 'https://shopify.com',          active: true,  sort_order: 8  },
    { name: 'Airbnb',              logo_url: 'https://logo.clearbit.com/airbnb.com',           website: 'https://airbnb.com',           active: true,  sort_order: 9  },
    { name: 'PayPal',              logo_url: 'https://logo.clearbit.com/paypal.com',           website: 'https://paypal.com',           active: true,  sort_order: 10 },
    { name: 'Visa',                logo_url: 'https://logo.clearbit.com/visa.com',             website: 'https://visa.com',             active: true,  sort_order: 11 },
    { name: 'Mastercard',          logo_url: 'https://logo.clearbit.com/mastercard.com',       website: 'https://mastercard.com',       active: true,  sort_order: 12 },
    { name: 'Twilio',              logo_url: 'https://logo.clearbit.com/twilio.com',           website: 'https://twilio.com',           active: true,  sort_order: 13 },
    { name: 'HubSpot',             logo_url: 'https://logo.clearbit.com/hubspot.com',          website: 'https://hubspot.com',          active: true,  sort_order: 14 },
    { name: 'Mailchimp',           logo_url: 'https://logo.clearbit.com/mailchimp.com',        website: 'https://mailchimp.com',        active: true,  sort_order: 15 },
    { name: 'Slack',               logo_url: 'https://logo.clearbit.com/slack.com',            website: 'https://slack.com',            active: true,  sort_order: 16 },
    { name: 'Zoom',                logo_url: 'https://logo.clearbit.com/zoom.us',              website: 'https://zoom.us',              active: true,  sort_order: 17 },
    { name: 'Dropbox',             logo_url: 'https://logo.clearbit.com/dropbox.com',          website: 'https://dropbox.com',          active: true,  sort_order: 18 },
    { name: 'Atlassian',           logo_url: 'https://logo.clearbit.com/atlassian.com',        website: 'https://atlassian.com',        active: true,  sort_order: 19 },
    { name: 'Notion',              logo_url: 'https://logo.clearbit.com/notion.so',            website: 'https://notion.so',            active: true,  sort_order: 20 },
    { name: 'Figma',               logo_url: 'https://logo.clearbit.com/figma.com',            website: 'https://figma.com',            active: false, sort_order: 21 },
    { name: 'GitHub',              logo_url: 'https://logo.clearbit.com/github.com',           website: 'https://github.com',           active: true,  sort_order: 22 },
    { name: 'Vercel',              logo_url: 'https://logo.clearbit.com/vercel.com',           website: 'https://vercel.com',           active: true,  sort_order: 23 },
    { name: 'Supabase',            logo_url: 'https://logo.clearbit.com/supabase.com',         website: 'https://supabase.com',         active: true,  sort_order: 24 },
    { name: 'Cloudflare',          logo_url: 'https://logo.clearbit.com/cloudflare.com',       website: 'https://cloudflare.com',       active: true,  sort_order: 25 },
    { name: 'Intercom',            logo_url: 'https://logo.clearbit.com/intercom.com',         website: 'https://intercom.com',         active: false, sort_order: 26 },
    { name: 'Zendesk',             logo_url: 'https://logo.clearbit.com/zendesk.com',          website: 'https://zendesk.com',          active: true,  sort_order: 27 },
    { name: 'DocuSign',            logo_url: 'https://logo.clearbit.com/docusign.com',         website: 'https://docusign.com',         active: true,  sort_order: 28 },
    { name: 'Adobe',               logo_url: 'https://logo.clearbit.com/adobe.com',            website: 'https://adobe.com',            active: true,  sort_order: 29 },
    { name: 'Canva',               logo_url: 'https://logo.clearbit.com/canva.com',            website: 'https://canva.com',            active: true,  sort_order: 30 },
    { name: 'Typeform',            logo_url: 'https://logo.clearbit.com/typeform.com',         website: 'https://typeform.com',         active: false, sort_order: 31 },
    { name: 'Airtable',            logo_url: 'https://logo.clearbit.com/airtable.com',         website: 'https://airtable.com',         active: true,  sort_order: 32 },
    { name: 'Monday.com',          logo_url: 'https://logo.clearbit.com/monday.com',           website: 'https://monday.com',           active: true,  sort_order: 33 },
    { name: 'Asana',               logo_url: 'https://logo.clearbit.com/asana.com',            website: 'https://asana.com',            active: false, sort_order: 34 },
    { name: 'Linear',              logo_url: 'https://logo.clearbit.com/linear.app',           website: 'https://linear.app',           active: true,  sort_order: 35 },
    { name: 'Loom',                logo_url: 'https://logo.clearbit.com/loom.com',             website: 'https://loom.com',             active: true,  sort_order: 36 },
    { name: 'Calendly',            logo_url: 'https://logo.clearbit.com/calendly.com',         website: 'https://calendly.com',         active: true,  sort_order: 37 },
    { name: 'Webflow',             logo_url: 'https://logo.clearbit.com/webflow.com',          website: 'https://webflow.com',          active: false, sort_order: 38 },
    { name: 'Squarespace',         logo_url: 'https://logo.clearbit.com/squarespace.com',      website: 'https://squarespace.com',      active: true,  sort_order: 39 },
    { name: 'Wix',                 logo_url: 'https://logo.clearbit.com/wix.com',              website: 'https://wix.com',              active: false, sort_order: 40 },
    { name: 'Klaviyo',             logo_url: 'https://logo.clearbit.com/klaviyo.com',          website: 'https://klaviyo.com',          active: true,  sort_order: 41 },
    { name: 'Brex',                logo_url: 'https://logo.clearbit.com/brex.com',             website: 'https://brex.com',             active: true,  sort_order: 42 },
    { name: 'Rippling',            logo_url: 'https://logo.clearbit.com/rippling.com',         website: 'https://rippling.com',         active: false, sort_order: 43 },
    { name: 'Gusto',               logo_url: 'https://logo.clearbit.com/gusto.com',            website: 'https://gusto.com',            active: true,  sort_order: 44 },
    { name: 'QuickBooks',          logo_url: 'https://logo.clearbit.com/quickbooks.intuit.com',website: 'https://quickbooks.intuit.com',active: false, sort_order: 45 },
    { name: 'Plaid',               logo_url: 'https://logo.clearbit.com/plaid.com',            website: 'https://plaid.com',            active: true,  sort_order: 46 },
    { name: 'Segment',             logo_url: 'https://logo.clearbit.com/segment.com',          website: 'https://segment.com',          active: false, sort_order: 47 },
    { name: 'Mixpanel',            logo_url: 'https://logo.clearbit.com/mixpanel.com',         website: 'https://mixpanel.com',         active: true,  sort_order: 48 },
    { name: 'Amplitude',           logo_url: 'https://logo.clearbit.com/amplitude.com',        website: 'https://amplitude.com',        active: false, sort_order: 49 },
    { name: 'Datadog',             logo_url: 'https://logo.clearbit.com/datadoghq.com',        website: 'https://datadoghq.com',        active: true,  sort_order: 50 },
  ];

  await supabaseAdmin.from('sponsors').insert(sponsors);
}

export default async function AdminSponsorsPage() {
  await requireAdmin();
  await maybeSeed();
  return (
    <CharitMeShell active="Sponsors" mode="admin">
      <TopBar title="Sponsors" subtitle="Manage sponsor logos displayed in the homepage rotating bar." actions={<></>} />
      <AdminSponsorsClient />
    </CharitMeShell>
  );
}
