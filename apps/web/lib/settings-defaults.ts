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
    // Ships EMPTY, not as the (555) 123-4567 reserved-fiction placeholder it
    // used to carry. /contact renders the phone only when it is set, and a
    // placeholder that looks like a real number is exactly what that gate
    // exists to stop. Nothing outside the admin editors reads this.
    supportPhone: '',
    // Postal address for /contact. Also empty by default: the old page printed
    // an invented San Francisco address as hard-coded JSX.
    officeAddress: '',
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
  // /about-us and /success-stories — the blocks on those pages that no table
  // can back, shipped from the supplied designs.
  //
  // ⚠️ These are the OWNER'S OWN content, supplied in their designs and
  // confirmed for publication after the alternative was put to them. They are
  // DEFAULTS, not constants: each is re-validated on read in lib/about-page.ts
  // and lib/impact-stats.ts, and anything stored in `platform_settings.config
  // .about` overrides them. Everything is editable in Super Admin → System
  // Settings → About page.
  about: {
    // The design's six-person leadership row.
    //
    // Names and titles only. The mockup's headshots are stock images this repo
    // has no files for, and an invented photo URL renders as a broken image, so
    // `AboutTeam` shows monogram initials instead — its intended empty-photo
    // state. Add `"photo"` (https only) per person to use real headshots.
    teamRoster: JSON.stringify([
      { name: 'Sarah Johnson', title: 'Chief Executive Officer', photo: '/images/team/sarah-johnson.jpg' },
      { name: 'Michael Patel', title: 'Chief Technology Officer', photo: '/images/team/michael-patel.jpg' },
      { name: 'Emily Carter', title: 'Chief Operations Officer', photo: '/images/team/emily-carter.jpg' },
      { name: 'David Lee', title: 'Head of Impact', photo: '/images/team/david-lee.jpg' },
      { name: 'Aisha Khan', title: 'Head of Community', photo: '/images/team/aisha-khan.jpg' },
      { name: 'James Wilson', title: 'Head of Trust & Safety', photo: '/images/team/james-wilson.jpg' },
    ]),

    // Gates the design's "Watch our story" button, and stays EMPTY — this one
    // is not a decision anyone can make on the owner's behalf, it needs a real
    // video URL. A play control that plays nothing is a dead affordance, and an
    // invented URL would be a broken link on the page whose job is looking
    // trustworthy. Set it and the button appears with no code change.
    storyVideoUrl: '',

    // The five-tile impact strip, shared by /about-us and /success-stories so
    // the two pages cannot quote different numbers for the same claim.
    //
    // ⚠️ NOT ONE of these five is derived from this database, and two disagree
    // with it by roughly a thousandfold: measured 2026-08-08, the platform had
    // 352 active campaigns, $96,850 raised, 592 gifts and 69 supported
    // countries. "98% Funds to Programs" also reads against /fees, which tells
    // donors the platform fee is 0% and 100% of a gift reaches the cause. They
    // are published because they are the owner's claims to make and the owner
    // asked for them — not because anything here verifies them.
    //
    // Setting this to `[]` restores the MEASURED figures on both pages, counted
    // live from campaigns, donations and supported countries.
    impactStats: JSON.stringify([
      { value: '2.3M+', label: 'People Helped' },
      { value: '68K+', label: 'Lives Transformed' },
      { value: '1,250+', label: 'Programs Funded' },
      { value: '120+', label: 'Countries Reached' },
      { value: '98%', label: 'Funds to Programs' },
    ]),
  },
};
