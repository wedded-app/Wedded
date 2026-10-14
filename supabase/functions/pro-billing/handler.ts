// POST { vendorId, action: 'checkout' | 'portal' | 'refresh' }.
// 200 {url?, status:'pro'|'free'}; 409 already_subscribed or no_customer.
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { type ProSettings, syncPro, validProPrice } from '../_shared/pro.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
export function billingHandler(
  deps: {
    settings: () => ProSettings | null;
    admin: SupabaseClient;
    stripe: (key: string) => Stripe;
  },
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    const { data: auth, error: authError } = await deps.admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
    const body = await request.json().catch(() => null) as
      | { vendorId?: unknown; action?: unknown }
      | null;
    if (
      typeof body?.vendorId !== 'string' ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.vendorId) ||
      !['checkout', 'portal', 'refresh'].includes(String(body.action))
    ) return json({ error: 'invalid' }, 400);
    const vendorId = body.vendorId;
    const { data: member, error: memberError } = await deps.admin.from('vendor_members').select(
      'vendor_id',
    ).eq('vendor_id', vendorId).eq('user_id', auth.user.id).maybeSingle();
    if (memberError) return json({ error: 'server_error' }, 500);
    if (!member) return json({ error: 'not_allowed' }, 403);
    const settings = deps.settings();
    if (!settings) return json({ error: 'not_set_up' }, 503);
    const stripe = deps.stripe(settings.secretKey);
    try {
      const { data: saved, error: savedError } = await deps.admin.from('vendor_subscriptions')
        .select('stripe_customer_id,livemode').eq('vendor_id', vendorId).maybeSingle();
      if (savedError) throw savedError;
      if (saved?.livemode) return json({ error: 'not_set_up' }, 503);
      let customer = saved?.stripe_customer_id as string | undefined;
      if (!customer) {
        if (body.action === 'refresh') return json({ status: 'free' });
        if (body.action === 'portal') return json({ error: 'no_customer' }, 409);
        const created = await stripe.customers.create({
          metadata: { vendor_id: vendorId },
        }, { idempotencyKey: `pro-customer-${vendorId}` });
        const { data, error } = await deps.admin.rpc('save_pro_customer', {
          p_vendor_id: vendorId,
          p_stripe_customer_id: created.id,
          p_livemode: false,
        });
        if (error || typeof data !== 'string') throw error ?? new Error('missing_customer');
        customer = data;
      }
      const result = await syncPro(stripe, deps.admin, customer, settings.priceId);
      if (body.action === 'refresh') return json({ status: result.status });
      if (body.action === 'portal') {
        const portal = await stripe.billingPortal.sessions.create({
          customer,
          return_url: `${settings.returnUrl}?pro=billing`,
        });
        return json({ url: portal.url, status: result.status });
      }
      // Any unfinished/current subscription must be managed rather than bought twice.
      if (
        result.subscription &&
        !['canceled', 'incomplete_expired'].includes(result.subscription.status)
      ) return json({ error: 'already_subscribed' }, 409);
      const price = await stripe.prices.retrieve(settings.priceId);
      if (!validProPrice(price)) return json({ error: 'not_set_up' }, 503);
      const { data: attempts, error: attemptError } = await deps.admin.rpc('claim_pro_checkout', {
        p_vendor_id: vendorId,
      });
      if (attemptError || !attempts?.[0]) throw attemptError ?? new Error('missing_attempt');
      const attempt = attempts[0];
      const session = await stripe.checkout.sessions.create({
        customer,
        mode: 'subscription',
        line_items: [{ price: settings.priceId, quantity: 1 }],
        client_reference_id: vendorId,
        metadata: { vendor_id: vendorId },
        subscription_data: { metadata: { vendor_id: vendorId } },
        success_url: `${settings.returnUrl}?pro=success`,
        cancel_url: `${settings.returnUrl}?pro=canceled`,
        expires_at: Math.floor(new Date(attempt.expires_at).getTime() / 1000),
      }, { idempotencyKey: `pro-checkout-${attempt.attempt_id}` });
      if (!session.url) throw new Error('missing_url');
      return json({ url: session.url, status: result.status });
    } catch {
      // Never log tokens, portal/checkout URLs, card details or Stripe payloads.
      console.error('pro-billing failed', vendorId);
      return json({ error: 'billing_error' }, 502);
    }
  };
}
