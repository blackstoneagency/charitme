import { describe, expect, it } from 'vitest';
import { validateCampaignPublication } from '../lib/campaign-validation';
import { parseCampaignLimit, parseCampaignPage, sanitizeCampaignSearchTerm } from '../lib/campaign-search';
import { isMissingPaymentMethodsColumn } from '../lib/profile-payment-methods';
import { parseCampaignMediaPath } from '../lib/campaign-media';

describe('campaign media path contract', () => {
  it('accepts only UUID-scoped campaign media paths', () => {
    expect(parseCampaignMediaPath('campaigns/11111111-1111-4111-8111-111111111111/cover/22222222-2222-4222-8222-222222222222.jpg')).toMatchObject({
      ownerId: '11111111-1111-4111-8111-111111111111',
      slot: 'cover',
    });
  });

  it('rejects traversal, arbitrary prefixes, and unsupported extensions', () => {
    expect(parseCampaignMediaPath('campaigns/11111111-1111-4111-8111-111111111111/cover/../../other.jpg')).toBeNull();
    expect(parseCampaignMediaPath('campaigns/not-a-uuid/cover/file.jpg')).toBeNull();
    expect(parseCampaignMediaPath('campaigns/11111111-1111-4111-8111-111111111111/cover/22222222-2222-4222-8222-222222222222.svg')).toBeNull();
  });
});

describe('campaign media metadata synchronization contract', () => {
  it('records scoped uploads and removes metadata with storage files', async () => {
    const source = await import('node:fs/promises');
    const route = await source.readFile(new URL('../app/api/upload/campaign-image/route.ts', import.meta.url), 'utf8');
    expect(route).toContain(".from('campaign_media').insert({");
    expect(route).toContain(".from('campaign_media')\n    .delete()");
    expect(route).toContain('The file uploaded, but its campaign media metadata could not be stored.');
    expect(route).toContain('The file was removed, but its campaign media metadata could not be removed.');
  });

  it('keeps the normalized media table protected by explicit RLS policies', async () => {
    const source = await import('node:fs/promises');
    const migration = await source.readFile(new URL('../../../supabase/migrations/20260725030000_campaign_media_rls.sql', import.meta.url), 'utf8');
    expect(migration).toContain('campaign_media_public_read');
    expect(migration).toContain('campaign_media_owner_insert');
    expect(migration).toContain('campaign_media_owner_update');
    expect(migration).toContain('campaign_media_owner_delete');
    expect(migration).toContain("campaigns.visibility = 'public'");
    expect(migration).toContain('campaigns.user_id = auth.uid()');
  });

  it('keeps Storage policy limits and path authorization aligned with uploads', async () => {
    const source = await import('node:fs/promises');
    const migration = await source.readFile(new URL('../../../supabase/migrations/20260725040000_campaign_media_storage_policy.sql', import.meta.url), 'utf8');
    expect(migration).toContain('file_size_limit = 5242880');
    expect(migration).toContain("'image/gif'");
    expect(migration).toContain("'image/avif'");
    expect(migration).toContain('storage.foldername(name))[2]');
    expect(migration).toContain('campaigns.id::text = (storage.foldername(name))[2]');
  });
});

describe('campaign wizard recovery contract', () => {
  it('persists the wizard in session storage and clears it after save', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("const WIZARD_STORAGE_KEY = 'cm_wizard';");
    expect(page).toContain('sessionStorage.setItem(WIZARD_STORAGE_KEY');
    expect(page).toContain('sessionStorage.removeItem(WIZARD_STORAGE_KEY)');
  });
});

describe('campaign builder media failure contract', () => {
  it('validates upload responses and preserves an image when deletion fails', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("if (typeof data.url !== 'string' || typeof data.path !== 'string')");
    expect(page).toContain("if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Image could not be removed.')");
    expect(page).toContain('return;\n      }\n    }\n    setUploadedImages');
  });
});

describe('dashboard campaign edit media contract', () => {
  it('scopes cover uploads to the edited campaign and surfaces metadata warnings', async () => {
    const source = await import('node:fs/promises');
    const panel = await source.readFile(new URL('../app/dashboard/campaigns/[id]/_components/EditCampaignPanel.tsx', import.meta.url), 'utf8');
    expect(panel).toContain("fd.append('campaignId', campaignId)");
    expect(panel).toContain("fd.append('type', 'cover')");
    expect(panel).toContain('warning?: string');
    expect(panel).toContain('if (data.warning) setUploadError(data.warning);');
  });
});

describe('campaign creation partial-success contract', () => {
  it('keeps the campaign successful when optional evidence storage fails', async () => {
    const source = await import('node:fs/promises');
    const route = await source.readFile(new URL('../app/api/campaigns/route.ts', import.meta.url), 'utf8');
    expect(route).toContain("reason: 'Campaign created'");
    expect(route).toContain("warning = 'Campaign saved, but the evidence note could not be stored.");
    expect(route).toContain('return NextResponse.json(warning ? { ...data, warning } : data, { status: 201 });');
    expect(route).not.toContain("code: 'EVIDENCE_SAVE_FAILED'");
  });

  it('persists uploaded storage paths as normalized campaign media', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    const route = await source.readFile(new URL('../app/api/campaigns/route.ts', import.meta.url), 'utf8');
    expect(page).toContain('imagePaths: uploadedImages.filter(img => img.status === \'done\').map(img => img.id)');
    expect(route).toContain(".from('campaign_media').insert(mediaRows)");
    expect(route).toContain('parsedPath?.ownerId === user.id');
    expect(route).toContain('Campaign media metadata save failed');
    expect(route).toContain("getPublicUrl(path).data.publicUrl");
    expect(route).toContain('const persistedImageUrls = normalizedMediaPaths.length > 0 ? normalizedImageUrls');
  });
});

describe('campaign creation warning contract', () => {
  it('surfaces an API warning on the live success screen', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("const [warning, setWarning]         = useState('');");
    expect(page).toContain("if (typeof data.warning === 'string') setWarning(data.warning);");
    expect(page).toContain('role="status"');
  });
});

describe('campaign creation idempotency contract', () => {
  it('sends and validates a persistent UUID idempotency key', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    const route = await source.readFile(new URL('../app/api/campaigns/route.ts', import.meta.url), 'utf8');
    expect(page).toContain("const REQUEST_KEY_STORAGE_KEY = 'cm_campaign_request_id';");
    expect(page).toContain("'Idempotency-Key': requestKey");
    expect(route).toContain("z.string().uuid().safeParse(rawIdempotencyKey)");
    expect(route).toContain("if (existingCampaign) return NextResponse.json(existingCampaign, { status: 200 });");
    expect(route).toContain("if (error.code === '23505')");
  });
});

describe('payment preference schema rollout', () => {
  it('recognizes only missing-column/schema-cache errors for legacy fallback', () => {
    expect(isMissingPaymentMethodsColumn({ code: 'PGRST204', message: 'Column not found' })).toBe(true);
    expect(isMissingPaymentMethodsColumn({ code: '42703', message: 'payment_methods does not exist' })).toBe(true);
    expect(isMissingPaymentMethodsColumn({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingPaymentMethodsColumn(null)).toBe(false);
  });
});

describe('campaign discovery query contract', () => {
  it('normalizes invalid pagination values', () => {
    expect(parseCampaignPage('not-a-number')).toBe(1);
    expect(parseCampaignPage('0')).toBe(1);
    expect(parseCampaignLimit('999')).toBe(100);
    expect(parseCampaignLimit('-1')).toBe(1);
  });

  it('removes PostgREST OR syntax characters from search terms', () => {
    expect(sanitizeCampaignSearchTerm('medical,(urgent),help')).toBe('medical  urgent  help');
  });
});

describe('campaign publication validation', () => {
  const valid = { title: 'Community recovery fund', description: 'A detailed story that explains the need and the plan.', goalAmount: 10000 };

  it('accepts a publishable campaign', () => {
    expect(validateCampaignPublication(valid)).toBeNull();
  });

  it('rejects an incomplete title', () => {
    expect(validateCampaignPublication({ ...valid, title: 'No' })).toContain('title');
  });

  it('rejects a short story', () => {
    expect(validateCampaignPublication({ ...valid, description: 'Too short' })).toContain('story');
  });

  it('rejects a sub-dollar goal', () => {
    expect(validateCampaignPublication({ ...valid, goalAmount: 99 })).toContain('goal');
  });
});

describe('campaign media contract', () => {
  it('uses the documented 5 MB upload ceiling', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('5 MB each');
    expect(page).not.toContain('10 MB each');
  });
});

describe('campaign payout UI contract', () => {
  it('does not present legacy payout preferences as publish-ready', async () => {
    const source = await import('node:fs/promises');
    const page = await source.readFile(new URL('../app/create/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('Stripe Connect is the only live payout method.');
    expect(page).toContain('Venmo <span className="cr2-payout-recommended">NOT AVAILABLE</span>');
    expect(page).toContain('PayPal <span className="cr2-payout-recommended">NOT AVAILABLE</span>');
  });
});

describe('campaign lifecycle copy contract', () => {
  it('does not claim paused campaigns are publicly visible', async () => {
    const source = await import('node:fs/promises');
    const controls = await source.readFile(new URL('../app/dashboard/campaigns/[id]/_components/CampaignControls.tsx', import.meta.url), 'utf8');
    expect(controls).toContain('public page is unavailable until you resume');
    expect(controls).not.toContain('The page is still visible.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaign creation validation
// ─────────────────────────────────────────────────────────────────────────────
describe('campaign slug generation', () => {
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
  }

  it('produces a URL-safe slug from a title', () => {
    expect(slugify('Help John Cover Medical Bills!')).toBe('help-john-cover-medical-bills');
  });

  it('removes special characters', () => {
    // & stripped → 'mias-recovery-fund-more' (consecutive dashes collapsed)
    const result = slugify("Mia's Recovery Fund & More");
    expect(result).toMatch(/^mias-recovery-fund/);
    expect(result).not.toMatch(/[^a-z0-9-]/);
  });

  it('truncates long titles at 60 chars', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it('handles empty string gracefully', () => {
    expect(slugify('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Anonymous donation flow
// ─────────────────────────────────────────────────────────────────────────────
describe('anonymous donation logic', () => {
  function buildDonationRecord(params: {
    donorId: string | null;
    anonymous: boolean;
    amountCents: number;
    message?: string;
  }) {
    return {
      donor_id: params.anonymous ? null : params.donorId,
      anonymous: params.anonymous,
      amount_cents: params.amountCents,
      message: params.message ?? null,
      status: 'completed',
    };
  }

  it('sets donor_id to null for anonymous donations', () => {
    const record = buildDonationRecord({ donorId: 'user-123', anonymous: true, amountCents: 5000 });
    expect(record.donor_id).toBeNull();
    expect(record.anonymous).toBe(true);
  });

  it('preserves donor_id for public donations', () => {
    const record = buildDonationRecord({ donorId: 'user-123', anonymous: false, amountCents: 5000 });
    expect(record.donor_id).toBe('user-123');
    expect(record.anonymous).toBe(false);
  });

  it('allows message even when anonymous', () => {
    const record = buildDonationRecord({ donorId: null, anonymous: true, amountCents: 1000, message: 'Stay strong!' });
    expect(record.message).toBe('Stay strong!');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recurring donation schema
// ─────────────────────────────────────────────────────────────────────────────
describe('recurring donation cadence', () => {
  type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'annual';

  function nextBillDate(from: Date, cadence: Cadence): Date {
    const d = new Date(from);
    switch (cadence) {
      case 'weekly':    d.setDate(d.getDate() + 7); break;
      case 'monthly':   d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'annual':    d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
  }

  it('calculates next weekly billing correctly', () => {
    const base = new Date('2026-01-01');
    const next = nextBillDate(base, 'weekly');
    expect(next.toISOString().startsWith('2026-01-08')).toBe(true);
  });

  it('calculates next monthly billing correctly', () => {
    const base = new Date('2026-01-15');
    const next = nextBillDate(base, 'monthly');
    expect(next.toISOString().startsWith('2026-02-15')).toBe(true);
  });

  it('calculates next annual billing correctly', () => {
    const base = new Date('2026-06-01');
    const next = nextBillDate(base, 'annual');
    expect(next.getFullYear()).toBe(2027);
  });

  const VALID_CADENCES: Cadence[] = ['weekly', 'monthly', 'quarterly', 'annual'];
  it('only allows valid cadences', () => {
    const input = 'monthly';
    expect(VALID_CADENCES).toContain(input);
    expect(VALID_CADENCES).not.toContain('daily');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Beneficiary invite token logic
// ─────────────────────────────────────────────────────────────────────────────
describe('beneficiary invite', () => {
  function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  function isAccepted(acceptedAt: string | null): boolean {
    return acceptedAt !== null;
  }

  it('correctly identifies an expired invite', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
    expect(isExpired(pastDate)).toBe(true);
  });

  it('correctly identifies a valid (non-expired) invite', () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days from now
    expect(isExpired(futureDate)).toBe(false);
  });

  it('correctly identifies an already-accepted invite', () => {
    expect(isAccepted('2026-01-01T00:00:00Z')).toBe(true);
    expect(isAccepted(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refund status transitions
// ─────────────────────────────────────────────────────────────────────────────
describe('refund status machine', () => {
  type RefundStatus = 'requested' | 'under_review' | 'approved' | 'declined' | 'processing' | 'processed' | 'failed' | 'canceled';

  const VALID_TRANSITIONS: Partial<Record<RefundStatus, RefundStatus[]>> = {
    requested:    ['under_review', 'approved', 'declined', 'canceled'],
    under_review: ['approved', 'declined', 'canceled'],
    approved:     ['processing'],
    processing:   ['processed', 'failed'],
    declined:     [],
    processed:    [],
    failed:       ['processing', 'canceled'],
    canceled:     [],
  };

  function canTransition(from: RefundStatus, to: RefundStatus): boolean {
    return (VALID_TRANSITIONS[from] ?? []).includes(to);
  }

  it('allows requested → approved', () => expect(canTransition('requested', 'approved')).toBe(true));
  it('allows approved → processing', () => expect(canTransition('approved', 'processing')).toBe(true));
  it('allows processing → processed', () => expect(canTransition('processing', 'processed')).toBe(true));
  it('denies processed → approved (terminal state)', () => expect(canTransition('processed', 'approved')).toBe(false));
  it('allows under_review → declined', () => expect(canTransition('under_review', 'declined')).toBe(true));
  it('allows failed → canceled', () => expect(canTransition('failed', 'canceled')).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// Chargeback detection heuristics
// ─────────────────────────────────────────────────────────────────────────────
describe('chargeback / dispute detection', () => {
  interface DisputeData {
    id: string;
    status: 'warning_needs_response' | 'needs_response' | 'under_review' | 'charge_refunded' | 'won' | 'lost';
    amount: number;
    reason: string;
  }

  function isOpenDispute(d: DisputeData): boolean {
    return ['warning_needs_response', 'needs_response', 'under_review'].includes(d.status);
  }

  function isClosedDispute(d: DisputeData): boolean {
    return ['won', 'lost', 'charge_refunded'].includes(d.status);
  }

  const dispute: DisputeData = {
    id: 'dp_test',
    status: 'needs_response',
    amount: 10000,
    reason: 'fraudulent',
  };

  it('correctly identifies an open dispute requiring action', () => {
    expect(isOpenDispute(dispute)).toBe(true);
    expect(isClosedDispute(dispute)).toBe(false);
  });

  it('correctly identifies a closed won dispute', () => {
    const won: DisputeData = { ...dispute, status: 'won' };
    expect(isOpenDispute(won)).toBe(false);
    expect(isClosedDispute(won)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Co-organizer permission checks
// ─────────────────────────────────────────────────────────────────────────────
describe('co-organizer permissions', () => {
  type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'finance';

  interface TeamMember {
    role: TeamRole;
    permissions: {
      post_updates?: boolean;
      thank_donors?: boolean;
      view_donors?: boolean;
      view_ledger?: boolean;
      manage_payout?: boolean;
    };
  }

  function canManagePayout(member: TeamMember): boolean {
    if (member.role === 'owner' || member.role === 'admin') return true;
    return member.permissions.manage_payout === true;
  }

  function canPostUpdates(member: TeamMember): boolean {
    if (member.role === 'owner' || member.role === 'admin' || member.role === 'editor') return true;
    return member.permissions.post_updates === true;
  }

  function canViewLedger(member: TeamMember): boolean {
    if (member.role === 'owner' || member.role === 'admin' || member.role === 'finance') return true;
    return member.permissions.view_ledger === true;
  }

  const editor: TeamMember = {
    role: 'editor',
    permissions: { post_updates: true, thank_donors: true, view_donors: true, view_ledger: false, manage_payout: false },
  };

  const viewer: TeamMember = {
    role: 'viewer',
    permissions: { post_updates: false, thank_donors: false, view_donors: true, view_ledger: false, manage_payout: false },
  };

  const finance: TeamMember = {
    role: 'finance',
    permissions: { post_updates: false, thank_donors: false, view_donors: false, view_ledger: true, manage_payout: false },
  };

  it('editor can post updates', () => expect(canPostUpdates(editor)).toBe(true));
  it('viewer cannot post updates', () => expect(canPostUpdates(viewer)).toBe(false));
  it('editor cannot manage payouts', () => expect(canManagePayout(editor)).toBe(false));
  it('finance role can view ledger', () => expect(canViewLedger(finance)).toBe(true));
  it('editor cannot view ledger by default', () => expect(canViewLedger(editor)).toBe(false));
  it('viewer cannot manage payouts', () => expect(canManagePayout(viewer)).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// Trust score computation
// ─────────────────────────────────────────────────────────────────────────────
describe('trust score calculation', () => {
  interface TrustComponents {
    identityScore: number;    // 0-25
    storyScore: number;       // 0-25
    activityScore: number;    // 0-25
    transparencyScore: number; // 0-25
  }

  function computeTrustScore(c: TrustComponents): number {
    return c.identityScore + c.storyScore + c.activityScore + c.transparencyScore;
  }

  function getTrustLabel(score: number): string {
    if (score >= 80) return 'Verified';
    if (score >= 60) return 'Trusted';
    if (score >= 40) return 'Emerging';
    return 'Needs More Info';
  }

  it('sums all four components correctly', () => {
    expect(computeTrustScore({ identityScore: 25, storyScore: 25, activityScore: 25, transparencyScore: 25 })).toBe(100);
    expect(computeTrustScore({ identityScore: 10, storyScore: 15, activityScore: 5, transparencyScore: 20 })).toBe(50);
  });

  it('assigns correct trust labels', () => {
    expect(getTrustLabel(100)).toBe('Verified');
    expect(getTrustLabel(75)).toBe('Trusted');
    expect(getTrustLabel(50)).toBe('Emerging');
    expect(getTrustLabel(20)).toBe('Needs More Info');
  });

  it('score cannot exceed 100', () => {
    const perfect = computeTrustScore({ identityScore: 25, storyScore: 25, activityScore: 25, transparencyScore: 25 });
    expect(perfect).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Share event channel tracking
// ─────────────────────────────────────────────────────────────────────────────
describe('share event channel tracking', () => {
  type ShareChannel = 'link' | 'email' | 'sms' | 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'whatsapp' | 'qr' | 'other';

  function aggregateSharesByChannel(events: { channel: ShareChannel; converted: boolean }[]) {
    const result: Record<string, { count: number; conversions: number; rate: number }> = {};
    for (const ev of events) {
      if (!result[ev.channel]) result[ev.channel] = { count: 0, conversions: 0, rate: 0 };
      result[ev.channel].count += 1;
      if (ev.converted) result[ev.channel].conversions += 1;
    }
    for (const ch of Object.values(result)) {
      ch.rate = ch.count > 0 ? ch.conversions / ch.count : 0;
    }
    return result;
  }

  const events = [
    { channel: 'facebook' as ShareChannel, converted: true },
    { channel: 'facebook' as ShareChannel, converted: false },
    { channel: 'facebook' as ShareChannel, converted: true },
    { channel: 'link' as ShareChannel, converted: false },
    { channel: 'link' as ShareChannel, converted: false },
    { channel: 'twitter' as ShareChannel, converted: true },
  ];

  it('counts shares correctly per channel', () => {
    const result = aggregateSharesByChannel(events);
    expect(result.facebook.count).toBe(3);
    expect(result.link.count).toBe(2);
    expect(result.twitter.count).toBe(1);
  });

  it('calculates conversion rates correctly', () => {
    const result = aggregateSharesByChannel(events);
    expect(result.facebook.rate).toBeCloseTo(2 / 3);
    expect(result.link.rate).toBe(0);
    expect(result.twitter.rate).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaign accept_donations toggle
// ─────────────────────────────────────────────────────────────────────────────
describe('campaign donations toggle', () => {
  interface Campaign {
    id: string;
    status: 'active' | 'paused' | 'completed' | 'draft';
    accept_donations: boolean;
  }

  function shouldShowDonateButton(campaign: Campaign): boolean {
    return campaign.status === 'active' && campaign.accept_donations;
  }

  it('shows donate button for active campaigns with donations enabled', () => {
    expect(shouldShowDonateButton({ id: '1', status: 'active', accept_donations: true })).toBe(true);
  });

  it('hides donate button when donations are toggled off', () => {
    expect(shouldShowDonateButton({ id: '1', status: 'active', accept_donations: false })).toBe(false);
  });

  it('hides donate button for paused campaigns', () => {
    expect(shouldShowDonateButton({ id: '1', status: 'paused', accept_donations: true })).toBe(false);
  });

  it('hides donate button for completed campaigns', () => {
    expect(shouldShowDonateButton({ id: '1', status: 'completed', accept_donations: true })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tax receipt eligibility
// ─────────────────────────────────────────────────────────────────────────────
describe('tax receipt eligibility', () => {
  interface NonprofitCampaign {
    nonprofit_verified: boolean;
    nonprofit_ein?: string;
    campaign_category: string;
  }

  function isTaxDeductible(campaign: NonprofitCampaign): boolean {
    return campaign.nonprofit_verified && Boolean(campaign.nonprofit_ein);
  }

  it('grants tax deductibility for verified nonprofit with EIN', () => {
    expect(isTaxDeductible({ nonprofit_verified: true, nonprofit_ein: '12-3456789', campaign_category: 'Nonprofit' })).toBe(true);
  });

  it('denies tax deductibility when not nonprofit verified', () => {
    expect(isTaxDeductible({ nonprofit_verified: false, nonprofit_ein: '12-3456789', campaign_category: 'Medical' })).toBe(false);
  });

  it('denies tax deductibility when EIN is missing', () => {
    expect(isTaxDeductible({ nonprofit_verified: true, campaign_category: 'Nonprofit' })).toBe(false);
  });
});
