// Wedded Pro (#220): Stripe test-mode billing, separate from Connect deposits.
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

export type ProSettings = {
  secretKey: string;
  priceId: string;
  returnUrl: string;
  webhookSecret?: string;
};

/** No live billing until founders explicitly activate it. URLs come from server config. */
export function proSettings(env = (key: string) => Deno.env.get(key)): ProSettings | null {
  const secretKey = env('STRIPE_SECRET_KEY')?.trim();
  const priceId = env('STRIPE_PRO_PRICE_ID')?.trim();
  const returnUrl = env('STRIPE_PRO_RETURN_URL')?.trim();
  if (!secretKey?.startsWith('sk_test_') || !priceId?.startsWith('price_') || !returnUrl) {
    return null;
  }
  try {
    const url = new URL(returnUrl);
    if (url.username || url.password || url.hash || url.search) return null;
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    ) return null;
  } catch {
    return null;
  }
  return {
    secretKey,
    priceId,
    returnUrl,
    webhookSecret: env('STRIPE_PRO_WEBHOOK_SECRET')?.trim() || undefined,
  };
}

export function validProPrice(price: Stripe.Price): boolean {
  return !price.livemode && price.active && price.currency === 'usd' &&
    price.unit_amount === 5000 &&
    price.type === 'recurring' && price.recurring?.interval === 'month' &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed';
}

export function proAccess(status: string, end: number | null, now = Date.now()): 'pro' | 'free' {
  return status === 'active' || status === 'trialing' ||
      (status === 'past_due' && end !== null && end * 1000 > now - 3 * 86400000)
    ? 'pro'
    : 'free';
}

/** Only platform billing events, never Connect events or unrelated products. */
export function proEventCustomer(
  event: {
    type: string;
    livemode: boolean;
    account?: string;
    data: { object: Record<string, unknown> };
  },
): string | null {
  if (
    event.livemode || event.account || ![
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ].includes(event.type)
  ) return null;
  const customer = event.data.object.customer;
  return typeof customer === 'string' && /^cus_[A-Za-z0-9]+$/.test(customer) ? customer : null;
}

const PRIORITY: Record<string, number> = {
  active: 8,
  trialing: 7,
  past_due: 6,
  unpaid: 5,
  paused: 4,
  incomplete: 3,
  canceled: 2,
  incomplete_expired: 1,
};

export function chooseProSubscription(
  subscriptions: Stripe.Subscription[],
  priceId: string,
): Stripe.Subscription | null {
  return subscriptions.filter((s) =>
    !s.livemode && s.items.data.some((item) => item.price.id === priceId)
  )
    .sort((a, b) =>
      (PRIORITY[b.status] ?? 0) - (PRIORITY[a.status] ?? 0) || b.created - a.created
    )[0] ?? null;
}

/** Fetch current Stripe state instead of trusting webhook order or old event payloads. */
export async function syncPro(
  stripe: Stripe,
  admin: SupabaseClient,
  customer: string,
  priceId: string,
) {
  const observedAt = new Date().toISOString();
  const subscriptions: Stripe.Subscription[] = [];
  let after: string | undefined;
  do {
    const page = await stripe.subscriptions.list({
      customer,
      price: priceId,
      status: 'all',
      limit: 100,
      starting_after: after,
    });
    subscriptions.push(...page.data);
    after = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (after);
  const subscription = chooseProSubscription(subscriptions, priceId);
  const item = subscription?.items.data.find((i) => i.price.id === priceId);
  const end = item?.current_period_end ?? null;
  const status = subscription?.status ?? 'canceled';
  const { error } = await admin.rpc('save_pro_subscription', {
    p_stripe_customer_id: customer,
    p_status: status,
    p_stripe_subscription_id: subscription?.id ?? null,
    p_current_period_end: end ? new Date(end * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
    p_observed_at: observedAt,
  });
  if (error) throw error;
  return { status: proAccess(status, end), subscription };
}
