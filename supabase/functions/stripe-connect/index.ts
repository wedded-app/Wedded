// stripe-connect: a vendor's people connect the vendor's own Stripe account,
// so families can pay deposits (#209). Standard accounts: the vendor is the
// seller and Stripe's fees come out of their payouts.
//
//   POST { vendorId, action: 'link' }     → 200 { url, status }  (Stripe's setup page)
//   POST { vendorId, action: 'refresh' }  → 200 { status }       (after coming back)
//   status: 'none' | 'pending' | 'ready'
//   401 unauthorized · 403 not_allowed · 400 invalid · 503 not_set_up · 502 stripe_error

import { createClient } from '@supabase/supabase-js';
import { jsonBody, limitedBody } from '../_shared/body.ts';

import { paymentStatus, stripeClient, stripeSettings } from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
// Where Stripe sends the vendor back to: a small page that says to return to the app
const RETURN_URL = Deno.env.get('STRIPE_RETURN_URL')?.trim() ||
  `${SUPABASE_URL}/functions/v1/stripe-return`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const settings = stripeSettings();
  if (!settings) return json({ error: 'not_set_up' }, 503);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  const raw = await limitedBody(request, 2048);
  if (raw === null) return json({ error: 'body_too_large' }, 413);
  const body = jsonBody(raw) as
    | { vendorId?: unknown; action?: unknown }
    | null;
  const vendorId = typeof body?.vendorId === 'string' ? body.vendorId : '';
  const action = body?.action === 'refresh' ? 'refresh' : body?.action === 'link' ? 'link' : null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId) || !action
  ) return json({ error: 'invalid' }, 400);

  const { data: member } = await admin
    .from('vendor_members')
    .select('vendor_id')
    .eq('vendor_id', vendorId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!member) return json({ error: 'not_allowed' }, 403);

  const { data: vendor } = await admin
    .from('vendors')
    .select('name, slug')
    .eq('id', vendorId)
    .single();
  const { data: saved } = await admin
    .from('vendor_payment_accounts')
    .select('stripe_account_id, charges_enabled, details_submitted')
    .eq('vendor_id', vendorId)
    .maybeSingle();

  const stripe = stripeClient(settings.secretKey);
  try {
    let accountId = saved?.stripe_account_id ?? null;
    if (!accountId) {
      if (action === 'refresh') return json({ status: 'none' }, 200);
      const account = await stripe.accounts.create(
        {
          type: 'standard',
          email: userData.user.email ?? undefined,
          business_profile: { name: vendor?.name ?? undefined },
          metadata: { vendor_id: vendorId, vendor_slug: vendor?.slug ?? '' },
        },
        { idempotencyKey: `connect-${vendorId}` },
      );
      accountId = account.id;
    }

    // Always ask Stripe how it stands, and keep our copy in step
    const account = await stripe.accounts.retrieve(accountId);
    const { error: saveError } = await admin.rpc('save_payment_account', {
      p_vendor_id: vendorId,
      p_stripe_account_id: account.id,
      p_charges_enabled: account.charges_enabled === true,
      p_details_submitted: account.details_submitted === true,
      p_livemode: !settings.secretKey.startsWith('sk_test_'),
    });
    if (saveError) throw saveError;
    const status = paymentStatus({
      charges_enabled: account.charges_enabled === true,
      details_submitted: account.details_submitted === true,
    });

    if (action === 'refresh') return json({ status }, 200);
    const link = await stripe.accountLinks.create({
      account: account.id,
      type: 'account_onboarding',
      refresh_url: `${RETURN_URL}?again=1`,
      return_url: RETURN_URL,
    });
    return json({ url: link.url, status }, 200);
  } catch (e) {
    console.error('stripe-connect failed', vendorId, e);
    return json({ error: 'stripe_error' }, 502);
  }
});
