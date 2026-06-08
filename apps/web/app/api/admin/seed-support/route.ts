import 'server-only';
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

// GET /api/admin/seed-support
// Idempotent: skips if 100+ rows already exist.
// Seeds 500 realistic fake support_cases rows directly into Supabase.
export async function GET() {
  await requireAdmin();

  // Check existing count — skip if already seeded
  const { count } = await supabaseAdmin
    .from('support_cases')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) >= 100) {
    return NextResponse.json({ ok: true, skipped: true, existing: count });
  }

  // Pull a sample of real profile IDs so some cases have real submitters
  const { data: profileRows } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .limit(50);
  const profileIds = (profileRows ?? []).map((p) => p.id);

  const SUBJECTS = [
    'Unable to withdraw my campaign funds',
    'My donation did not go through',
    'How do I edit my campaign after publishing?',
    'Stripe account verification stuck',
    'My campaign was flagged — need review',
    'Refund request for duplicate donation',
    'Can I transfer campaign ownership?',
    'Photo upload not working on mobile',
    'Campaign not showing in search results',
    'I did not receive my donation receipt',
    'How do I add a co-organizer?',
    'Connect a different bank account',
    'Campaign goal amount is wrong',
    'My account is locked — need help',
    'Withdraw payout to international account',
    'Donation shows pending for 5 days',
    'AI campaign builder produced incorrect content',
    'How do I close a completed campaign?',
    'Supporter left an inappropriate comment',
    'I cannot log in with Google SSO',
    'Payout sent but not received',
    'CharitScore is lower than expected',
    'How do I extend my campaign deadline?',
    'Campaign video thumbnail not displaying',
    'Where is my 1099 tax form?',
    'How do I set up team fundraising?',
    'My campaign was duplicated by someone else',
    'Mobile app crashes when uploading photos',
    'Donation matching not calculating correctly',
    'How do I pause my campaign?',
    'I need to update my legal name',
    'Can I fundraise for an international charity?',
    'Notification emails are going to spam',
    'How do I delete my account?',
    'Campaign analytics not loading',
    'I cannot add a new payment method',
    'My campaign URL changed after editing',
    'Two donations were charged instead of one',
    'How to get verified badge on my campaign?',
    'Donor reported they cannot donate on mobile',
    'Payout declined — what do I do?',
    'I did not get an email confirmation',
    'How do I apply for fee waivers?',
    'Feature request: recurring donations',
    'Campaign description formatting is broken',
    'My beneficiary is not receiving funds',
    'Stripe identity verification failed',
    'Account flagged for suspicious activity',
    'How long does payout take?',
    'Donation was charged in the wrong currency',
  ];

  const BODIES = [
    'I have been waiting for over a week and the issue is still not resolved. Please help urgently.',
    'This has caused significant stress for my family. We depend on these funds. Please prioritize this.',
    'I followed all the steps but the problem persists. Screenshots attached in a follow-up email.',
    'I appreciate the platform but this issue is blocking my campaign completely.',
    'A quick response would be greatly appreciated. The campaign deadline is approaching.',
    'I tried contacting support before but never heard back. Trying again here.',
    'My donors are asking me about this and I have no answer for them.',
    'This happened after the recent update. It may be a bug introduced in the latest release.',
    'Everything was working fine yesterday. The issue started this morning.',
    'I have already tried clearing my browser cache and logging in on a different device.',
    'I am a long-time user and this is the first time I have had an issue.',
    'The error message I receive is: "Something went wrong. Please try again."',
    'I noticed this issue on both desktop and mobile. It appears to be platform-wide.',
    'I would like a refund or credit if this cannot be resolved within 24 hours.',
    'My campaign ends in 3 days. This is time-sensitive.',
    'I am raising funds for a medical emergency and need this resolved ASAP.',
    'I checked the FAQ and help center but could not find an answer.',
    'A friend who also uses CharitMe is having the same issue.',
    'I am happy to provide additional details or screenshots if needed.',
    'Please escalate this if the first-level support cannot solve it.',
  ];

  const PRIORITIES = ['low', 'normal', 'normal', 'normal', 'high', 'high', 'urgent'] as const;
  const STATUSES = ['open', 'open', 'open', 'in_progress', 'in_progress', 'resolved', 'resolved', 'closed'] as const;
  const SOURCES = ['web', 'web', 'web', 'email', 'api'] as const;

  const now = Date.now();
  const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

  const rows = Array.from({ length: 500 }, (_, i) => {
    const createdAt = new Date(now - Math.random() * TWO_YEARS_MS).toISOString();
    const priority  = PRIORITIES[i % PRIORITIES.length];
    const status    = STATUSES[i % STATUSES.length];
    const source    = SOURCES[i % SOURCES.length];
    const subject   = SUBJECTS[i % SUBJECTS.length];
    const body      = BODIES[i % BODIES.length];
    const submitterId = profileIds.length > 0 ? profileIds[i % profileIds.length] : null;

    return {
      submitter_id: i % 4 === 0 ? null : submitterId, // ~25% guest submitters
      subject,
      body,
      priority,
      status,
      source,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  // Insert in batches of 100 to stay within payload limits
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabaseAdmin.from('support_cases').insert(batch);
    if (error) {
      errors.push(error.message);
    } else {
      inserted += batch.length;
    }
  }

  const { count: finalCount } = await supabaseAdmin
    .from('support_cases')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    ok: errors.length === 0,
    inserted,
    total: finalCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
