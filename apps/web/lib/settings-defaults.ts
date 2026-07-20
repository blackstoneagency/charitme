export const VALID_CATEGORIES = [
  'general', 'security', 'email', 'payment', 'integrations',
  'notifications', 'storage', 'maintenance', 'flags', 'advanced',
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
};
