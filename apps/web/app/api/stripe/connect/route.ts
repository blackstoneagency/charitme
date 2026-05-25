import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { getAppOrigin } from '../../../../lib/auth-config';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: connectedAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, stripe_account_id')
    .eq('user_id', user.id)
    .single();

  let accountId = connectedAccount?.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    await supabaseAdmin
      .from('connected_accounts')
      .insert({ user_id: user.id, stripe_account_id: accountId });
  }

  const origin = getAppOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard`,
    return_url: `${origin}/api/stripe/connect?account=${accountId}&user=${user.id}`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.redirect(`${getAppOrigin()}/login`);

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('account');
  const userId = searchParams.get('user');

  if (userId !== user.id) {
    return Response.redirect(`${getAppOrigin()}/dashboard`);
  }

  if (accountId && userId) {
    const { data: connectedAccount } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, stripe_account_id')
      .eq('user_id', userId)
      .eq('stripe_account_id', accountId)
      .single();

    if (!connectedAccount) {
      return Response.redirect(`${getAppOrigin()}/dashboard`);
    }

    const account = await stripe.accounts.retrieve(accountId);
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        verification_status: account.details_submitted ? 'verified' : 'pending',
      })
      .eq('id', connectedAccount.id);

    if (account.details_submitted) {
      await supabaseAdmin
        .from('profiles')
        .update({ identity_verified: true })
        .eq('id', userId);
    }
  }

  return Response.redirect(`${getAppOrigin()}/dashboard`);
}
