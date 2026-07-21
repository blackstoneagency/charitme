// Structured data (schema.org) for a campaign detail page.
//
// The page already emits BreadcrumbList + FAQPage JSON-LD but had no node
// describing the campaign itself. This builds a truthful WebPage graph with a
// DonateAction so search/answer engines understand what the page is, who the
// recipient is, and where to donate. Everything here is derived from real
// campaign fields — nothing is fabricated. A DonateAction is only included when
// the campaign is actively accepting donations (never advertise donating to a
// closed campaign).

export interface CampaignJsonLdInput {
  title: string;
  description: string;
  url: string;
  image: string;
  organizerName: string | null;
  category: string | null;
  createdAt: string | null;
  isActive: boolean;
  siteOrigin: string;
  /** Verified nonprofit → recipient is an Organization; otherwise a Person. */
  nonprofitVerified?: boolean;
}

type JsonLdNode = Record<string, unknown>;

export function buildCampaignJsonLd(input: CampaignJsonLdInput): JsonLdNode {
  const recipient: JsonLdNode = {
    '@type': input.nonprofitVerified ? 'Organization' : 'Person',
    name: input.organizerName?.trim() || input.title,
  };

  const node: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.title,
    description: input.description || undefined,
    url: input.url,
    primaryImageOfPage: input.image || undefined,
    datePublished: input.createdAt || undefined,
    about: input.category || undefined,
    isPartOf: {
      '@type': 'WebSite',
      name: 'CharitMe',
      url: input.siteOrigin,
    },
    author: recipient,
    publisher: {
      '@type': 'Organization',
      name: 'CharitMe',
      url: input.siteOrigin,
    },
  };

  if (input.isActive) {
    node.potentialAction = {
      '@type': 'DonateAction',
      name: `Donate to ${input.title}`,
      recipient,
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${input.url}#donate-section`,
      },
    };
  }

  return node;
}
