import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { getAppOrigin } from '../../../../lib/auth-config';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single();

  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id);
  }

  const origin = getAppOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard`,
    return_url: `${origin}/api/stripe/connect/return?account=${accountId}&user=${user.id}`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('account');
  const userId = searchParams.get('user');

  if (accountId && userId) {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.details_submitted) {
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_onboarded: true })
        .eq('id', userId);
    }
  }

  return Response.redirect(`${getAppOrigin()}/dashboard`);
}
