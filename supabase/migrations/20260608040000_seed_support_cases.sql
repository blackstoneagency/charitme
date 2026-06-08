-- Seed 500 fake support_cases rows (idempotent — skips if any rows exist)
do $$
declare
  profile_ids uuid[];
  subjects    text[] := array[
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
    'Donation was charged in the wrong currency'
  ];
  bodies text[] := array[
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
    'The error message I receive is: Something went wrong. Please try again.',
    'I noticed this issue on both desktop and mobile. It appears to be platform-wide.',
    'I would like a refund or credit if this cannot be resolved within 24 hours.',
    'My campaign ends in 3 days. This is time-sensitive.',
    'I am raising funds for a medical emergency and need this resolved ASAP.',
    'I checked the FAQ and help center but could not find an answer.',
    'A friend who also uses CharitMe is having the same issue.',
    'I am happy to provide additional details or screenshots if needed.',
    'Please escalate this if the first-level support cannot solve it.'
  ];
  priorities text[] := array['low','normal','normal','normal','high','high','urgent'];
  statuses   text[] := array['open','open','open','in_progress','in_progress','resolved','resolved','closed'];
  sources    text[] := array['web','web','web','email','api'];
  i          int;
  sub_id     uuid;
begin
  -- skip if already seeded
  if (select count(*) from public.support_cases) > 0 then
    return;
  end if;

  -- collect up to 50 profile ids
  select array_agg(id) into profile_ids from (select id from public.profiles limit 50) t;

  for i in 1..500 loop
    -- ~25% guest (null submitter)
    if profile_ids is not null and array_length(profile_ids,1) > 0 and (i % 4 != 0) then
      sub_id := profile_ids[1 + ((i-1) % array_length(profile_ids,1))];
    else
      sub_id := null;
    end if;

    insert into public.support_cases (submitter_id, subject, body, priority, status, created_at, updated_at)
    values (
      sub_id,
      subjects[1 + ((i-1) % array_length(subjects,1))],
      bodies[1   + ((i-1) % array_length(bodies,1))],
      priorities[1 + ((i-1) % array_length(priorities,1))],
      statuses[1   + ((i-1) % array_length(statuses,1))],
      now() - (random() * interval '730 days'),
      now() - (random() * interval '730 days')
    );
  end loop;
end $$;
