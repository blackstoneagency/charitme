import { FOOTER_SETTINGS_DEFAULTS } from './footer-nav';

export const VALID_CATEGORIES = [
  'general', 'security', 'email', 'payment', 'integrations',
  'notifications', 'storage', 'maintenance', 'flags', 'advanced', 'footer', 'about',
] as const;

export type SettingsCategory = typeof VALID_CATEGORIES[number];

export const DEFAULTS: Record<SettingsCategory, Record<string, unknown>> = {
  general: {
    platformName: 'CharitMe',
    tagline: 'Fundraising that thinks for you.',
    supportEmail: 'support@charitme.com',
    supportPhone: '+1 (555) 123-4567',
    timezone: 'America/New_York',
    logoUrl: '',
    primaryColor: '#6c35ff',
  },
  security: {
    passwordPolicy: 'strong',
    twoFactorAuth: 'required_admins',
    sessionTimeoutMinutes: 30,
    loginAttemptsAllowed: 5,
    ipWhitelist: '',
  },
  email: {
    fromName: 'CharitMe',
    fromEmail: 'noreply@charitme.org',
    replyToEmail: 'support@charitme.org',
    emailProvider: 'sendgrid',
    apiKey: '',
    defaultLanguage: 'en',
    emailFooterText: 'Thank you for supporting our mission!',
  },
  payment: {
    stripeLive: true,
    paypalEnabled: true,
    bankTransferEnabled: true,
    platformFeePct: 2.5,
    currency: 'USD',
    // One-time fee (in cents) a creator pays to feature their campaign in the
    // homepage rotator. Editable in Super Admin → Settings → Payment.
    featuredCampaignPriceCents: 500,
  },
  integrations: {
    googleAnalyticsEnabled: false,
    gaId: '',
    mailchimpEnabled: false,
    mailchimpKey: '',
    slackEnabled: false,
    slackWebhook: '',
    zapierEnabled: true,
    webhookUrl: 'https://api.charitme.org/webhook',
  },
  notifications: {
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
    smsEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
  storage: {
    cdnProvider: 'vercel',
    cdnUrl: '',
    maxUploadMb: 10,
    allowedFileTypes: 'jpg,jpeg,png,gif,webp,pdf,mp4',
  },
  maintenance: {
    automatedBackup: true,
    backupFrequency: 'daily',
    backupRetentionDays: 30,
    logRetentionDays: 90,
    maintenanceMode: false,
  },
  flags: {
    aiGrowthPlan: true,
    recurringDonations: true,
    donorLeaderboard: false,
    campaignAnalytics: true,
    referralProgram: false,
  },
  advanced: {
    debugMode: false,
    apiRateLimit: 100,
    cacheTtlSeconds: 3600,
    webhookTimeoutSeconds: 30,
    allowNewRegistrations: true,
  },
  // Global footer — social profiles, app store listings, contact address.
  // Values are re-validated on READ in lib/footer-nav.ts (https-only URLs,
  // well-formed email) because they render as hrefs on every page. An empty
  // string is meaningful: it hides that link. The app store URLs ship empty
  // because the apps do not exist yet.
  footer: { ...FOOTER_SETTINGS_DEFAULTS },
  // /about-us — the two blocks on that page which no table can back.
  //
  // Both ship EMPTY on purpose and both are re-validated on read in
  // lib/about-page.ts. `teamRoster` is a JSON array of {name, title, photo?};
  // the reference design shows six named executives, and inventing them would
  // put fabricated claims about real people on the company's own About page,
  // so the section stays unrendered until someone enters the real roster.
  // `storyVideoUrl` gates the "Watch our story" button the same way — a play
  // control that plays nothing is a dead affordance.
  about: {
    teamRoster: '[]',
    storyVideoUrl: '',
  },
};
