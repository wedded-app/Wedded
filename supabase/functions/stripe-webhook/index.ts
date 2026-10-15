// stripe-webhook: Stripe tells Wedded what happened (#209). Set it up in
// Stripe as a Connect webhook (events on connected accounts) for
// payment_intent.succeeded, payment_intent.payment_failed, charge.refunded and
// account.updated; its signing secret is STRIPE_WEBHOOK_SECRET. No Supabase
// login (verify_jwt = false in config.toml): Stripe's signature is the check.
//
//   200 { received: true } · 400 bad_signature · 503 not_set_up

import { createClient } from '@supabase/supabase-js';
import { limitedBody } from '../_shared/body.ts';

import Stripe from 'stripe';

import { readStripeEvent, stripeClient, stripeSettings } from '../_shared/stripe.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const settings = stripeSettings();
  if (!settings?.webhookSecret) return json({ error: 'not_set_up' }, 503);

  const signature = request.headers.get('Stripe-Signature') ?? '';
  const payload = await limitedBody(request, 1048576);
  if (payload === null) return json({ error: 'body_too_large' }, 413);
  const stripe = stripeClient(settings.secretKey);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      settings.webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return json({ error: 'bad_signature' }, 400);
  }

  const meaning = readStripeEvent(
    event as unknown as { type: string; data: { object: Record<string, unknown> } },
  );
  if (!meaning) return json({ received: true }, 200);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = 'deposit' in meaning
    ? await admin.rpc('record_deposit_payment', {
      p_payment_intent_id: meaning.deposit.paymentIntentId,
      p_outcome: meaning.deposit.outcome,
    })
    : await admin.rpc('update_payment_account', {
      p_stripe_account_id: meaning.account.accountId,
      p_charges_enabled: meaning.account.chargesEnabled,
      p_details_submitted: meaning.account.detailsSubmitted,
    });
  if (error) {
    // A 500 makes Stripe try again later
    console.error('stripe-webhook failed', event.id, event.type, error);
    return json({ error: 'server_error' }, 500);
  }
  return json({ received: true }, 200);
});
