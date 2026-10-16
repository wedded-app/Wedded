// pay-deposit: the family starts paying a deposit their vendor asked for
// (#209). Creates (or picks up again) a Stripe payment on the vendor's own
// connected account and hands the app what Stripe's payment sheet needs. The
// payment is confirmed in the app; Stripe's webhook (stripe-webhook) marks the
// deposit paid.
//
//   POST { depositId } → 200 { clientSecret, publishableKey, stripeAccountId, amountCents, vendorName }
//                      → 200 { alreadyPaid: true }
//   401 unauthorized · 403 not_allowed · 409 not_payable · 400 invalid · 503 not_set_up · 502 stripe_error

import { createClient } from '@supabase/supabase-js';
import { jsonBody, limitedBody } from '../_shared/body.ts';

import {
  canReusePayment,
  depositDescription,
  stripeClient,
  stripeSettings,
} from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

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

type Payable = {
  amount_cents: number;
  currency: string;
  stripe_account_id: string | null;
  stripe_payment_intent_id: string | null;
  status: string;
  vendor_name: string;
  event_name: string | null;
};

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
  const body = jsonBody(raw) as { depositId?: unknown } | null;
  const depositId = typeof body?.depositId === 'string' ? body.depositId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(depositId)) {
    return json({ error: 'invalid' }, 400);
  }

  const { data, error } = await admin.rpc('deposit_for_payment', {
    p_deposit_id: depositId,
    p_user_id: userData.user.id,
  });
  if (error) {
    if (error.message.includes('not_allowed')) return json({ error: 'not_allowed' }, 403);
    if (error.message.includes('not_payable')) return json({ error: 'not_payable' }, 409);
    console.error('deposit_for_payment failed', depositId, error);
    return json({ error: 'server_error' }, 500);
  }
  const deposit = (data as Payable[])[0];
  if (!deposit?.stripe_account_id) return json({ error: 'not_payable' }, 409);
  const stripeAccount = deposit.stripe_account_id;

  const stripe = stripeClient(settings.secretKey);
  try {
    // A payment already started (they closed the sheet, or it failed): pick it up again
    if (deposit.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(
        deposit.stripe_payment_intent_id,
        undefined,
        { stripeAccount },
      );
      if (existing.status === 'succeeded') {
        await admin.rpc('record_deposit_payment', {
          p_payment_intent_id: existing.id,
          p_outcome: 'paid',
        });
        return json({ alreadyPaid: true }, 200);
      }
      if (canReusePayment(existing.status) && existing.client_secret) {
        return json({
          clientSecret: existing.client_secret,
          publishableKey: settings.publishableKey,
          stripeAccountId: stripeAccount,
          amountCents: deposit.amount_cents,
          vendorName: deposit.vendor_name,
        }, 200);
      }
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: deposit.amount_cents,
        currency: deposit.currency,
        automatic_payment_methods: { enabled: true },
        description: depositDescription(deposit.vendor_name, deposit.event_name),
        metadata: { deposit_id: depositId },
      },
      { stripeAccount, idempotencyKey: `deposit-${depositId}-${Date.now()}` },
    );
    const { error: attachError } = await admin.rpc('attach_payment_intent', {
      p_deposit_id: depositId,
      p_payment_intent_id: intent.id,
    });
    if (attachError) throw attachError;

    return json({
      clientSecret: intent.client_secret,
      publishableKey: settings.publishableKey,
      stripeAccountId: stripeAccount,
      amountCents: deposit.amount_cents,
      vendorName: deposit.vendor_name,
    }, 200);
  } catch (e) {
    console.error('pay-deposit failed', depositId, e);
    return json({ error: 'stripe_error' }, 502);
  }
});
