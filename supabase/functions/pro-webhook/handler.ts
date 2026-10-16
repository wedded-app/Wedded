import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { proEventCustomer, type ProSettings, syncPro } from '../_shared/pro.ts';
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
export function webhookHandler(
  deps: {
    settings: () => ProSettings | null;
    admin: SupabaseClient;
    stripe: (key: string) => Stripe;
  },
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const settings = deps.settings();
    if (!settings?.webhookSecret) return json({ error: 'not_set_up' }, 503);
    const stripe = deps.stripe(settings.secretKey);
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        await request.text(),
        request.headers.get('Stripe-Signature') ?? '',
        settings.webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch {
      return json({ error: 'bad_signature' }, 400);
    }
    const customer = proEventCustomer(event as unknown as Parameters<typeof proEventCustomer>[0]);
    if (!customer) return json({ received: true });
    try {
      const { data: saved, error } = await deps.admin.from('vendor_subscriptions').select(
        'vendor_id,livemode',
      ).eq('stripe_customer_id', customer).maybeSingle();
      if (error) throw error;
      if (saved && !saved.livemode) await syncPro(stripe, deps.admin, customer, settings.priceId);
      return json({ received: true });
    } catch {
      console.error('pro-webhook failed', event.id, event.type);
      return json({ error: 'server_error' }, 500);
    }
  };
}
